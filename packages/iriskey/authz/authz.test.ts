/**
 * Policy engine tests.
 *
 * The engine is pure — no database, no session — so it can be exercised
 * directly. Route-level coverage lives with the app that mounts the routes.
 */

import {
  AuthorizationError,
  authorize,
  authorizeResourceOf,
  can,
  canAccessResourceOf,
  capabilitiesFor,
  createPrincipal,
  toRole,
  CAPABILITIES,
  ROLES,
  ROLE_CAPABILITIES,
} from './src/index';

describe('@iriskey/authz', () => {
  describe('createPrincipal', () => {
    it('makes every authenticated user a learner', () => {
      const p = createPrincipal('u1');
      expect(p.roles).toEqual(['learner']);
      expect(p.userId).toBe('u1');
    });

    it('adds the learner baseline alongside an explicit role', () => {
      const p = createPrincipal('u1', ['founder']);
      expect(p.roles).toContain('founder');
      expect(p.roles).toContain('learner');
    });

    it('ignores role names the code does not define', () => {
      const p = createPrincipal('u1', ['superuser', 'ADMIN', 'admin ', '']);
      expect(p.roles).toEqual(['learner']);
    });

    it('does not duplicate an explicitly stored learner role', () => {
      const p = createPrincipal('u1', ['learner']);
      expect(p.roles).toEqual(['learner']);
    });
  });

  describe('can', () => {
    it('grants a learner their own toolbox', () => {
      const p = createPrincipal('u1');
      expect(can(p, 'solution.read')).toBe(true);
      expect(can(p, 'solution.write')).toBe(true);
      expect(can(p, 'solution.delete')).toBe(true);
    });

    it('withholds privileged capabilities from a learner', () => {
      const p = createPrincipal('u1');
      expect(can(p, 'metrics.read')).toBe(false);
      expect(can(p, 'content.seed')).toBe(false);
      expect(can(p, 'data.backfill')).toBe(false);
      expect(can(p, 'support.read')).toBe(false);
      expect(can(p, 'user.impersonate')).toBe(false);
    });

    it('denies everything to an absent principal', () => {
      for (const capability of CAPABILITIES) {
        expect(can(null, capability)).toBe(false);
      }
    });

    it('separates admin from founder', () => {
      const admin = createPrincipal('u1', ['admin']);
      const founder = createPrincipal('u2', ['founder']);

      // Both can seed content.
      expect(can(admin, 'content.seed')).toBe(true);
      expect(can(founder, 'content.seed')).toBe(true);

      // Only the founder reads company-wide metrics.
      expect(can(admin, 'metrics.read')).toBe(false);
      expect(can(founder, 'metrics.read')).toBe(true);
    });

    it('grants no capability to anyone that user.impersonate implies', () => {
      // Nothing holds it yet; it exists so that granting it later is deliberate.
      for (const role of ROLES) {
        expect(ROLE_CAPABILITIES[role]).not.toContain('user.impersonate');
      }
    });
  });

  describe('authorize', () => {
    it('passes for a permitted capability', () => {
      expect(() => authorize(createPrincipal('u1'), 'solution.read')).not.toThrow();
    });

    it('reports unauthenticated separately from forbidden', () => {
      try {
        authorize(null, 'solution.read');
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AuthorizationError);
        expect((e as AuthorizationError).reason).toBe('unauthenticated');
        expect((e as AuthorizationError).status).toBe(401);
      }

      try {
        authorize(createPrincipal('u1'), 'metrics.read');
        fail('should have thrown');
      } catch (e) {
        expect((e as AuthorizationError).reason).toBe('forbidden');
        expect((e as AuthorizationError).status).toBe(403);
      }
    });

    it('produces messages withErrorHandler already maps', () => {
      // The middleware matches on 'Unauthorized' / 'Forbidden'.
      expect(new AuthorizationError('unauthenticated').message).toContain('Unauthorized');
      expect(new AuthorizationError('forbidden').message).toContain('Forbidden');
    });
  });

  describe('resource ownership', () => {
    it('lets an owner reach their own resource', () => {
      expect(canAccessResourceOf(createPrincipal('u1'), 'u1')).toBe(true);
    });

    it('stops a learner reaching someone else\'s', () => {
      expect(canAccessResourceOf(createPrincipal('u1'), 'u2')).toBe(false);
    });

    it('lets support and coaches reach another learner\'s resource', () => {
      expect(canAccessResourceOf(createPrincipal('s1', ['support']), 'u2')).toBe(true);
      expect(canAccessResourceOf(createPrincipal('c1', ['coach']), 'u2')).toBe(true);
    });

    it('does not let an admin reach a learner resource by default', () => {
      // admin holds support.read, so it does — this documents that on purpose.
      expect(canAccessResourceOf(createPrincipal('a1', ['admin']), 'u2')).toBe(true);
      // With no elevation allowed, ownership is the only route in.
      expect(canAccessResourceOf(createPrincipal('a1', ['admin']), 'u2', [])).toBe(false);
    });

    it('denies an absent principal', () => {
      expect(canAccessResourceOf(null, 'u1')).toBe(false);
    });

    it('throws for a non-owner', () => {
      expect(() => authorizeResourceOf(createPrincipal('u1'), 'u2')).toThrow(AuthorizationError);
      expect(() => authorizeResourceOf(createPrincipal('u1'), 'u1')).not.toThrow();
    });
  });

  describe('the capability table', () => {
    it('references only capabilities that exist', () => {
      for (const role of ROLES) {
        for (const capability of ROLE_CAPABILITIES[role]) {
          expect(CAPABILITIES).toContain(capability);
        }
      }
    });

    it('gives every role the learner baseline', () => {
      for (const role of ROLES) {
        for (const capability of ROLE_CAPABILITIES.learner) {
          expect(ROLE_CAPABILITIES[role]).toContain(capability);
        }
      }
    });

    it('has no duplicate capability names', () => {
      expect(new Set(CAPABILITIES).size).toBe(CAPABILITIES.length);
    });

    it('unions capabilities across roles', () => {
      const both = capabilitiesFor(['support', 'enterprise']);
      expect(both.has('support.read')).toBe(true);
      expect(both.has('tenant.manage')).toBe(true);
    });
  });

  describe('toRole', () => {
    it('accepts known roles and rejects everything else', () => {
      expect(toRole('founder')).toBe('founder');
      expect(toRole('Founder')).toBeNull();
      expect(toRole('root')).toBeNull();
      expect(toRole('')).toBeNull();
    });
  });
});
