// PUBLIC ROUTE — deliberately requires no capability. See the authorization
// coverage test, which fails if a route is neither capability-gated nor listed.
/**
 * Readiness check endpoint - indicates if application can accept traffic
 */

import { NextResponse } from 'next/server';
import { getHealthCheckService } from '@iriskey/monitoring';

export const GET = async () => {
  const healthCheckService = getHealthCheckService();
  const readiness = await healthCheckService.getReadiness();

  const statusCode = readiness.ready ? 200 : 503;
  return NextResponse.json(readiness, { status: statusCode });
};
