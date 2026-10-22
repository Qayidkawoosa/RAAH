import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcryptjs with 10 salt rounds.
 * @param plainText The plain text password to hash
 * @returns The hashed password string
 */
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(plainText, salt);
}

/**
 * Compares a plaintext password against an existing bcrypt hash.
 * @param plainText The candidate plain text password
 * @param hashed The stored bcrypt hash
 * @returns Boolean indicating whether passwords match
 */
export async function comparePassword(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}
