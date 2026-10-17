import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';

// Extend Express Request type definition to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware: Verifies the JWT Bearer token in HTTP Authorization header.
 * Attaches decoded user payload to req.user.
 * Returns 401 Unauthorized if token is missing, invalid, or expired.
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header missing. Expected: Authorization: Bearer <token>',
    });
    return;
  }

  // Support both "Bearer <token>" and raw token format if needed
  const parts = authHeader.split(' ');
  const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : undefined;

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authorization format. Expected: Bearer <token>',
    });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }

  req.user = decoded as TokenPayload;
  next();
}

/**
 * Middleware Factory: Role-based access control (RBAC).
 * Ensures that the authenticated user possesses one of the permitted roles.
 * Returns 403 Forbidden if user role is not authorized.
 * 
 * @param allowedRoles List of roles permitted to access the route (e.g. 'driver', 'admin')
 */
export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required prior to role verification',
      });
      return;
    }

    const userRole = req.user.role?.toLowerCase();
    const isAuthorized = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!isAuthorized) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Forbidden: role '${req.user.role}' lacks permission. Required roles: [${allowedRoles.join(', ')}]`,
      });
      return;
    }

    next();
  };
}
