import { Router, Request, Response, NextFunction } from 'express';
import { getFleetBuses } from '../controllers/tripController';

const router = Router();

/**
 * Optional authentication helper: parses token if present, but does not block public fleet overview
 */
const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  next();
};

/**
 * @route   GET /api/fleet
 * @route   GET /api/fleet/buses
 * @desc    Fetch fleet buses and their real-time operational status
 */
router.get('/', optionalAuth, getFleetBuses);
router.get('/buses', optionalAuth, getFleetBuses);

export default router;

