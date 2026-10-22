import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account (Driver, Parent, School, etc.)
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user credentials & obtain JWT bearer token
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Fetch authenticated user's profile
 * @access  Protected (Requires valid JWT Bearer token)
 */
router.get('/me', authenticateToken, getMe);

export default router;
