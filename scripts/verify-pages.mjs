/**
 * Page render regression test.
 *
 * Every gate we had was HTTP-level: the clean room asserts
 * `GET /api/dashboard → 200`, and it does. The *page* threw while rendering
 * the response, and every learner landing on /dashboard after logging in saw
 * "Application error: a client-side exception has occurred".
 *
 * Root cause: the API returns `{ success, data }` and the page destructured
 * `user` off the envelope instead of the payload, so `user.email` threw.
 *
 * This renders each page in a real browser with a real session and fails on:
 *
 *   1. any uncaught client-side exception,
 *   2. the Next.js error screen,
 *   3. a page still showing "Loading..." after its data should have arrived,
 *   4. an envelope leaking into the DOM (the literal text `"success":true`),
 *   5. the page failing to show data the API said it has.
 *
 * Check 5 is the one that matters: a page can render without throwing and
 * still show nothing. Rendering is not the same as working.
 *
 * Usage:
 *   PAGES_BASE_URL=http://localhost:3500 node scripts/verify-pages.mjs
 */

import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'fs';

const BASE = process.env.PAGES_BASE_URL ?? 'http://localhost:3500';
const REPORT = process.env.PAGES_REPORT ?? 'page-render-report.md';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const PASSWORD = process.env.PAGES_PASSWORD ?? 'Page-Verification-2026!x';
const EMAIL = process.env.PAGES_EMAIL ?? `pages-${Date.now()}@example.com`;

/**
 * What each page must actually show once loaded. Without this a page that
 * renders an empty shell without throwing counts as a pass.
 *
 * `text` is matched against innerText; `value` against a form control, because
 * an input's value is not innerText — expecting the email as text on /profile
 * failed against a page that was displaying it correctly.
 *
 * Expected values come from the API where possible, so the assertion tracks
 * the seed data instead of hardcoding a copy of it.
 */
const PAGES = [
  { path: '/dashboard', text: (ctx) => ctx.email },
  { path: '/profile', value: (ctx) => ({ selector: '#profile-email', contains: ctx.email }) },
  { path: '/solutions', text: () => 'Toolbox' },
  { path: '/settings', text: () => 'Settings' },
  { path: '/course/1', text: (ctx) => ctx.courseTitle },
  { path: '/discover' },
  { path: '/solution' },
  { path: '/reflection' },
  { path: '/build' },
];

const results = [];
let failures = 0;

const browser = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

/** Uncaught exceptions, collected per navigation. */
let pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).split('\n')[0]));

try {
  // Register through the API: this verifies pages, not the signup form.
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' });
  const status = await page.evaluate(
    async ({ base, email, password }) => {
      const r = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Page Check', email, password }),
      });
      return r.status;
    },
    { base: BASE, email: EMAIL, password: PASSWORD }
  );
  if (status === 429) {
    throw new Error(
      'Registration rate limited (3/hour/IP — a real defence). Restart the server, ' +
        'or set PAGES_EMAIL/PAGES_PASSWORD to reuse an account.'
    );
  }
  if (status !== 201 && status !== 409) throw new Error(`register returned ${status}`);

  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20_000 });

  // Read the seeded course title from the API so the page assertion below
  // checks the page against the real data rather than a hardcoded copy.
  const courseTitle = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/courses/course-1`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.course?.title ?? null;
  }, BASE);
  if (!courseTitle) throw new Error('Could not read the course title — is the database seeded?');

  const ctx = { email: EMAIL, courseTitle };

  for (const { path, text, value } of PAGES) {
    pageErrors = [];
    const problems = [];

    // A hard load, which is what a refresh or a bookmark does. The crash only
    // showed on this path, not on client-side navigation.
    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });

    // Wait for the page to stop saying "Loading...".
    try {
      await page.waitForFunction(
        () => {
          const t = document.body?.innerText?.trim() ?? '';
          return t.length > 0 && !/^\s*Loading\.\.\.\s*$/.test(t);
        },
        { timeout: 15_000 }
      );
    } catch {
      problems.push('still showing "Loading..." after 15s');
    }
    await page.waitForTimeout(300);

    const state = await page.evaluate(
      (selector) => ({
        text: document.body?.innerText ?? '',
        html: document.body?.innerHTML ?? '',
        fieldValue: selector ? (document.querySelector(selector)?.value ?? null) : null,
      }),
      value ? value({ email: '', courseTitle: '' }).selector : null
    );

    if (response && response.status() >= 500) {
      problems.push(`HTTP ${response.status()}`);
    }
    if (pageErrors.length) {
      problems.push(`uncaught: ${[...new Set(pageErrors)][0]}`);
    }
    if (/Application error: a client-side exception/i.test(state.text)) {
      problems.push('rendered the client-side exception screen');
    }
    if (state.text.trim().length === 0) {
      problems.push('rendered nothing');
    }
    // The exact shape that caused this: the envelope reaching the UI.
    if (/"success"\s*:\s*true/.test(state.html)) {
      problems.push('the API envelope leaked into the DOM');
    }

    const wantedText = text?.(ctx);
    if (wantedText && !state.text.includes(wantedText)) {
      problems.push(`loaded without its data — expected to see "${wantedText}"`);
    }

    const wantedValue = value?.(ctx);
    if (wantedValue) {
      if (state.fieldValue === null) {
        problems.push(`${wantedValue.selector} is not on the page`);
      } else if (!state.fieldValue.includes(wantedValue.contains)) {
        problems.push(
          `${wantedValue.selector} holds "${state.fieldValue}", expected "${wantedValue.contains}"`
        );
      }
    }

    if (problems.length) failures++;
    results.push({ path, problems });
    process.stdout.write(
      problems.length
        ? `  \x1b[31m✗\x1b[0m ${path} — ${problems.join('; ')}\n`
        : `  \x1b[32m✓\x1b[0m ${path}\n`
    );
  }
} finally {
  await browser.close();
}

const lines = [
  '# Page render verification',
  '',
  '| | |',
  '|---|---|',
  `| Timestamp | ${new Date().toISOString()} |`,
  `| Base URL | ${BASE} |`,
  `| Verdict | **${failures === 0 ? 'PASS' : `${failures} page(s) failed`}** |`,
  '',
  '| Page | Result | Detail |',
  '|---|---|---|',
  ...results.map(
    (r) => `| ${r.path} | ${r.problems.length ? 'FAIL' : 'PASS'} | ${r.problems.join('; ') || '—'} |`
  ),
  '',
  'Produced by `scripts/verify-pages.mjs`.',
];
writeFileSync(REPORT, lines.join('\n'));

process.stdout.write(`\nReport: ${REPORT}\n`);
if (failures) {
  process.stdout.write(`\x1b[31m${failures} page(s) failed to render correctly.\x1b[0m\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('\x1b[32mAll pages render with their data.\x1b[0m\n');
}
