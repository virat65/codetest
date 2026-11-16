import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  swapFindOne: vi.fn(),
  assignmentFindOne: vi.fn(),
  findById: vi.fn(),
  findOneAndUpdate: vi.fn(),
  countDocuments: vi.fn(),
  deleteOne: vi.fn(),
  create: vi.fn(),
  staffFindOneAndUpdate: vi.fn(),
  shiftFindById: vi.fn(),
  validateRoster: vi.fn(),
  startSession: vi.fn()
}));

vi.mock('../../../swapdesk/server/src/models/SwapRequest.js', () => ({
  default: {
    find: mocks.find,
    findOne: mocks.swapFindOne,
    findById: mocks.findById,
    findOneAndUpdate: mocks.findOneAndUpdate,
    countDocuments: mocks.countDocuments,
    schema: {
      path: () => ({
        enumValues: [
          'pending_colleague',
          'pending_admin',
          'approved',
          'declined',
          'rejected',
          'cancelled',
          'expired'
        ]
      })
    }
  }
}));

vi.mock('../../../swapdesk/server/src/models/Shift.js', () => ({
  default: { findById: mocks.shiftFindById }
}));

vi.mock('../../../swapdesk/server/src/models/Assignment.js', () => ({
  default: {
    findOne: mocks.assignmentFindOne,
    deleteOne: mocks.deleteOne,
    create: mocks.create
  }
}));

vi.mock('../../../swapdesk/server/src/models/Staff.js', () => ({
  default: { findOneAndUpdate: mocks.staffFindOneAndUpdate }
}));

vi.mock('../../../swapdesk/server/src/services/rosterValidation.js', () => ({
  validateRoster: mocks.validateRoster
}));

import {
  listRequests,
  approveRequest,
  cancelRequest
} from '../controllers/swapRequestController.js';

const makeResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  return res;
};

const objectId = () => new mongoose.Types.ObjectId();

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(mongoose, 'startSession').mockImplementation(mocks.startSession);
});

describe('listRequests', () => {
  it('rejects unapproved query filters instead of passing them to MongoDB', async () => {
    const req = {
      query: { status: 'pending_admin', '$where': 'true' }
    };
    const res = makeResponse();

    await listRequests(req, res);

    expect(res.statusCode).toBe(400);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('caps page size and uses stable descending pagination', async () => {
    const query = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([])
    };

    mocks.find.mockReturnValue(query);

    const req = { query: { limit: '500' } };
    const res = makeResponse();

    await listRequests(req, res);

    expect(mocks.find).toHaveBeenCalledWith({});
    expect(query.sort).toHaveBeenCalledWith({
      createdAt: -1,
      _id: -1
    });
    expect(query.limit).toHaveBeenCalledWith(101);
    expect(res.statusCode).toBe(200);
  });
});

describe('cancelRequest', () => {
  it('compares requester ObjectIds safely and rejects another user', async () => {
    const requesterId = objectId();
    const otherUserId = objectId();

    mocks.findById.mockResolvedValue({
      requester: requesterId,
      status: 'pending_colleague'
    });

    const req = {
      params: { id: objectId().toString() },
      user: { _id: otherUserId }
    };
    const res = makeResponse();

    await cancelRequest(req, res);

    expect(res.statusCode).toBe(403);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('records the real previous status in the cancellation audit', async () => {
    const requesterId = objectId();
    const requestId = objectId();

    mocks.findById.mockResolvedValue({
      _id: requestId,
      requester: requesterId,
      status: 'pending_admin'
    });

    mocks.findOneAndUpdate.mockResolvedValue({
      _id: requestId,
      status: 'cancelled'
    });

    const req = {
      params: { id: requestId.toString() },
      user: { _id: requesterId }
    };
    const res = makeResponse();

    await cancelRequest(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ['pending_colleague', 'pending_admin'] }
      }),
      expect.objectContaining({
        $push: {
          audit: expect.objectContaining({
            fromStatus: 'pending_admin',
            toStatus: 'cancelled'
          })
        }
      }),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });
});

describe('approveRequest concurrency', () => {
  it('allows only one of two concurrent approvals to transfer the assignment', async () => {
    const requestId = objectId();
    const requesterId = objectId();
    const colleagueId = objectId();
    const shiftId = objectId();
    const adminId = objectId();

    let currentStatus = 'pending_admin';
    let transactionQueue = Promise.resolve();
    let transferCount = 0;

    const request = {
      _id: requestId,
      requester: requesterId,
      colleague: colleagueId,
      shift: shiftId,
      status: 'pending_admin',
      audit: [],
      async save() {
        currentStatus = this.status;
        return this;
      }
    };

    mocks.startSession.mockResolvedValue({
      async withTransaction(callback) {
        let release;
        const previous = transactionQueue;

        transactionQueue = new Promise((resolve) => {
          release = resolve;
        });

        await previous;

        try {
          await callback();
        } finally {
          release();
        }
      },
      async endSession() {}
    });

    mocks.swapFindOne.mockImplementation(() => ({
      session: async () => (
        currentStatus === 'pending_admin' ? request : null
      )
    }));

    mocks.shiftFindById.mockReturnValue({
      session: async () => ({
        _id: shiftId,
        start: new Date(Date.now() + 86400000),
        end: new Date(Date.now() + 90000000)
      })
    });

    mocks.assignmentFindOne.mockReturnValue({
      session: async () => ({ _id: objectId() })
    });

    mocks.staffFindOneAndUpdate.mockResolvedValue({
      _id: colleagueId
    });

    mocks.validateRoster.mockResolvedValue({
      valid: true,
      errors: []
    });

    mocks.swapFindOne.mockImplementation((filter) => {
      if (filter?.staff && filter?.shift) {
        return {
          session: async () => ({ _id: objectId() })
        };
      }

      return {
        session: async () => (
          currentStatus === 'pending_admin' ? request : null
        )
      };
    });

    mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mocks.create.mockImplementation(async () => {
      transferCount += 1;
      return [];
    });

    const makeRequest = () => ({
      params: { id: requestId.toString() },
      body: {},
      user: { _id: adminId }
    });

    const firstResponse = makeResponse();
    const secondResponse = makeResponse();

    await Promise.all([
      approveRequest(makeRequest(), firstResponse),
      approveRequest(makeRequest(), secondResponse)
    ]);

    expect(
      [firstResponse.statusCode, secondResponse.statusCode].sort()
    ).toEqual([200, 409]);

    expect(transferCount).toBe(1);
    expect(mocks.validateRoster).toHaveBeenCalledTimes(1);
  });
});
