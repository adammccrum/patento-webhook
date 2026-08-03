// PUBLIC ROUTE — deliberately requires no capability. See the authorization
// coverage test, which fails if a route is neither capability-gated nor listed.
/**
 * Health check endpoint - indicates if application is operational
 */

import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/health';

// A probe that is prerendered can never report a problem.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = async () => {
  const health = await getHealth().getHealth();

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
};
