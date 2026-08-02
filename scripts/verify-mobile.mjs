/**
 * Mobile viewport verification.
 *
 * The clean room proves the learner journey returns the right HTTP status
 * codes and payloads. It never renders a page, so nothing in the pipeline has
 * ever looked at LAO on a phone — and beta learners will.
 *
 * This walks the same journey in a real browser at three viewports and fails
 * on defects that make the product unusable rather than merely imperfect:
 *
 *   1. Horizontal overflow — the page scrolls sideways. Content is off-screen.
 *   2. Controls off-screen — a button or link outside the viewport width.
 *   3. Tap targets below 24px — too small to hit reliably on a touch screen.
 *   4. Text below 12px — unreadable without pinch-zooming.
 *   5. Missing viewport meta — the browser renders desktop-width and scales it.
 *
 * Usage:
 *   MOBILE_BASE_URL=http://localhost:3500 node scripts/verify-mobile.mjs
 *
 * Requires a running server with Course 1 seeded. Registers its own learner,
 * so it needs no existing data.
 */

import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'fs';

const BASE = process.env.MOBILE_BASE_URL ?? 'http://localhost:3500';
const REPORT = process.env.MOBILE_REPORT ?? 'mobile-report.md';

// Smallest phone still in real use, a common modern phone, and a tablet.
// If it works at 320 it works everywhere above it.
const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667, touch: true },
  { name: 'Small Android', width: 320, height: 640, touch: true },
  { name: 'iPad portrait', width: 768, height: 1024, touch: true },
];

const MIN_TAP = 24; // WCAG 2.2 AA minimum, 24x24 CSS px.
const MIN_FONT = 12;

const findings = [];
const rows = [];

function record(viewport, page, kind, detail) {
  findings.push({ viewport, page, kind, detail });
}

/**
 * Wait for the page to stop changing before measuring it.
 *
 * `networkidle` is not enough: these pages fetch in `useEffect` and render
 * "Loading..." first. The harness measured that placeholder — a centred div
 * with no overflow, no small controls and no text — and reported PASS. Three
 * pages were rendering "Application error" a moment later.
 */
async function settle(page) {
  try {
    await page.waitForFunction(
      () => {
        const t = document.body?.innerText?.trim() ?? '';
        return t.length > 0 && !/^\s*Loading\.\.\.\s*$/.test(t);
      },
      { timeout: 15_000 }
    );
  } catch {
    // Fall through — a page stuck on "Loading..." is itself a defect, and the
    // audit below will report it as empty rather than silently passing.
  }
  await page.waitForTimeout(400);
}

/** Everything wrong with the page as currently rendered. */
async function auditPage(page, viewportName, label) {
  await settle(page);

  // A page that threw during render has no layout worth measuring, and every
  // other check would pass on the bare error screen.
  const crashed = await page.evaluate(() => {
    const t = document.body?.innerText ?? '';
    if (/Application error: a client-side exception/i.test(t)) return 'client-side exception';
    if (/^\s*Loading\.\.\.\s*$/.test(t.trim())) return 'stuck on Loading…';
    if (t.trim().length === 0) return 'rendered nothing';
    return null;
  });
  if (crashed) {
    record(viewportName, label, 'client-crash', crashed);
    rows.push(`| ${viewportName} | ${label} | CRASH |`);
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${label} — ${crashed}\n`);
    return;
  }

  const result = await page.evaluate(
    ({ minTap, minFont }) => {
      const out = { overflow: null, offscreen: [], smallTaps: [], smallText: [], viewportMeta: true };

      const doc = document.documentElement;
      if (doc.scrollWidth > doc.clientWidth + 1) {
        // Name the widest offender — "the page overflows" is not actionable.
        let worst = null;
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > doc.clientWidth + 1 && (!worst || r.right > worst.right)) {
            worst = {
              right: Math.round(r.right),
              tag: el.tagName.toLowerCase(),
              cls: (el.className?.toString?.() ?? '').slice(0, 60),
              text: (el.textContent ?? '').trim().slice(0, 40),
            };
          }
        }
        out.overflow = { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, worst };
      }

      if (!document.querySelector('meta[name="viewport"]')) out.viewportMeta = false;

      const interactive = document.querySelectorAll(
        'button, a[href], input, select, textarea, [role="button"]'
      );
      for (const el of interactive) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue; // not rendered
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;

        const name = (el.getAttribute('aria-label') || el.textContent || el.tagName)
          .trim()
          .slice(0, 40);

        if (r.right > doc.clientWidth + 1 || r.left < -1) {
          out.offscreen.push({ name, left: Math.round(r.left), right: Math.round(r.right) });
        }
        // Inline links inside a paragraph are exempt: they are text, and the
        // 24px rule targets standalone controls.
        const inlineLink = el.tagName === 'A' && style.display === 'inline';
        if (!inlineLink && (r.height < minTap || r.width < minTap)) {
          out.smallTaps.push({ name, w: Math.round(r.width), h: Math.round(r.height) });
        }
      }

      for (const el of document.querySelectorAll('p, span, li, td, label, div')) {
        if (!el.childNodes.length) continue;
        const hasDirectText = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 3
        );
        if (!hasDirectText) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size && size < minFont) {
          out.smallText.push({ size, text: el.textContent.trim().slice(0, 40) });
        }
      }

      return out;
    },
    { minTap: MIN_TAP, minFont: MIN_FONT }
  );

  if (result.overflow) {
    const w = result.overflow.worst;
    record(
      viewportName,
      label,
      'overflow',
      `page scrolls sideways: ${result.overflow.scrollWidth}px content in ${result.overflow.clientWidth}px viewport` +
        (w ? ` — widest is <${w.tag}> reaching ${w.right}px ("${w.text}")` : '')
    );
  }
  if (!result.viewportMeta) {
    record(viewportName, label, 'viewport-meta', 'no <meta name="viewport"> — renders at desktop width');
  }
  for (const o of result.offscreen.slice(0, 3)) {
    record(viewportName, label, 'offscreen-control', `"${o.name}" spans ${o.left}→${o.right}px`);
  }
  for (const t of dedupe(result.smallTaps).slice(0, 3)) {
    record(viewportName, label, 'tap-target', `"${t.name}" is ${t.w}×${t.h}px, below ${MIN_TAP}px`);
  }
  for (const t of dedupe(result.smallText).slice(0, 3)) {
    record(viewportName, label, 'small-text', `${t.size}px: "${t.text}"`);
  }

  const clean =
    !result.overflow &&
    result.viewportMeta &&
    !result.offscreen.length &&
    !result.smallTaps.length &&
    !result.smallText.length;
  rows.push(`| ${viewportName} | ${label} | ${clean ? 'PASS' : 'DEFECTS'} |`);
  process.stdout.write(`  ${clean ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}\n`);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((x) => {
    const k = JSON.stringify(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// One account for the whole run. Registering per viewport hit the 3-per-hour
// registration limit on the third one — the harness tripping a real defence
// and reporting it as a page failure.
const PASSWORD = process.env.MOBILE_PASSWORD ?? 'Mobile-Verification-2026!x';
const EMAIL = process.env.MOBILE_EMAIL ?? `mobile-${Date.now()}@example.com`;
// A supplied account is assumed to exist already; only generated ones register.
let registered = Boolean(process.env.MOBILE_EMAIL);

async function ensureAccount(page) {
  if (registered) return;
  // Through the API, so a form-field mismatch cannot masquerade as a layout
  // defect. Layout is what is under test here.
  const status = await page.evaluate(
    async ({ base, email, password }) => {
      const r = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Mobile Check', email, password }),
      });
      return r.status;
    },
    { base: BASE, email: EMAIL, password: PASSWORD }
  );
  // 409 means a previous run already created this account, which is fine.
  if (status === 429) {
    throw new Error(
      'Registration is rate limited (3/hour/IP — a real defence, not a defect). ' +
        'Restart the server to clear the in-memory counter, or set MOBILE_EMAIL and ' +
        'MOBILE_PASSWORD to reuse an existing account.'
    );
  }
  if (status !== 201 && status !== 409) throw new Error(`register returned ${status}`);
  registered = true;
}

async function journey(context, viewportName) {
  const page = await context.newPage();
  const email = EMAIL;
  const password = PASSWORD;

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await auditPage(page, viewportName, '/ (landing)');

  await page.goto(`${BASE}/auth/register`, { waitUntil: 'networkidle' });
  await auditPage(page, viewportName, '/auth/register');

  await ensureAccount(page);

  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' });
  await auditPage(page, viewportName, '/auth/login');

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  await auditPage(page, viewportName, '/dashboard');

  for (const [path, label] of [
    ['/course/1', '/course/1'],
    ['/solutions', '/solutions (toolbox)'],
    ['/solutions/new', '/solutions/new'],
    ['/profile', '/profile'],
    ['/settings', '/settings'],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await auditPage(page, viewportName, label);
  }

  // The first mission, reached the way a learner reaches it.
  const missionId = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/courses/course-1`);
    const d = await r.json();
    return d?.course?.missions?.[0]?.id ?? null;
  }, BASE);
  if (missionId) {
    await page.goto(`${BASE}/mission/${missionId}`, { waitUntil: 'networkidle' });
    await auditPage(page, viewportName, '/mission/[id]');
  }

  await page.close();
}

// The preinstalled chromium may be a different revision from the one this
// Playwright version downloads by default, so prefer an explicit binary when
// one is present and let Playwright resolve otherwise.
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(
  existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {}
);

try {
  for (const vp of VIEWPORTS) {
    process.stdout.write(`\n\x1b[1m${vp.name} — ${vp.width}×${vp.height}\x1b[0m\n`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    await journey(context, vp.name);
    await context.close();
  }
} finally {
  await browser.close();
}

const byKind = {};
for (const f of findings) (byKind[f.kind] ??= []).push(f);

const lines = [
  '# Mobile viewport verification',
  '',
  `| | |`,
  `|---|---|`,
  `| Timestamp | ${new Date().toISOString()} |`,
  `| Base URL | ${BASE} |`,
  `| Viewports | ${VIEWPORTS.map((v) => `${v.name} (${v.width}px)`).join(', ')} |`,
  `| Verdict | **${findings.length === 0 ? 'PASS' : `${findings.length} defect(s)`}** |`,
  '',
  '## Pages',
  '',
  '| Viewport | Page | Result |',
  '|---|---|---|',
  ...rows,
];

if (findings.length) {
  lines.push('', '## Defects', '');
  for (const [kind, list] of Object.entries(byKind)) {
    lines.push(`### ${kind} (${list.length})`, '');
    lines.push('| Viewport | Page | Detail |', '|---|---|---|');
    for (const f of list) lines.push(`| ${f.viewport} | ${f.page} | ${f.detail} |`);
    lines.push('');
  }
}

lines.push('', 'Produced by `scripts/verify-mobile.mjs`.');
writeFileSync(REPORT, lines.join('\n'));

process.stdout.write(`\nReport: ${REPORT}\n`);
if (findings.length) {
  process.stdout.write(`\x1b[31m${findings.length} defect(s) across ${VIEWPORTS.length} viewports.\x1b[0m\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('\x1b[32mNo mobile defects.\x1b[0m\n');
}
