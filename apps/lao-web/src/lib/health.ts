/**
 * Registers what "healthy" actually means for LAO.
 *
 * Without this the health service reports `checks: {}` and answers "healthy"
 * unconditionally — which it did, in production shape, even with the database
 * stopped. A probe that cannot fail is worse than no probe: a load balancer
 * keeps sending traffic to a dead instance.
 */

import { getHealthCheckService } from '@iriskey/monitoring';
import { db } from './db';

let registered = false;

export function getHealth() {
  const service = getHealthCheckService();

  if (!registered) {
    registered = true;

    // The database is the only hard dependency. If it is unreachable, nothing
    // a learner does will work, so the instance should be pulled from rotation.
    service.registerCheck('database', async () => {
      try {
        await db.$queryRaw`SELECT 1`;
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'unreachable',
        };
      }
    });
  }

  return service;
}
