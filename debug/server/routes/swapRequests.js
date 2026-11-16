import express from 'express';

import {
  protect,
  adminOnly
} from '../../../swapdesk/server/src/middleware/authMiddleware.js';

import {
  listRequests,
  approveRequest,
  cancelRequest
} from '../controllers/swapRequestController.js';

const router = express.Router();

router.use(protect);

router.get('/swap-requests', adminOnly, listRequests);
router.post('/swap-requests/:id/approve', adminOnly, approveRequest);
router.post('/swap-requests/:id/cancel', cancelRequest);

export default router;
