/**
 * The complete capability vocabulary of the platform.
 *
 * Capabilities are code, not data. That is deliberate: the policy is reviewable
 * in a diff, testable, and cannot drift between environments. Role *assignment*
 * is data (the Role table), so who holds a role can change without a deploy —
 * but what a role can do changes only through review.
 *
 * Naming: `<resource>.<action>`. Add capabilities here and nowhere else.
 */
export const CAPABILITIES = [
  // A learner's own toolbox. Ownership is enforced separately — holding
  // solution.write means "may write your own solutions", never anyone else's.
  'solution.read',
  'solution.write',
  'solution.delete',
  'solution.share',

  // Courses and missions
  'course.read',
  'mission.complete',

  // The learner's own account
  'account.read',
  'account.write',
  'credits.read',

  // Company-wide metrics: the founder dashboards
  'metrics.read',

  // Destructive or platform-wide operations
  'content.seed',
  'data.backfill',
  'user.impersonate',

  // Support tooling: read another learner's state without changing it
  'support.read',

  // Coaching: read a learner's solutions to help them
  'coach.read',

  // Enterprise tenancy
  'tenant.manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * The roles the platform recognises.
 *
 * `learner` is implicit: every authenticated user holds it, whether or not a
 * Role row exists for them. Everything else must be granted explicitly.
 */
export const ROLES = [
  'learner',
  'coach',
  'support',
  'enterprise',
  'admin',
  'founder',
] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = 'learner';

/**
 * Role → capabilities. The single source of truth for what a role may do.
 *
 * Roles are not hierarchical by accident: each role lists its capabilities
 * explicitly, so reading this table tells you exactly what someone can do
 * without tracing an inheritance chain. `admin` and `founder` are broad by
 * intent, and both are visible here rather than implied.
 */
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  learner: [
    'solution.read',
    'solution.write',
    'solution.delete',
    'solution.share',
    'course.read',
    'mission.complete',
    'account.read',
    'account.write',
    'credits.read',
  ],

  // Coaches help learners with their solutions but never act as them.
  coach: [
    'solution.read',
    'solution.write',
    'solution.delete',
    'solution.share',
    'course.read',
    'mission.complete',
    'account.read',
    'account.write',
    'credits.read',
    'coach.read',
  ],

  // Support can look, not touch.
  support: [
    'solution.read',
    'solution.write',
    'solution.delete',
    'solution.share',
    'course.read',
    'mission.complete',
    'account.read',
    'account.write',
    'credits.read',
    'support.read',
  ],

  enterprise: [
    'solution.read',
    'solution.write',
    'solution.delete',
    'solution.share',
    'course.read',
    'mission.complete',
    'account.read',
    'account.write',
    'credits.read',
    'tenant.manage',
  ],

  admin: [
    'solution.read',
    'solution.write',
    'solution.delete',
    'solution.share',
    'course.read',
    'mission.complete',
    'account.read',
    'account.write',
    'credits.read',
    'support.read',
    'content.seed',
    'data.backfill',
  ],

  founder: [
    'solution.read',
    'solution.write',
    'solution.delete',
    'solution.share',
    'course.read',
    'mission.complete',
    'account.read',
    'account.write',
    'credits.read',
    'support.read',
    'coach.read',
    'content.seed',
    'data.backfill',
    'metrics.read',
    'tenant.manage',
  ],
};

/** Narrow an arbitrary string to a known role, or null. */
export function toRole(name: string): Role | null {
  return (ROLES as readonly string[]).includes(name) ? (name as Role) : null;
}

/** Every capability granted by a set of roles. */
export function capabilitiesFor(roles: readonly Role[]): Set<Capability> {
  const granted = new Set<Capability>();
  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role] ?? []) {
      granted.add(capability);
    }
  }
  return granted;
}
