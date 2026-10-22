import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authenticateToken, requireRoles } from './middleware/auth';
import { generateToken } from './utils/jwt';
import { prisma } from './config/db';
import { setupTelemetrySockets } from './sockets/telemetry';
import authRoutes from './routes/authRoutes';
import tripRoutes from './routes/tripRoutes';
import fleetRoutes from './routes/fleetRoutes';
import dmsRoutes from './routes/dmsRoutes';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Core Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/dms', dmsRoutes);

// Root welcome route
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Raasta Kashmir Backend API',
    status: 'running',
    healthCheck: '/api/health',
    timestamp: Date.now(),
  });
});

// Health Check Route (handles /api/health, /health, and common typos)
const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);
app.get('/api/helth', healthHandler);

// ============================================================================
// Live Testing Endpoints for Task 2.3 Middleware
// ============================================================================

// 1. Generate live sample tokens for testing
app.get('/api/test/sample-tokens', (_req: Request, res: Response) => {
  const driverToken = generateToken({
    userId: 'driver_srinagar_01',
    role: 'driver',
    email: 'driver1@kashmirschool.edu',
  });
  const parentToken = generateToken({
    userId: 'parent_anantnag_02',
    role: 'parent',
    email: 'parent2@kashmirschool.edu',
  });

  res.status(200).json({
    status: 'ok',
    message: 'Sample test tokens generated for Task 2.3 verification',
    tokens: {
      driverToken,
      parentToken,
    },
    testCommands: {
      unauthorized: `curl http://localhost:${PORT}/api/test/protected`,
      protectedWithDriver: `curl -H "Authorization: Bearer <driverToken>" http://localhost:${PORT}/api/test/protected`,
      driverOnlyWithDriver: `curl -H "Authorization: Bearer <driverToken>" http://localhost:${PORT}/api/test/driver-only`,
      driverOnlyWithParentForbidden: `curl -H "Authorization: Bearer <parentToken>" http://localhost:${PORT}/api/test/driver-only`,
    },
  });
});

// 2. Protected route: accessible by ANY valid authenticated user
app.get('/api/test/protected', authenticateToken, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Access granted! authenticateToken middleware verified your JWT successfully.',
    user: req.user,
  });
});

// 3. Role-protected route: accessible by DRIVER role only
app.get('/api/test/driver-only', authenticateToken, requireRoles('driver'), (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Access granted! requireRoles("driver") authorized your role.',
    user: req.user,
  });
});

// Create Node HTTP Server and attach Socket.io
const server = http.createServer(app);
export const io = setupTelemetrySockets(server);

// Start Express + Socket Server & Verify Database Connection
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, async () => {
    console.log(`🚀 Raasta Kashmir Backend running on port ${PORT}`);
    console.log(`🩺 Health check endpoint: http://localhost:${PORT}/api/health`);
    console.log(`📡 Real-Time Telemetry Socket.io server active!`);
    // Verify PostgreSQL connection
    try {
      await prisma.$connect();
      const schoolCount = await prisma.school.count();
      console.log(`✅ Connected to PostgreSQL Database! (${schoolCount} Schools online)`);
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error);
    }
  });
}

export default app;
