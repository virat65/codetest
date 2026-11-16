
import express from 'express';
import {
  createAssignment,
  getAssignments
} from '../controllers/assignmentController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, adminOnly);

router.post('/', createAssignment);
router.get('/', getAssignments);

export default router;
