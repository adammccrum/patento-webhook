/**
 * Next.js middleware for authentication and security
 */

import { auth } from '@/lib/auth';
import { type NextRequest, NextResponse } from 'next/server';
import { withSecurityHeaders } from '@iriskey/security';

const protectedRoutes = ['/dashboard', '/settings', '/courses', '/missions'];
const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password'];
const healthRoutes = ['/api/health', '/api/ready', '/api/alive'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip security checks for health endpoints
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
