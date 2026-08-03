/**
 * Authorization coverage.
 *
 * Every API route must either declare a capability or appear on the public
 * allowlist below. This test is the enforcement: a new route that forgets to
 * declare one fails here rather than shipping open.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { CAPABILITIES, ROLE_CAPABILITIES, ROLES, createPrincipal, can } from '@iriskey/authz';

const API_DIR = join(__dirname, '..', '..', 'app', 'api');

/**
 * Routes that are deliberately reachable without a capability, each with the
 * reason. Adding to this list should be a conscious review decision.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  'alive/route.ts': 'liveness probe',
  'health/route.ts': 'health probe',
  'ready/route.ts': 'readiness probe',
  'auth/[...nextauth]/route.ts': 'NextAuth handlers',
  'auth/register/route.ts': 'sign-up must work before a principal exists',
  'auth/forgot-password/route.ts': 'password reset must work when locked out',
  'auth/reset-password/route.ts': 'completing a reset must work when locked out; the token is the authorisation',
  'auth/verify-email/route.ts': 'email verification is reached from a link',
  'shared/[shareId]/route.ts': 'read-only shared solution, by design',
};

function findRoutes(dir: string, base = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      found.push(...findRoutes(full, rel));
    } else if (entry === 'route.ts') {
      found.push(rel);
    }
  }
  return found;
}

describe('Authorization coverage', () => {
  const routes = findRoutes(API_DIR);

  it('finds the API routes', () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it.each(routes)('%s declares a capability or is explicitly public', (route) => {
    const source = readFileSync(join(API_DIR, route), 'utf8');
    const gated = /withCapability\(|requireCapability\(/.test(source);
    const isPublic = route in PUBLIC_ROUTES;

    if (!gated && !isPublic) {
      throw new Error(
        `${route} neither declares a capability nor is on the public allowlist. ` +
          `Wrap it with withCapability()/requireCapability(), or add it to PUBLIC_ROUTES with a reason.`
      );
    }

    // A route cannot be both — that would mean the allowlist is stale.
    expect(gated && isPublic).toBe(false);
  });

  it('every capability named in a route exists in the vocabulary', () => {
    const used = new Set<string>();
    for (const route of routes) {
      const source = readFileSync(join(API_DIR, route), 'utf8');
      for (const m of source.matchAll(/(?:withCapability|requireCapability)\(\s*'([^']+)'/g)) {
        used.add(m[1]!);
      }
    }

    expect(used.size).toBeGreaterThan(0);
    for (const capability of used) {
      expect(CAPABILITIES).toContain(capability as any);
    }
  });

  it('no route inspects a role directly', () => {
    for (const route of routes) {
      const source = readFileSync(join(API_DIR, route), 'utf8');
      // Business logic asks the policy engine; it never branches on a role name.
      expect(source).not.toMatch(/principal\.roles/);
      expect(source).not.toMatch(/role\s*===\s*['"]/);
    }
  });

  it('the public allowlist has no stale entries', () => {
    for (const route of Object.keys(PUBLIC_ROUTES)) {
      expect(routes).toContain(route);
    }
  });
});

describe('Policy engine', () => {
  it('treats every authenticated user as a learner', () => {
    const p = createPrincipal('u1', []);
    expect(p.roles).toContain('learner');
    expect(can(p, 'solution.write')).toBe(true);
  });

  it('does not grant privileged capabilities to a plain learner', () => {
    const learner = createPrincipal('u1', []);
    expect(can(learner, 'metrics.read')).toBe(false);
    expect(can(learner, 'content.seed')).toBe(false);
    expect(can(learner, 'data.backfill')).toBe(false);
    expect(can(learner, 'support.read')).toBe(false);
  });

  it('grants founder capabilities to a founder', () => {
    const founder = createPrincipal('u1', ['founder']);
    expect(can(founder, 'metrics.read')).toBe(true);
    expect(can(founder, 'content.seed')).toBe(true);
  });

  it('lets an admin seed content but not read company metrics', () => {
    const admin = createPrincipal('u1', ['admin']);
    expect(can(admin, 'content.seed')).toBe(true);
    expect(can(admin, 'metrics.read')).toBe(false);
  });

  it('ignores unknown role names rather than trusting them', () => {
    const p = createPrincipal('u1', ['superuser', 'root', 'founder ']);
    expect(p.roles).toEqual(['learner']);
    expect(can(p, 'metrics.read')).toBe(false);
  });

  it('denies everything to an absent principal', () => {
    for (const capability of CAPABILITIES) {
      expect(can(null, capability)).toBe(false);
    }
  });

  it('only references capabilities that exist', () => {
    for (const role of ROLES) {
      for (const capability of ROLE_CAPABILITIES[role]) {
        expect(CAPABILITIES).toContain(capability);
      }
    }
  });

  it('gives every role the baseline a learner has', () => {
    const baseline = ROLE_CAPABILITIES.learner;
    for (const role of ROLES) {
      for (const capability of baseline) {
        expect(ROLE_CAPABILITIES[role]).toContain(capability);
      }
    }
  });
});
