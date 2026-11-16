import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Shift from '../models/Shift.js';
import Staff from '../models/Staff.js';
import { validateRoster } from '../services/rosterValidation.js';

const getUtcWeekBounds = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;

  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday
  ));

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return { start, end };
};

const calculateWeeklyHours = (assignments, weekStart, weekEnd) => {
  let totalMilliseconds = 0;

  for (const assignment of assignments) {
    const shift = assignment.shift;
    if (!shift) continue;

    const start = Math.max(
      new Date(shift.start).getTime(),
      weekStart.getTime()
    );

    const end = Math.min(
      new Date(shift.end).getTime(),
      weekEnd.getTime()
    );

    if (end > start) {
      totalMilliseconds += end - start;
    }
  }

  return Number((totalMilliseconds / 3600000).toFixed(2));
};

export const getMyUpcomingShifts = async (req, res) => {
  try {
    const now = new Date();
    const { start: weekStart, end: weekEnd } = getUtcWeekBounds();

    const assignments = await Assignment.find({
      staff: req.user._id
    })
      .populate({
        path: 'shift',
        select: 'department requiredClinicalRole start end slots'
      })
      .lean();

    const weeklyHours = calculateWeeklyHours(
      assignments,
      weekStart,
      weekEnd
    );

    const upcoming = assignments
      .filter((assignment) =>
        assignment.shift &&
        new Date(assignment.shift.start) >= now
      )
      .sort((a, b) =>
        new Date(a.shift.start) - new Date(b.shift.start)
      )
      .slice(0, 100);

    return res.status(200).json({
      success: true,
      count: upcoming.length,
      assignments: upcoming,
      weeklyHours,
      weekStart,
      weekEnd
    });
  } catch (error) {
    console.error('Get upcoming shifts:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch upcoming shifts'
    });
  }
};

export const getEligibleColleagues = async (req, res) => {
  try {
    const { shiftId, q = '', cursor = '', limit = 20 } = req.query;

    if (!shiftId || !mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid shiftId is required'
      });
    }

    const shift = await Shift.findById(shiftId).lean();

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    if (new Date(shift.start) <= new Date()) {
      return res.status(422).json({
        success: false,
        message: 'Only future shifts can be swapped'
      });
    }

    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const filter = {
      _id: {
        ...(cursor && mongoose.Types.ObjectId.isValid(cursor)
          ? { $gt: new mongoose.Types.ObjectId(cursor) }
          : {}),
        $ne: req.user._id
      },
      active: true,
      clinicalRole: shift.requiredClinicalRole
    };

    if (q.trim()) {
      filter.name = { $regex: q.trim(), $options: 'i' };
    }

    const candidates = await Staff.find(filter)
      .select('name email clinicalRole department licenceExpiry')
      .sort({ _id: 1 })
      .limit(100)
      .lean();

    const eligible = [];
    let lastScannedId = cursor || null;

    for (const colleague of candidates) {
      lastScannedId = colleague._id;

      const validation = await validateRoster(colleague._id, shift);

      if (validation.valid) {
        eligible.push({
          _id: colleague._id,
          name: colleague.name,
          email: colleague.email,
          clinicalRole: colleague.clinicalRole,
          department: colleague.department,
          licenceExpiry: colleague.licenceExpiry,
          totalWeeklyHours: validation.totalWeeklyHours
        });
      }

      if (eligible.length >= pageSize) break;
    }

    const hasMore = candidates.length === 100 ||
      (candidates.length > 0 &&
       String(lastScannedId) !== String(candidates[candidates.length - 1]._id));

    return res.status(200).json({
      success: true,
      colleagues: eligible,
      nextCursor: hasMore ? lastScannedId : null
    });
  } catch (error) {
    console.error('Get eligible colleagues:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch eligible colleagues'
    });
  }
};
