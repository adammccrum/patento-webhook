/**
 * Password hashing and verification utilities
 */

import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcrypt
 * @param password - The plaintext password to hash
 * @returns The bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a bcrypt hash
 * @param password - The plaintext password to verify
 * @param hash - The bcrypt hash to verify against
 * @returns True if password matches hash, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a random token for email verification
 * @param length - Length of the token (default 32)
 * @returns A random hex token
 */
export function generateVerificationToken(length: number = 32): string {
  return require('crypto').randomBytes(length).toString('hex');
}
