import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'raasta_kashmir_super_secret_jwt_key_2026';
const TOKEN_EXPIRES_IN = '7d';

export interface TokenPayload {
  userId: string;
  role: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Generates a signed JWT token valid for 7 days.
 * @param payload Object containing userId, role, and optional email
 * @returns Signed JWT string
 */
export function generateToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: TOKEN_EXPIRES_IN,
  };
  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verifies a JWT token.
 * @param token The bearer JWT string
 * @returns Decoded payload if valid, or null if expired/invalid
 */
export function verifyToken(token: string): JwtPayload | TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return typeof decoded === 'string' ? null : (decoded as JwtPayload & TokenPayload);
  } catch {
    return null;
  }
}
