/**
 * Wires the platform policy engine to LAO's session and database.
 *
 * This is the only file in the app that knows how a principal is discovered.
 * Everything else declares a capability and lets the engine decide.
 */

import {
  authorize,
  configureAuthorization,
  createPrincipal,
  type Capability,
  type Principal,
} from '@iriskey/authz';
import { getSession } from './auth';
import { db } from './db';

/**
 * Resolve the current request's principal.
 *
 * Roles live in the database so they can be granted without a deploy; what a
 * role *means* lives in @iriskey/authz so it can only change under review.
 */
export async function getPrincipal(): Promise<Principal | null> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { roles: { select: { name: true } } },
  });

  // A user row that has vanished mid-session is not a principal.
  if (!user) return null;

  return createPrincipal(
    userId,
    user.roles.map((r) => r.name)
  );
}

// Installed on module load; route modules import from here, so this runs before
// any handler does.
configureAuthorization(getPrincipal);

/**
 * Throwing form, for routes already wrapped in `withErrorHandler` (which needs
 * to supply its own request context). Same policy engine, same declaration —
 * it just reads as a statement rather than a wrapper.
 */
export async function requireCapability(capability: Capability): Promise<Principal> {
  const principal = await getPrincipal();
  authorize(principal, capability);
  return principal;
}

export {
  withCapability,
  publicRoute,
  authorizeResourceOf,
  canAccessResourceOf,
  can,
} from '@iriskey/authz';
export type { Capability, Principal } from '@iriskey/authz';
