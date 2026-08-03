// PUBLIC ROUTE — deliberately requires no capability. See the authorization
// coverage test, which fails if a route is neither capability-gated nor listed.
/**
 * Liveness check endpoint - indicates if process is running
 */

import { NextResponse } from 'next/server';
import { getHealthCheckService } from '@iriskey/monitoring';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = async () => {
  const healthCheckService = getHealthCheckService();
  const liveness = await healthCheckService.getLiveness();

  return NextResponse.json(liveness, { status: 200 });
};
