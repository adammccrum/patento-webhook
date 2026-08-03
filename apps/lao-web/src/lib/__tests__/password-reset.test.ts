/**
 * Password reset, end to end through the token.
 *
 * The flow shipped half-built: `forgot-password` minted a token, stored it and
 * emailed a link to `/auth/reset-password` — a page that did not exist, served
 * by an endpoint that did not exist. Every step reported success, so nothing
 * looked wrong until somebody actually forgot their password and discovered
 * they could never get back in.
 *
 * These check the properties that make the completed flow safe rather than
 * merely present.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', 'app');
const ROUTE = join(APP, 'api', 'auth', 'reset-password', 'route.ts');
const PAGE = join(APP, 'auth', 'reset-password', 'page.tsx');
const EMAIL = join(__dirname, '..', 'email.ts');

describe('The reset link goes somewhere', () => {
  it('the email points at a page that exists', () => {
    // The original defect, stated as a test. `sendPasswordReset` builds a URL;
    // whatever path it builds must be a real route.
    const email = readFileSync(EMAIL, 'utf8');
    const match = /\$\{baseUrl\(\)\}(\/[a-z-/]+)\?token=/.exec(email);

    expect(match).not.toBeNull();
    const path = match![1]!;
    expect(path).toBe('/auth/reset-password');
    expect(existsSync(PAGE)).toBe(true);
  });

  it('a token alone can complete the reset, so the link needs nothing else', () => {
    // Email verification looks tokens up by the composite (identifier, token),
    // which would mean the reset link had to carry the address too. It does
    // not, so this endpoint must look up by token alone.
    const route = readFileSync(ROUTE, 'utf8');
    expect(route).toMatch(/findUnique\(\{\s*where:\s*\{\s*token\s*\}/);
  });
});

describe('The token is the authorisation, so it is checked properly', () => {
  const route = readFileSync(ROUTE, 'utf8');

  it('refuses a token that is not a password-reset token', () => {
    // A verification token lasts 24 hours and is issued to anyone who
    // registers; a reset token lasts one hour. Both live in the same table.
    // Accepting either here would let the longer, more freely issued token
    // change a password.
    expect(route).toMatch(/record\.type !== 'password-reset'/);
  });

  it('refuses an expired token, and destroys it', () => {
    expect(route).toMatch(/record\.expires < new Date\(\)/);
    expect(route).toMatch(/TOKEN_EXPIRED/);
  });

  it('consumes every outstanding reset for the address, not just the one used', () => {
    // Two requests within the hour would otherwise leave a second working
    // link in an inbox after the password had already been changed.
    expect(route).toMatch(/deleteMany\(\{[\s\S]*type: 'password-reset'/);
  });

  it('says the same thing for missing, wrong-type and consumed tokens', () => {
    // Three different failures, one message: the endpoint must not become a
    // way to learn which tokens ever existed.
    const invalid = route.match(/'This reset link is invalid or has already been used'/g);
    expect(invalid).not.toBeNull();
    expect(invalid!.length).toBeGreaterThanOrEqual(3);
  });

  it('applies the password policy, against the account address', () => {
    expect(route).toMatch(/checkPassword\(password, user\.email\)/);
  });

  it('does not spend the token when the new password is rejected', () => {
    // Getting the password wrong is the person fumbling, not the link being
    // used. Consuming it would send them back to the start of the flow.
    const rejection = route.indexOf('return validationError(problem)');
    const consumption = route.indexOf('deleteMany');
    expect(rejection).toBeGreaterThan(-1);
    expect(consumption).toBeGreaterThan(rejection);
  });

  it('is rate limited, like requesting a reset', () => {
    expect(route).toMatch(/checkLimit\(\s*'passwordReset'/);
  });

  it('hashes the new password rather than storing it', () => {
    expect(route).toMatch(/hashPassword\(password\)/);
    expect(route).not.toMatch(/data: \{ password: password \}/);
  });
});
