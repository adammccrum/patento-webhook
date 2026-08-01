// PUBLIC ROUTE — deliberately requires no capability. See the authorization
// coverage test, which fails if a route is neither capability-gated nor listed.
/**
 * Next Auth API route handler
 */

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
