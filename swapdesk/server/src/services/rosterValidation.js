
import Assignment from '../models/Assignment.js';
import Staff from '../models/Staff.js';

const getWeekRange = (date) => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);

  const day = start.getUTCDay();
  const daysFromMonday = (day + 6) % 7;

  start.setUTCDate(start.getUTCDate() - daysFromMonday);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return { start, end };
};

export const validateRoster = async (staffId, targetShift, session = null) => {
  const errors = [];

  const staffQuery = Staff.findById(staffId);
  if (session) staffQuery.session(session);

  const staff = await staffQuery;

  if (!staff || staff.role !== 'staff') {
    return { valid: false, errors: ['Staff member not found'] };
  }

  // Rule 1: Clinical role must match.
  if (staff.clinicalRole !== targetShift.requiredClinicalRole) {
    errors.push('Clinical role does not match the shift');
  }

  // Rule 2: Staff must be active and licence valid on shift date.
  if (!staff.active) {
    errors.push('Staff member is inactive');
  }

  const licenceExpiryEnd = staff.licenceExpiry
    ? new Date(staff.licenceExpiry)
    : null;

  if (licenceExpiryEnd) {
    licenceExpiryEnd.setUTCHours(23, 59, 59, 999);
  }

  if (
    !licenceExpiryEnd ||
    licenceExpiryEnd < new Date(targetShift.start)
  ) {
    errors.push('Staff licence is missing or expired for this shift');
  }

  // Rule 5: Staff must not already have the target shift.
  const targetQuery = Assignment.findOne({
    staff: staffId,
    shift: targetShift._id
  });

  if (session) targetQuery.session(session);

  const existingTargetAssignment = await targetQuery;

  if (existingTargetAssignment) {
    errors.push('Staff member is already assigned to this shift');
  }

  // Load existing assignments.
  const assignmentsQuery = Assignment.find({ staff: staffId })
    .populate('shift', 'start end');

  if (session) assignmentsQuery.session(session);

  const assignments = await assignmentsQuery.lean();

  const { start: weekStart, end: weekEnd } = getWeekRange(
    targetShift.start
  );

  let totalWeeklyHours = 0;

  for (const assignment of assignments) {
    const shift = assignment.shift;
    if (!shift) continue;

    const existingStart = new Date(shift.start);
    const existingEnd = new Date(shift.end);

    // Rule 3: No overlapping shifts. Back-to-back is allowed.
    if (
      existingStart < new Date(targetShift.end) &&
      existingEnd > new Date(targetShift.start)
    ) {
      errors.push('Staff member has an overlapping assigned shift');
      break;
    }

    // Rule 4: Count only the part of the shift inside Monday-Sunday.
    const overlapStart = Math.max(
      existingStart.getTime(),
      weekStart.getTime()
    );

    const overlapEnd = Math.min(
      existingEnd.getTime(),
      weekEnd.getTime()
    );

    if (overlapEnd > overlapStart) {
      totalWeeklyHours +=
        (overlapEnd - overlapStart) / (1000 * 60 * 60);
    }
  }

  // Include the target shift in the weekly total.
  const targetStart = Math.max(
    new Date(targetShift.start).getTime(),
    weekStart.getTime()
  );

  const targetEnd = Math.min(
    new Date(targetShift.end).getTime(),
    weekEnd.getTime()
  );

  if (targetEnd > targetStart) {
    totalWeeklyHours +=
      (targetEnd - targetStart) / (1000 * 60 * 60);
  }

  if (totalWeeklyHours > 48) {
    errors.push(
      `Weekly hours would be ${totalWeeklyHours.toFixed(2)}, exceeding the 48-hour limit`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    totalWeeklyHours: Number(totalWeeklyHours.toFixed(2))
  };
};
