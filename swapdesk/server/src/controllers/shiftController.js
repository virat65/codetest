
import Shift from '../models/Shift.js';

// POST /api/shifts - Admin creates a shift
export const createShift = async (req, res) => {
  try {
    const {
      department,
      requiredClinicalRole,
      start,
      end,
      slots
    } = req.body ?? {};

    if (!department || !requiredClinicalRole || !start || !end || slots === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Department, clinical role, start, end and slots are required'
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift dates. End must be after start'
      });
    }

    if (!Number.isInteger(Number(slots)) || Number(slots) < 1) {
      return res.status(400).json({
        success: false,
        message: 'Slots must be a positive integer'
      });
    }

    const shift = await Shift.create({
      department,
      requiredClinicalRole,
      start: startDate,
      end: endDate,
      slots: Number(slots)
    });

    return res.status(201).json({
      success: true,
      message: 'Shift created successfully',
      shift
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(422).json({
        success: false,
        message: error.message
      });
    }

    console.error('Create shift error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while creating shift'
    });
  }
};

// GET /api/shifts - Paginated shift list
export const getShifts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.department) {
      filter.department = req.query.department;
    }

    if (req.query.requiredClinicalRole) {
      filter.requiredClinicalRole = req.query.requiredClinicalRole;
    }

    if (req.query.from || req.query.to) {
      filter.start = {};

      if (req.query.from) {
        const from = new Date(req.query.from);
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid from date'
          });
        }
        filter.start.$gte = from;
      }

      if (req.query.to) {
        const to = new Date(req.query.to);
        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid to date'
          });
        }
        filter.start.$lte = to;
      }
    }

    const [shifts, total] = await Promise.all([
      Shift.find(filter)
        .sort({ start: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Shift.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      shifts
    });
  } catch (error) {
    console.error('Get shifts error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while fetching shifts'
    });
  }
};
