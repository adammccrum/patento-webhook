/**
 * Next.js middleware for authentication and security
 */

import { auth } from '@/lib/auth';
import { type NextRequest, NextResponse } from 'next/server';
import { withSecurityHeaders } from '@iriskey/security';

// Every signed-in surface. These must match real route paths — earlier entries
// read '/courses' and '/missions', which no page ever served, so those pages
// were never actually protected here.
// Deliberately public: '/', '/auth/*', '/s/[shareId]' (shared solutions).
const protectedRoutes = [
  '/dashboard',
  '/settings',
  '/profile',
  '/credits',
  '/course',
  '/mission',
  '/solution',
  '/solutions',
  '/build',
  '/coach',
  '/discover',
  '/reflection',
  '/transformations',
  '/founder',
];
const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password'];
const healthRoutes = ['/api/health', '/api/ready', '/api/alive'];

const secure = withSecurityHeaders();

/**
 * Every response leaves through here, so headers are applied once, at the end,
 * rather than remembered at each return. Previously `withSecurityHeaders` was
 * imported and never called, and the app shipped with no CSP, HSTS or
 * X-Frame-Options at all.
 */
export async function middleware(request: NextRequest) {
  return secure(await route(request));
}

async function route(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  // Probes must answer even when auth is unavailable.
  if (healthRoutes.some((route) => path.startsWith(route))) {
    return NextResponse.next();
  }

  const session = await auth();

  // Allow public routes
  if (publicRoutes.includes(path)) {
    if (session?.user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protect dashboard and other routes
  if (protectedRoutes.some((route) => path.startsWith(route))) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
