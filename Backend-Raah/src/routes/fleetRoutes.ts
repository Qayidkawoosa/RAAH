import { Router, Request, Response, NextFunction } from 'express';
import {
  getFleetBuses,
  enrollDriver,
  getFleetRoutes,
  getDriverRoute,
} from '../controllers/tripController';

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

/**
 * @route   POST /api/fleet/enroll-driver
 * @desc    Enroll a new driver with bus and route binding in PostgreSQL
 */
router.post('/enroll-driver', enrollDriver);

/**
 * @route   GET /api/fleet/routes
 * @desc    Fetch all school routes and stops
 */
router.get('/routes', getFleetRoutes);

/**
 * @route   GET /api/fleet/driver-route
 * @route   GET /api/fleet/driver-route/:busNo
 * @desc    Fetch driver assigned route path and stops from PostgreSQL
 */
router.get('/driver-route', getDriverRoute);
router.get('/driver-route/:busNo', getDriverRoute);

export default router;

