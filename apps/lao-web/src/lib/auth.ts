/**
 * LAO Authentication utilities
 * Uses IrisKey Platform authentication
 */

import { createAuthConfig } from '@iriskey/auth';
import { getProductId } from '@iriskey/config';
import { initializeAudit } from '@iriskey/audit';
import { db } from './db';
import NextAuth from 'next-auth';
import { headers } from 'next/headers';

// Initialize audit service on module load
initializeAudit(db);

const authConfig = createAuthConfig({
  prisma: db,
  productId: getProductId(),
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
});

export const { auth, signIn, signOut, handlers } = NextAuth(authConfig);

/**
 * Get the current session
 */
export async function getSession() {
  return auth();
}

/**
 * Require authentication
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error('Unauthorized: User not authenticated');
  }

  return session;
}

/**
 * Get authorization header
 */
export function getAuthHeader() {
  return headers().get('authorization');
}
