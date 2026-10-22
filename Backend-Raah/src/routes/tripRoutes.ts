import { Router } from 'express';
import { startTrip, endTrip } from '../controllers/tripController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/trips/start
 * @desc    Driver initiates a scheduled or live route trip
 * @access  Protected (Driver or Admin only)
 */
router.post('/start', authenticateToken, requireRoles('driver', 'admin'), startTrip);

/**
 * @route   POST /api/trips/end
 * @desc    Driver finishes the active route trip
 * @access  Protected (Driver or Admin only)
 */
router.post('/end', authenticateToken, requireRoles('driver', 'admin'), endTrip);

export default router;
