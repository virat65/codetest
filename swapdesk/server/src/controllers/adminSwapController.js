import mongoose from 'mongoose';
import SwapRequest from '../models/SwapRequest.js';
import Assignment from '../models/Assignment.js';
import Shift from '../models/Shift.js';
import Staff from '../models/Staff.js';
import { validateRoster } from '../services/rosterValidation.js';

// GET /api/swap-requests/admin
export const getAllSwapRequests = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (req.query.status) {
      const allowedStatuses = [
        'pending_colleague',
        'pending_admin',
        'approved',
        'declined',
        'rejected',
        'cancelled',
        'expired'
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status filter'
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.department) {
      const shifts = await Shift.find({
        department: req.query.department
      }).select('_id').lean();

      filter.shift = { $in: shifts.map((shift) => shift._id) };
    }

    const [requests, total] = await Promise.all([
      SwapRequest.find(filter)
        .populate('requester', 'name email clinicalRole department')
        .populate('colleague', 'name email clinicalRole department')
        .populate('shift', 'department requiredClinicalRole start end')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      SwapRequest.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      requests
    });
  } catch (error) {
    console.error('Get all swap requests error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch swap requests'
    });
  }
};

// PATCH /api/swap-requests/admin/:id/approve
export const approveSwapRequest = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid swap request ID'
    });
  }

  const session = await mongoose.startSession();

  try {
    let approvedRequest;

    await session.withTransaction(async () => {
      const request = await SwapRequest.findOne({
        _id: req.params.id,
        status: 'pending_admin'
      }).session(session);

      if (!request) {
        const error = new Error(
          'Request not found or no longer pending'
        );
        error.status = 409;
        throw error;
      }

      const shift = await Shift.findById(request.shift).session(session);

      if (!shift || shift.start <= new Date()) {
        const error = new Error(
          'Shift is unavailable or has already started'
        );
        error.status = 409;
        throw error;
      }

      // This write serializes concurrent approvals for this colleague.
      const colleague = await Staff.findOneAndUpdate(
        {
          _id: request.colleague,
          role: 'staff',
          active: true
        },
        {
          $inc: { rosterVersion: 1 }
        },
        {
          new: true,
          session
        }
      );

      if (!colleague) {
        const error = new Error('Colleague is missing or inactive');
        error.status = 422;
        throw error;
      }

      // Revalidate all roster rules inside the transaction.
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

      // Transfer assignment within the same transaction.
      await Assignment.deleteOne(
        { _id: requesterAssignment._id },
        { session }
      );

      await Assignment.create(
        [
          {
            staff: request.colleague,
            shift: request.shift
          }
        ],
        { session }
      );

      request.status = 'approved';

      request.audit.push({
        actor: req.user._id,
        fromStatus: 'pending_admin',
        toStatus: 'approved',
        note: req.body?.note || ''
      });

      approvedRequest = await request.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: 'Swap approved and assignment transferred',
      swapRequest: approvedRequest
    });
  } catch (error) {
    console.error('Approve swap request error:', error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Unable to approve swap request',
      ...(error.details ? { errors: error.details } : {})
    });
  } finally {
    await session.endSession();
  }
};

// PATCH /api/swap-requests/admin/:id/reject
export const rejectSwapRequest = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid swap request ID'
    });
  }

  try {
    const request = await SwapRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'pending_admin'
      },
      {
        $set: { status: 'rejected' },
        $push: {
          audit: {
            actor: req.user._id,
            fromStatus: 'pending_admin',
            toStatus: 'rejected',
            note: req.body?.note || ''
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(409).json({
        success: false,
        message: 'Request not found or no longer pending'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Swap request rejected',
      swapRequest: request
    });
  } catch (error) {
    console.error('Reject swap request error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to reject swap request'
    });
  }
};
