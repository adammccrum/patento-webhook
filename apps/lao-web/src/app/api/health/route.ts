/**
 * Health check endpoint - indicates if application is operational
 */

import { NextResponse } from 'next/server';
import { getHealthCheckService } from '@iriskey/monitoring';

export const GET = async () => {
  const healthCheckService = getHealthCheckService();
  const health = await healthCheckService.getHealth();

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
};
