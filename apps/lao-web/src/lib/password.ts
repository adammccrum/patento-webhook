/**
 * Password policy.
 *
 * Length does most of the work, so the floor is 12 rather than 8 and long
 * passphrases are welcome. The rest rejects the passwords that actually get
 * broken: dictionary words, repeated characters, and the handful of strings
 * that top every breach list.
 *
 * Deliberately not a character-class maze. Forcing a symbol produces
 * "Password1!" — which is on the list below.
 */

import { z } from 'zod';

/**
 * The passwords people actually choose. Not a substitute for a breach-corpus
 * check (Have I Been Pwned's k-anonymity API is the right answer once there is
 * an outbound allowance for it), but it removes the worst offenders today.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssword', 'p@ssw0rd',
  'qwertyuiop', 'qwerty123', '1234567890', '123456789', '12345678',
  'iloveyou', 'welcome1', 'welcome123', 'admin123', 'letmein1', 'letmein123',
  'monkey123', 'football1', 'baseball1', 'trustno1', 'sunshine1',
  'princess1', 'dragon123', 'master123', 'shadow123', 'superman1',
  'abc12345', 'changeme', 'changeme123', 'secret123', 'default123',
  'lao12345', 'laoacademy', 'academy123',
]);

export const MIN_LENGTH = 12;

export function checkPassword(password: string, email?: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters. A short phrase works well.`;
  }

  if (password.length > 200) {
    // Bcrypt truncates beyond 72 bytes anyway; this is a denial-of-service guard.
    return 'Password must be 200 characters or fewer.';
  }

  const lower = password.toLowerCase();

  if (COMMON.has(lower)) {
    return 'That password is too common. Try a short phrase only you would think of.';
  }

  // "passwordpassword" and friends.
  for (const common of COMMON) {
    if (common.length >= 6 && lower.replace(/[^a-z0-9]/g, '') === common.repeat(2)) {
      return 'That password is too predictable. Try a short phrase only you would think of.';
    }
  }

  if (/^(.)\1+$/.test(password)) {
    return 'That password is a single repeated character.';
  }

  // Sequences: abcdefghijkl, 123456789012
  if (isSequential(lower)) {
    return 'That password is a simple sequence. Try a short phrase instead.';
  }

  if (email) {
    const local = email.split('@')[0]?.toLowerCase();
    if (local && local.length >= 3 && lower.includes(local)) {
      return 'Password must not contain your email address.';
    }
  }

  // A passphrase of distinct words is strong; a long run of one character is not.
  if (new Set(password).size < 5) {
    return 'That password repeats too few characters. Try a short phrase instead.';
  }

  return null;
}

function isSequential(value: string): boolean {
  if (value.length < MIN_LENGTH) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < value.length; i++) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
  }
  return ascending || descending;
}

/** Zod field for use in request schemas. */
export const passwordField = z
  .string()
  .superRefine((value, ctx) => {
    const problem = checkPassword(value);
    if (problem) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    }
  });
