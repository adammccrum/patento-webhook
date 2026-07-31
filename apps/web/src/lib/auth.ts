/**
 * Authentication utilities for Next.js
 */

import { authConfig } from '@lao/auth';
import NextAuth from 'next-auth';
import { headers } from 'next/headers';

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
