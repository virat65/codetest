import express from 'express';

import {
  createSwapRequest,
  respondToSwapRequest,
  cancelSwapRequest,
  getMySwapRequests
} from '../controllers/swapRequestController.js';

import {
  getAllSwapRequests,
  approveSwapRequest,
  rejectSwapRequest
} from '../controllers/adminSwapController.js';

import {
  getWeeklyDepartmentSummary
} from '../controllers/adminSummaryController.js';

import {
  protect,
  adminOnly
} from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Staff endpoints
router.post('/', createSwapRequest);
router.get('/mine', getMySwapRequests);
router.patch('/:id/respond', respondToSwapRequest);
router.patch('/:id/cancel', cancelSwapRequest);

// Admin endpoints
router.get('/admin', adminOnly, getAllSwapRequests);
router.get('/admin/weekly-summary', adminOnly, getWeeklyDepartmentSummary);
router.patch('/admin/:id/approve', adminOnly, approveSwapRequest);
router.patch('/admin/:id/reject', adminOnly, rejectSwapRequest);

export default router;
