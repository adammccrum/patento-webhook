/**
 * Liveness check endpoint - indicates if process is running
 */

import { NextResponse } from 'next/server';
import { getHealthCheckService } from '@iriskey/monitoring';

export const GET = async () => {
  const healthCheckService = getHealthCheckService();
  const liveness = await healthCheckService.getLiveness();

  return NextResponse.json(liveness, { status: 200 });
};
