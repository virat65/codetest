import { beforeEach, describe, expect, it, vi } from 'vitest';

const { staffFindById, assignmentFindOne, assignmentFind } = vi.hoisted(() => ({
  staffFindById: vi.fn(),
  assignmentFindOne: vi.fn(),
  assignmentFind: vi.fn()
}));

vi.mock('../src/models/Staff.js', () => ({
  default: { findById: staffFindById }
}));

vi.mock('../src/models/Assignment.js', () => ({
  default: {
    findOne: assignmentFindOne,
    find: assignmentFind
  }
}));

import { validateRoster } from '../src/services/rosterValidation.js';

const makeQuery = (value) => ({
  session: vi.fn().mockReturnThis(),
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  }
});

const targetShift = {
  _id: 'target-shift',
  requiredClinicalRole: 'Nurse',
  start: new Date('2026-11-17T09:00:00.000Z'),
  end: new Date('2026-11-17T17:00:00.000Z')
};

const validStaff = () => ({
  role: 'staff',
  clinicalRole: 'Nurse',
  active: true,
  licenceExpiry: new Date('2026-12-31T00:00:00.000Z')
});

const existingAssignment = (start, end) => ({
  shift: {
    start: new Date(start),
    end: new Date(end)
  }
});

const setup = ({ staff = validStaff(), assignments = [], existingTarget = null } = {}) => {
  staffFindById.mockReturnValue(makeQuery(staff));
  assignmentFindOne.mockReturnValue(makeQuery(existingTarget));

  assignmentFind.mockReturnValue({
    populate: vi.fn().mockReturnThis(),
    session: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(assignments)
  });
};

describe('validateRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('accepts a staff member who meets all roster rules', async () => {
    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(true);
    expect(result.totalWeeklyHours).toBe(8);
  });

  it('rejects a clinical role mismatch', async () => {
    setup({
      staff: { ...validStaff(), clinicalRole: 'Doctor' }
    });

    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Clinical role does not match the shift');
  });

  it('rejects inactive staff', async () => {
    setup({
      staff: { ...validStaff(), active: false }
    });

    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Staff member is inactive');
  });

  it('rejects a missing or expired licence', async () => {
    setup({
      staff: { ...validStaff(), licenceExpiry: null }
    });

    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Staff licence is missing or expired for this shift'
    );
  });

  it('accepts a licence that expires on the shift calendar date', async () => {
    setup({
      staff: {
        ...validStaff(),
        licenceExpiry: new Date('2026-11-17T00:00:00.000Z')
      }
    });

    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(true);
  });

  it('rejects overlapping shifts', async () => {
    setup({
      assignments: [
        existingAssignment(
          '2026-11-17T16:00:00.000Z',
          '2026-11-17T20:00:00.000Z'
        )
      ]
    });

    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Staff member has an overlapping assigned shift'
    );
  });

  it('allows back-to-back shifts', async () => {
    setup({
      assignments: [
        existingAssignment(
          '2026-11-17T01:00:00.000Z',
          '2026-11-17T09:00:00.000Z'
        )
      ]
    });

    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(true);
    expect(result.totalWeeklyHours).toBe(16);
  });

  it('rejects weekly hours exceeding 48', async () => {
    setup({
      assignments: [
        existingAssignment(
          '2026-11-16T00:00:00.000Z',
          '2026-11-17T00:00:00.000Z'
        ),
        existingAssignment(
          '2026-11-17T17:00:00.000Z',
          '2026-11-18T17:00:00.000Z'
        )
      ]
    });

    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('48-hour limit'))).toBe(true);
  });

  it('rejects an existing assignment to the target shift', async () => {
    setup({
      existingTarget: { _id: 'existing-assignment' }
    });

    const result = await validateRoster('staff-1', targetShift);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Staff member is already assigned to this shift'
    );
  });

  it('detects an overnight shift overlap', async () => {
    const overnightShift = {
      ...targetShift,
      start: new Date('2026-11-17T22:00:00.000Z'),
      end: new Date('2026-11-18T06:00:00.000Z')
    };

    setup({
      assignments: [
        existingAssignment(
          '2026-11-18T05:00:00.000Z',
          '2026-11-18T13:00:00.000Z'
        )
      ]
    });

    const result = await validateRoster('staff-1', overnightShift);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Staff member has an overlapping assigned shift'
    );
  });
});
