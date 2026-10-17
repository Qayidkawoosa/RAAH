import { Router } from 'express';
import { getFleetBuses } from '../controllers/tripController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/fleet/buses
 * @desc    Fetch fleet buses and their real-time operational status
 * @access  Protected (Authenticated users)
 */
router.get('/buses', authenticateToken, getFleetBuses);

export default router;
