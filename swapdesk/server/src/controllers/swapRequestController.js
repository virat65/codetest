
import mongoose from 'mongoose';
import SwapRequest from '../models/SwapRequest.js';
import Assignment from '../models/Assignment.js';
import Shift from '../models/Shift.js';
import Staff from '../models/Staff.js';
import { validateRoster } from '../services/rosterValidation.js';

// POST /api/swap-requests
export const createSwapRequest = async (req, res) => {
  try {
    const { shiftId, colleagueId } = req.body ?? {};
    const requesterId = req.user._id;

    if (!shiftId || !colleagueId) {
      return res.status(400).json({
        success: false,
        message: 'Shift ID and colleague ID are required'
      });
    }

    if (
      !mongoose.isValidObjectId(shiftId) ||
      !mongoose.isValidObjectId(colleagueId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift ID or colleague ID'
      });
    }

    if (requesterId.toString() === colleagueId) {
      return res.status(422).json({
        success: false,
        message: 'You cannot request a swap with yourself'
      });
    }

    const shift = await Shift.findById(shiftId);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    if (shift.start <= new Date()) {
      return res.status(422).json({
        success: false,
        message: 'Only future shifts can be swapped'
      });
    }

    const requesterAssignment = await Assignment.findOne({
      staff: requesterId,
      shift: shiftId
    });

    if (!requesterAssignment) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this shift'
      });
    }

    const colleague = await Staff.findById(colleagueId);

    if (!colleague || colleague.role !== 'staff') {
      return res.status(404).json({
        success: false,
        message: 'Colleague not found'
      });
    }

    const existingOpenRequest = await SwapRequest.findOne({
      requester: requesterId,
      shift: shiftId,
      status: { $in: ['pending_colleague', 'pending_admin'] }
    });

    if (existingOpenRequest) {
      return res.status(409).json({
        success: false,
        message: 'An open swap request already exists for this shift'
      });
    }

    const validation = await validateRoster(colleagueId, shift);

    if (!validation.valid) {
      return res.status(422).json({
        success: false,
        message: 'Colleague does not meet roster requirements',
        errors: validation.errors
      });
    }

    const swapRequest = await SwapRequest.create({
      requester: requesterId,
      shift: shiftId,
      colleague: colleagueId,
      status: 'pending_colleague',
      audit: [{
        actor: requesterId,
        fromStatus: 'none',
        toStatus: 'pending_colleague',
        note: 'Swap request created'
      }]
    });

    return res.status(201).json({
      success: true,
      message: 'Swap request created successfully',
      swapRequest
    });
  } catch (error) {
    console.error('Create swap request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating swap request'
    });
  }
};

// PATCH /api/swap-requests/:id/respond
export const respondToSwapRequest = async (req, res) => {
  try {
    const { action, note = '' } = req.body ?? {};

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be accept or decline'
      });
    }

    const request = await SwapRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Swap request not found'
      });
    }

    if (!request.colleague.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the invited colleague can respond'
      });
    }

    if (request.status !== 'pending_colleague') {
      return res.status(409).json({
        success: false,
        message: 'This request is no longer awaiting colleague response'
      });
    }

    const nextStatus = action === 'accept' ? 'pending_admin' : 'declined';

    const updated = await SwapRequest.findOneAndUpdate(
      { _id: request._id, status: 'pending_colleague' },
      {
        $set: { status: nextStatus },
        $push: {
          audit: {
            actor: req.user._id,
            fromStatus: 'pending_colleague',
            toStatus: nextStatus,
            note
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Request has already been updated'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Swap request ${action}ed successfully`,
      swapRequest: updated
    });
  } catch (error) {
    console.error('Respond to swap request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while responding to swap request'
    });
  }
};

// PATCH /api/swap-requests/:id/cancel
export const cancelSwapRequest = async (req, res) => {
  try {
    const request = await SwapRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Swap request not found'
      });
    }

    if (!request.requester.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can cancel this request'
      });
    }

    if (!['pending_colleague', 'pending_admin'].includes(request.status)) {
      return res.status(409).json({
        success: false,
        message: 'This request cannot be cancelled'
      });
    }

    const previousStatus = request.status;

    const updated = await SwapRequest.findOneAndUpdate(
      {
        _id: request._id,
        status: previousStatus
      },
      {
        $set: { status: 'cancelled' },
        $push: {
          audit: {
            actor: req.user._id,
            fromStatus: previousStatus,
            toStatus: 'cancelled',
            note: req.body?.note || ''
          }
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Request has already been updated'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Swap request cancelled',
      swapRequest: updated
    });
  } catch (error) {
    console.error('Cancel swap request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while cancelling swap request'
    });
  }
};

// GET /api/swap-requests/mine
export const getMySwapRequests = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const filter = {
      $or: [
        { requester: req.user._id },
        { colleague: req.user._id }
      ]
    };

    if (req.query.status) filter.status = req.query.status;

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
      requests
    });
  } catch (error) {
    console.error('Get my swap requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching swap requests'
    });
  }
};
