
import Assignment from '../models/Assignment.js';
import Staff from '../models/Staff.js';
import Shift from '../models/Shift.js';
import { validateRoster } from '../services/rosterValidation.js';

// POST /api/assignments
// Admin assigns a staff member to a shift
export const createAssignment = async (req, res) => {
  try {
    const { staffId, shiftId } = req.body ?? {};

    if (!staffId || !shiftId) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID and Shift ID are required'
      });
    }

    const [staff, shift] = await Promise.all([
      Staff.findById(staffId),
      Shift.findById(shiftId)
    ]);

    if (!staff || staff.role !== 'staff') {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    if (!staff.active) {
      return res.status(422).json({
        success: false,
        message: 'Staff member is inactive'
      });
    }

    if (staff.clinicalRole !== shift.requiredClinicalRole) {
      return res.status(422).json({
        success: false,
        message: 'Staff clinical role does not match the shift'
      });
    }

    if (
      staff.licenceExpiry &&
      new Date(staff.licenceExpiry) < shift.start
    ) {
      return res.status(422).json({
        success: false,
        message: 'Staff licence expires before the shift'
      });
    }

    const existing = await Assignment.findOne({
      staff: staffId,
      shift: shiftId
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Staff member is already assigned to this shift'
      });
    }

    const assignedCount = await Assignment.countDocuments({ shift: shiftId });

    if (assignedCount >= shift.slots) {
      return res.status(409).json({
        success: false,
        message: 'All shift slots are already filled'
      });
    }

    const validation = await validateRoster(staffId, shift);

    if (!validation.valid) {
      return res.status(422).json({
        success: false,
        message: 'Staff member does not meet roster requirements',
        errors: validation.errors
      });
    }

    const assignment = await Assignment.create({
      staff: staffId,
      shift: shiftId
    });

    return res.status(201).json({
      success: true,
      message: 'Staff assigned to shift successfully',
      assignment
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Staff member is already assigned to this shift'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(422).json({
        success: false,
        message: error.message
      });
    }

    console.error('Create assignment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while creating assignment'
    });
  }
};

// GET /api/assignments
export const getAssignments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const assignments = await Assignment.find()
      .populate('staff', 'name email clinicalRole department')
      .populate('shift', 'department requiredClinicalRole start end slots')
      .sort({ _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Assignment.countDocuments();

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      assignments
    });
  } catch (error) {
    console.error('Get assignments error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while fetching assignments'
    });
  }
};
