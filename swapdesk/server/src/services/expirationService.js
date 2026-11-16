import SwapRequest from '../models/SwapRequest.js';

const PENDING_STATUSES = ['pending_colleague', 'pending_admin'];

export const expireStartedSwapRequests = async () => {
  const now = new Date();

  const candidates = await SwapRequest.find({
    status: { $in: PENDING_STATUSES }
  })
    .populate({
      path: 'shift',
      match: { start: { $lte: now } },
      select: 'start'
    })
    .select('_id status shift');

  let expiredCount = 0;

  for (const request of candidates) {
    if (!request.shift) continue;

    const result = await SwapRequest.updateOne(
      {
        _id: request._id,
        status: request.status
      },
      {
        $set: { status: 'expired' },
        $push: {
          audit: {
            actor: null,
            actorType: 'system',
            fromStatus: request.status,
            toStatus: 'expired',
            note: 'Automatically expired because the shift started',
            changedAt: now
          }
        }
      }
    );

    if (result.modifiedCount === 1) {
      expiredCount += 1;
    }
  }

  return expiredCount;
};

export const startExpirationJob = () => {
  const run = async () => {
    try {
      const count = await expireStartedSwapRequests();

      if (count > 0) {
        console.log(`Automatically expired ${count} swap request(s)`);
      }
    } catch (error) {
      console.error('Swap request expiration failed:', error.message);
    }
  };

  // Run once at startup, then every 60 seconds.
  run();
  setInterval(run, 60 * 1000);
};
