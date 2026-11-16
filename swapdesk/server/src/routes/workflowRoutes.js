import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getMyUpcomingShifts,
  getEligibleColleagues
} from '../controllers/workflowController.js';

const router = express.Router();

router.use(protect);

router.get('/my-shifts', getMyUpcomingShifts);
router.get('/eligible', getEligibleColleagues);

export default router;
