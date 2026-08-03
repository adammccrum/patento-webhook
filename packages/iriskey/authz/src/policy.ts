/**
 * The policy engine.
 *
 * This is the only place in the platform that decides whether an action is
 * allowed. Business logic asks questions here; it never inspects roles itself.
 */

import {
  capabilitiesFor,
  DEFAULT_ROLE,
  toRole,
  type Capability,
  type Role,
} from './capabilities';

/**
 * An authenticated actor, resolved once per request.
 *
 * Holds capabilities rather than roles so that callers cannot be tempted to
 * branch on role names — the roles are kept only for logging and support.
 */
export interface Principal {
  userId: string;
  roles: readonly Role[];
  capabilities: ReadonlySet<Capability>;
}

/** Why a request was refused. Distinguishes "who are you?" from "not allowed". */
export type DenialReason = 'unauthenticated' | 'forbidden';

export class AuthorizationError extends Error {
  constructor(
    readonly reason: DenialReason,
    readonly capability?: Capability
  ) {
    super(reason === 'unauthenticated' ? 'Unauthorized' : 'Forbidden');
    this.name = 'AuthorizationError';
  }

  get status(): number {
    return this.reason === 'unauthenticated' ? 401 : 403;
  }
}

/**
 * Build a Principal from a user id and whatever role names are stored for them.
 *
 * Unknown role names are ignored rather than trusted — a stray row cannot widen
 * access to something the code does not define. Every authenticated user holds
 * the default role implicitly, so a learner needs no Role row to use the product.
 */
export function createPrincipal(userId: string, roleNames: readonly string[] = []): Principal {
  const roles = roleNames
    .map(toRole)
    .filter((r): r is Role => r !== null);

  if (!roles.includes(DEFAULT_ROLE)) {
    roles.push(DEFAULT_ROLE);
  }

  return {
    userId,
    roles,
    capabilities: capabilitiesFor(roles),
  };
}

/** Does this principal hold the capability? The single predicate. */
export function can(principal: Principal | null, capability: Capability): boolean {
  return principal?.capabilities.has(capability) ?? false;
}

/** Throwing form of {@link can}. */
export function authorize(
  principal: Principal | null,
  capability: Capability
): asserts principal is Principal {
  if (!principal) {
    throw new AuthorizationError('unauthenticated');
  }
  if (!principal.capabilities.has(capability)) {
    throw new AuthorizationError('forbidden', capability);
  }
}

/**
 * Ownership, expressed through the policy engine rather than ad hoc in routes.
 *
 * Holding `solution.write` means you may write *your own* solutions. Reaching
 * someone else's additionally requires an elevated capability — support.read or
 * coach.read — so cross-user access is always a deliberate, named grant.
 */
export function canAccessResourceOf(
  principal: Principal | null,
  ownerId: string,
  elevated: Capability[] = ['support.read', 'coach.read']
): boolean {
  if (!principal) return false;
  if (principal.userId === ownerId) return true;
  return elevated.some((c) => principal.capabilities.has(c));
}

export function authorizeResourceOf(
  principal: Principal | null,
  ownerId: string,
  elevated?: Capability[]
): asserts principal is Principal {
  if (!principal) {
    throw new AuthorizationError('unauthenticated');
  }
  if (!canAccessResourceOf(principal, ownerId, elevated)) {
    throw new AuthorizationError('forbidden');
  }
}
