import mongoose from 'mongoose';

import SwapRequest from '../../../swapdesk/server/src/models/SwapRequest.js';
import Shift from '../../../swapdesk/server/src/models/Shift.js';
import Assignment from '../../../swapdesk/server/src/models/Assignment.js';
import Staff from '../../../swapdesk/server/src/models/Staff.js';
import { validateRoster } from '../../../swapdesk/server/src/services/rosterValidation.js';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const CANCELLABLE_STATUSES = ['pending_colleague', 'pending_admin'];

const sendError = (res, error, fallback) => {
  const status = Number.isInteger(error.status) ? error.status : 500;

  return res.status(status).json({
    success: false,
    message: status === 500 ? fallback : error.message,
    ...(error.details ? { errors: error.details } : {})
  });
};

const encodeCursor = (request) => Buffer
  .from(JSON.stringify({
    createdAt: request.createdAt,
    id: request._id.toString()
  }))
  .toString('base64url');

const decodeCursor = (cursor) => {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    );

    const createdAt = new Date(decoded.createdAt);

    if (
      !mongoose.isValidObjectId(decoded.id) ||
      Number.isNaN(createdAt.getTime())
    ) {
      return null;
    }

    return { createdAt, id: decoded.id };
  } catch {
    return null;
  }
};

const parseLimit = (value) => {
  if (value === undefined) return DEFAULT_LIMIT;

  if (!/^\d+$/.test(String(value))) return null;

  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit < 1) return null;

  return Math.min(limit, MAX_LIMIT);
};

export const listRequests = async (req, res) => {
  try {
    const allowedKeys = new Set(['status', 'cursor', 'limit']);
    const unknownKeys = Object.keys(req.query)
      .filter((key) => !allowedKeys.has(key));

    if (unknownKeys.length) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported query parameter'
      });
    }

    const limit = parseLimit(req.query.limit);

    if (!limit) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be a positive integer'
      });
    }

    const filter = {};

    if (req.query.status) {
      const allowedStatuses = SwapRequest.schema
        .path('status')
        .enumValues;

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request status'
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.cursor) {
      const cursor = decodeCursor(req.query.cursor);

      if (!cursor) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pagination cursor'
        });
      }

      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        {
          createdAt: cursor.createdAt,
          _id: { $lt: new mongoose.Types.ObjectId(cursor.id) }
        }
      ];
    }

    const items = await SwapRequest.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('requester', 'name email clinicalRole department')
      .populate('colleague', 'name email clinicalRole department')
      .populate('shift', 'department requiredClinicalRole start end')
      .lean();

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const lastItem = pageItems[pageItems.length - 1];

    return res.status(200).json({
      success: true,
      items: pageItems,
      nextCursor: hasMore && lastItem ? encodeCursor(lastItem) : null
    });
  } catch (error) {
    return sendError(res, error, 'Unable to fetch swap requests');
  }
};

export const approveRequest = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid swap request ID'
    });
  }

  const session = await mongoose.startSession();

  try {
    let approvedRequest = null;

    await session.withTransaction(async () => {
      const request = await SwapRequest.findOne({
        _id: req.params.id,
        status: 'pending_admin'
      }).session(session);

      if (!request) {
        const error = new Error(
          'Request not found or is no longer awaiting approval'
        );
        error.status = 409;
        throw error;
      }

      const shift = await Shift.findById(request.shift).session(session);

      if (!shift) {
        const error = new Error('Shift not found');
        error.status = 404;
        throw error;
      }

      if (new Date(shift.start) <= new Date()) {
        const error = new Error('Cannot approve a swap for a past or ongoing shift');
        error.status = 422;
        throw error;
      }

      // Incrementing rosterVersion serializes approvals for the same colleague.
      const colleague = await Staff.findOneAndUpdate(
        {
          _id: request.colleague,
          role: 'staff',
          active: true
        },
        { $inc: { rosterVersion: 1 } },
        { new: true, session }
      );

      if (!colleague) {
        const error = new Error('Colleague is missing or inactive');
        error.status = 422;
        throw error;
      }

      const validation = await validateRoster(
        request.colleague,
        shift,
        session
      );

      if (!validation.valid) {
        const error = new Error(
          'Colleague does not meet roster requirements'
        );
        error.status = 422;
        error.details = validation.errors;
        throw error;
      }

      const requesterAssignment = await Assignment.findOne({
        staff: request.requester,
        shift: request.shift
      }).session(session);

      if (!requesterAssignment) {
        const error = new Error(
          'Requester is no longer assigned to this shift'
        );
        error.status = 409;
        throw error;
      }

      await Assignment.deleteOne(
        { _id: requesterAssignment._id },
        { session }
      );

      await Assignment.create(
        [{
          staff: request.colleague,
          shift: request.shift
        }],
        { session }
      );

      request.status = 'approved';
      request.audit.push({
        actor: req.user._id,
        fromStatus: 'pending_admin',
        toStatus: 'approved',
        note: typeof req.body?.note === 'string'
          ? req.body.note.trim().slice(0, 500)
          : ''
      });

      approvedRequest = await request.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: 'Swap approved and assignment transferred',
      swapRequest: approvedRequest
    });
  } catch (error) {
    return sendError(res, error, 'Unable to approve swap request');
  } finally {
    await session.endSession();
  }
};

export const cancelRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid swap request ID'
      });
    }

    const request = await SwapRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (!request.requester.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own request'
      });
    }

    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      return res.status(409).json({
        success: false,
        message: 'This request can no longer be cancelled'
      });
    }

    const previousStatus = request.status;

    const cancelledRequest = await SwapRequest.findOneAndUpdate(
      {
        _id: request._id,
        requester: req.user._id,
        status: { $in: CANCELLABLE_STATUSES }
      },
      {
        $set: { status: 'cancelled' },
        $push: {
          audit: {
            actor: req.user._id,
            fromStatus: previousStatus,
            toStatus: 'cancelled',
            note: 'Cancelled by requester'
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!cancelledRequest) {
      return res.status(409).json({
        success: false,
        message: 'Request has already been updated'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Swap request cancelled successfully',
      swapRequest: cancelledRequest
    });
  } catch (error) {
    return sendError(res, error, 'Unable to cancel swap request');
  }
};
