/**
 * Password reset and email verification, end to end against a running server.
 *
 * Real HTTP against a production build, a real PostgreSQL, real tokens read
 * from the database. Nothing is stubbed: the only thing this does that a
 * learner would not is read the token out of the table instead of an inbox,
 * because no transport is configured in the verification environment.
 *
 * Runs in phases, because the reset endpoints share a rate limit of three
 * requests per hour per address — which is the correct setting and must not be
 * loosened to make a test convenient. The first attempt at this script spent
 * the budget and then read the resulting 429s as if they were the endpoint
 * refusing a spent token. They were not. A check that passes for the wrong
 * reason is worse than one that fails.
 *
 * The in-memory limiter resets with the process, so each phase gets a fresh
 * server:
 *
 *   scripts/verify-email-flows.sh
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const STATE = '/tmp/lao-email-flow-state.json';
const db = new PrismaClient();

let failures = 0;
let checks = 0;

function check(ok: boolean, description: string, detail = ''): void {
  checks += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${description}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

/** A 429 means the rate limiter answered, not the endpoint. Never a pass. */
function notRateLimited(status: number, description: string): boolean {
  if (status === 429) {
    console.log(` FAIL  ${description} — HTTP 429, the rate limiter answered, so this proved nothing`);
    failures += 1;
    checks += 1;
    return false;
  }
  return true;
}

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

async function tokenFor(email: string, type: string): Promise<string | null> {
  const record = await db.verificationToken.findFirst({
    where: { identifier: email, type },
    orderBy: { createdAt: 'desc' },
  });
  return record?.token ?? null;
}

interface State {
  learner: string;
  bystander: string;
  resetToken?: string;
}

const FIRST = 'Correct-Horse-Battery-1';
const SECOND = 'Different-Staple-Anchor-2';

/* --------------------------------- phases --------------------------------- */

/** Registration and email verification. Uses none of the reset budget. */
async function phaseOne(): Promise<void> {
  const stamp = Date.now();
  const state: State = { learner: `beta+${stamp}@example.com`, bystander: `beta+${stamp}b@example.com` };
  writeFileSync(STATE, JSON.stringify(state));

  const registered = await post('/api/auth/register', {
    name: 'Beta Tester',
    email: state.learner,
    password: FIRST,
  });
  check(registered.status === 201 || registered.status === 200, 'register', `HTTP ${registered.status}`);

  const verifyToken = await tokenFor(state.learner, 'email-verify');
  check(verifyToken !== null, 'registration mints an email-verify token');

  const verified = await post('/api/auth/verify-email', { email: state.learner, token: verifyToken });
  check(verified.status === 200, 'verify-email accepts the token', `HTTP ${verified.status}`);

  const user = await db.user.findUnique({ where: { email: state.learner } });
  check(user?.emailVerified != null, 'the account is recorded as verified');

  const replayed = await post('/api/auth/verify-email', { email: state.learner, token: verifyToken });
  check(replayed.status === 400, 'the verification token cannot be replayed', `HTTP ${replayed.status}`);

  await post('/api/auth/register', { name: 'Bystander', email: state.bystander, password: FIRST });
  check((await tokenFor(state.bystander, 'email-verify')) !== null, 'a second account exists to test against');
}

/** One reset-password call: an email-verify token must not change a password. */
async function phaseTwo(): Promise<void> {
  const state = JSON.parse(readFileSync(STATE, 'utf8')) as State;
  const bystanderVerify = await tokenFor(state.bystander, 'email-verify');

  const escalation = await post('/api/auth/reset-password', { token: bystanderVerify, password: SECOND });
  if (notRateLimited(escalation.status, 'a 24-hour email-verify token cannot change a password')) {
    check(
      escalation.status === 400,
      'a 24-hour email-verify token cannot change a password',
      `HTTP ${escalation.status}`
    );
  }

  const bystander = await db.user.findUnique({ where: { email: state.bystander } });
  check(await compare(FIRST, bystander?.password ?? ''), "and the bystander's password is untouched");
}

/** Three calls: request, fumble, succeed. Exactly the budget. */
async function phaseThree(): Promise<void> {
  const state = JSON.parse(readFileSync(STATE, 'utf8')) as State;

  const asked = await post('/api/auth/forgot-password', { email: state.learner });
  if (!notRateLimited(asked.status, 'forgot-password accepts the request')) return;
  check(asked.status === 200, 'forgot-password accepts the request', `HTTP ${asked.status}`);

  const resetToken = await tokenFor(state.learner, 'password-reset');
  check(resetToken !== null, 'a password-reset token is issued');
  writeFileSync(STATE, JSON.stringify({ ...state, resetToken }));

  // The defect this exists for: the link used to land on a page that did not
  // exist, so every locked-out learner stayed locked out.
  const page = await fetch(`${BASE}/auth/reset-password?token=${encodeURIComponent(resetToken ?? '')}`);
  check(page.status === 200, 'the link in the email lands on a real page', `HTTP ${page.status}`);

  const weak = await post('/api/auth/reset-password', { token: resetToken, password: 'password123' });
  if (notRateLimited(weak.status, 'a weak password is refused')) {
    check(weak.status === 400, 'a weak password is refused', `HTTP ${weak.status}`);
  }
  check(
    (await tokenFor(state.learner, 'password-reset')) === resetToken,
    'and the link still works afterwards, so one fumble is not fatal'
  );

  const reset = await post('/api/auth/reset-password', { token: resetToken, password: SECOND });
  if (notRateLimited(reset.status, 'the password is changed')) {
    check(reset.status === 200, 'the password is changed', `HTTP ${reset.status}`);
  }

  const after = await db.user.findUnique({ where: { email: state.learner } });
  check(await compare(SECOND, after?.password ?? ''), 'the new password matches the stored hash');
  check(!(await compare(FIRST, after?.password ?? '')), 'the old password no longer works');
  check((await tokenFor(state.learner, 'password-reset')) === null, 'no reset token is left behind');
}

/** One call, on a fresh limiter: the spent token is refused on its merits. */
async function phaseFour(): Promise<void> {
  const state = JSON.parse(readFileSync(STATE, 'utf8')) as State;

  const reused = await post('/api/auth/reset-password', { token: state.resetToken, password: FIRST });
  if (notRateLimited(reused.status, 'the reset link cannot be used twice')) {
    check(reused.status === 400, 'the reset link cannot be used twice', `HTTP ${reused.status}`);
  }

  const user = await db.user.findUnique({ where: { email: state.learner } });
  check(await compare(SECOND, user?.password ?? ''), 'and the password is still the one the learner chose');
}

/* ---------------------------------- main ---------------------------------- */

const phases: Record<string, () => Promise<void>> = {
  '1': phaseOne,
  '2': phaseTwo,
  '3': phaseThree,
  '4': phaseFour,
};

async function main(): Promise<void> {
  const phase = process.argv[2] ?? '1';
  const run = phases[phase];
  if (!run) throw new Error(`unknown phase: ${phase}`);

  console.log(`\n— phase ${phase} —`);
  await run();

  if (failures > 0) console.log(`\n${failures} of ${checks} checks failed in phase ${phase}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
