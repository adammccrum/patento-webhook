/**
 * Cold start guard.
 *
 * A request must never depend on which module happened to be imported first.
 *
 * `initializeAudit(db)` runs as a side effect of loading the app's auth module.
 * `/api/auth/register` does not import that module. On a server that had just
 * started, the first registration therefore hit an uninitialised audit service
 * and returned HTTP 500 — after creating the account, so the learner could not
 * even retry: the second attempt said the email was already registered.
 *
 * It was invisible in development because something always warmed the auth
 * module first. It was found by starting a production server from a clean
 * build against an empty database and registering as the very first action.
 *
 * These tests fail if that shape returns.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

describe('Services do not depend on import order', () => {
  it('the audit service works without anyone having initialised it', () => {
    // Fresh module registry: nothing has imported the auth module, exactly as
    // in the process that served that first registration.
    jest.isolateModules(() => {
      const { getAuditService } = require('@iriskey/audit');
      expect(() => getAuditService()).not.toThrow();
    });
  });

  it('getInstance never throws an initialisation error', () => {
    const src = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'packages', 'iriskey', 'audit', 'src', 'index.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/throw new Error\('AuditService not initialized/);
  });
});

describe('Registration survives a failing audit write', () => {
  const route = readFileSync(
    join(__dirname, '..', '..', 'app', 'api', 'auth', 'register', 'route.ts'),
    'utf8'
  );

  it('does not await the audit log outside a try', () => {
    // The account already exists when this runs. An audit failure must not
    // turn a successful registration into a 500 the learner cannot retry.
    const call = route.indexOf('logUserRegistered');
    expect(call).toBeGreaterThan(-1);

    const before = route.slice(0, call);
    const openTry = before.lastIndexOf('try {');
    const closeTry = before.lastIndexOf('} catch');
    expect(openTry).toBeGreaterThan(closeTry);
  });

  it('still returns the account to the caller', () => {
    expect(route).toMatch(/ApiResponseBuilder\.success/);
  });
});
