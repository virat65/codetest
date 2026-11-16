
import express from 'express';
import { createStaff, getStaff } from '../controllers/staffController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, adminOnly);

router.post('/', createStaff);
router.get('/', getStaff);

export default router;
