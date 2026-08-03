/**
 * Environment loading for the standalone database scripts.
 *
 * The app gets its configuration from Next.js, which loads `.env` for us.
 * `seed.ts` and `grant-role.ts` run under plain `tsx`, which loads nothing —
 * so on a clean checkout they failed with "Environment variable not found:
 * DATABASE_URL" while appearing, from the package.json, to be ready to run.
 *
 * A real deployment sets DATABASE_URL in the process environment. That always
 * wins. This is only the fallback for running the same commands by hand.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Populate `process.env` from the nearest `.env` above this package, without
 * overwriting anything already set.
 */
export function loadEnv(): void {
  let dir = resolve(__dirname);

  for (let depth = 0; depth < 8; depth++) {
    const file = join(dir, '.env');
    if (existsSync(file)) {
      apply(readFileSync(file, 'utf8'));
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

function apply(contents: string): void {
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    // An explicit environment variable is the operator's intent. Never
    // override it with a file that happens to be lying around.
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/**
 * Fail with an instruction rather than a stack trace. A missing connection
 * string is a setup mistake, not a bug, and the message should say so.
 */
export function requireDatabaseUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set, and no .env was found above ' +
        'packages/iriskey/database. Set it in the environment, or copy ' +
        '.env.example to .env at the repository root.'
    );
  }
  return url;
}
