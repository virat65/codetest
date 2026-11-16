
import express from 'express';
import { createShift, getShifts } from '../controllers/shiftController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, adminOnly);

router.post('/', createShift);
router.get('/', getShifts);

export default router;
