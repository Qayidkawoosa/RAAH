import { Router } from 'express';
import { logIncident, getTripIncidents, getAllIncidents } from '../controllers/dmsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/dms/incident
 * @desc    Ingest real-time driver monitoring safety violation telemetry
 * @access  Protected (Authenticated device/driver)
 */
router.post('/incident', authenticateToken, logIncident);

/**
 * @route   GET /api/dms/incidents/:tripId
 * @desc    Retrieve all safety incidents for a specific trip
 * @access  Protected
 */
router.get('/incidents/:tripId', authenticateToken, getTripIncidents);

/**
 * @route   GET /api/dms/incidents
 * @desc    Fetch recent fleet-wide DMS incidents
 * @access  Protected
 */
router.get('/incidents', authenticateToken, getAllIncidents);

export default router;
