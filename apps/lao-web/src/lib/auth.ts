/**
 * LAO Authentication utilities
 * Uses IrisKey Platform authentication
 */

import { createAuthConfig } from '@iriskey/auth';
import { PrismaClient } from '@prisma/client';
import NextAuth from 'next-auth';
import { headers } from 'next/headers';

const prisma = new PrismaClient();

const authConfig = createAuthConfig({
  prisma,
  productId: 'lao',
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
    callbackUrl: '/dashboard',
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
