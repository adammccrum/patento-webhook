/**
 * Dead control guard.
 *
 * Every interactive control must do exactly one of three things: work, be
 * disabled with a visible explanation, or not exist. Nothing may look clickable
 * and do nothing.
 *
 * Three dead controls were found by hand before this test existed — a dark-mode
 * toggle, a Delete Account button, and a Purchase Credits button — plus an
 * unreachable archive view. That is a pattern, not a coincidence, so it is
 * enforced rather than remembered.
 *
 * This catches the structural cases. It cannot tell whether a handler does
 * something *useful* — that still needs a person.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', 'app');

function tsxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...tsxFiles(full));
    else if (entry.endsWith('.tsx')) found.push(full);
  }
  return found;
}

const files = tsxFiles(APP);
const rel = (f: string) => f.replace(APP, '');

/** Grab the full opening tag starting at a line, across line breaks. */
function openingTag(lines: string[], start: number): string {
  let tag = '';
  for (let i = start; i < Math.min(lines.length, start + 14); i++) {
    tag += lines[i];
    // `=>` inside a handler is not the end of the tag.
    if (/>/.test(lines[i]!.replace(/=>/g, ''))) break;
  }
  return tag;
}

describe('No dead controls', () => {
  it('every button has an action', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!/<button/.test(lines[i]!)) continue;

        const tag = openingTag(lines, i);
        const hasHandler = /onClick|onSubmit/.test(tag);
        const isSubmit = /type=["']submit["']/.test(tag);
        // A button inside <Link> is navigated by the anchor, not itself.
        const wrappedInLink = /<Link\b/.test(lines.slice(Math.max(0, i - 4), i).join(' '));

        if (!hasHandler && !isSubmit && !wrappedInLink) {
          offenders.push(`${rel(file)}:${i + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('no handler is an empty function', () => {
    const offenders: string[] = [];
    const noop = /on[A-Z]\w+=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/;

    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const [i, line] of lines.entries()) {
        if (noop.test(line)) offenders.push(`${rel(file)}:${i + 1}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('no control promises something that does not exist', () => {
    // "Coming soon" on an enabled control is the dark-mode toggle all over
    // again: it looks usable, and is not.
    const offenders: string[] = [];
    const promise = /coming soon|not yet available|todo/i;

    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const [i, line] of lines.entries()) {
        if (promise.test(line)) offenders.push(`${rel(file)}:${i + 1} — ${line.trim().slice(0, 60)}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('every internal link points at a route that exists', () => {
    // How /course/1 shipped: a link to a page that was never served.
    const routes = new Set<string>();
    const collect = (dir: string, base = '') => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full, `${base}/${entry}`);
        else if (entry === 'page.tsx') routes.add(base || '/');
      }
    };
    collect(APP);

    const dynamic = [...routes].filter((r) => r.includes('['));
    const matches = (href: string) => {
      if (routes.has(href)) return true;
      // /api/* is served by route.ts, not page.tsx.
      if (href.startsWith('/api/')) return true;
      const parts = href.split('/').filter(Boolean);
      return dynamic.some((route) => {
        const rparts = route.split('/').filter(Boolean);
        if (rparts.length !== parts.length) return false;
        return rparts.every((p, i) => p.startsWith('[') || p === parts[i]);
      });
    };

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/href="(\/[^"#?]*)"/g)) {
        const href = m[1]!.replace(/\/$/, '') || '/';
        if (!matches(href)) offenders.push(`${rel(file)} → ${href}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('Settings and profile only offer what works', () => {
  const settings = readFileSync(join(APP, 'settings', 'page.tsx'), 'utf8');
  const profile = readFileSync(join(APP, 'profile', 'page.tsx'), 'utf8');

  it('no two-factor toggle, because there is no two-factor', () => {
    expect(settings).not.toMatch(/twoFactorEnabled/);
  });

  it('no notification toggles, because no notifications are sent', () => {
    // emailOnLogin and emailOnSecurityAlert were not even columns; sending them
    // made the whole settings form return 500.
    expect(settings).not.toMatch(/emailOnLogin|emailOnSecurityAlert/);
  });

  it('no dark mode toggle', () => {
    expect(settings).not.toMatch(/darkMode/);
  });

  it('no language selector, because there is no translation', () => {
    // Offering 中文 implies an interface that does not exist.
    expect(profile).not.toMatch(/<option value="(zh|ja|ar|es|fr|de)"/);
  });

  it('no timezone selector, because dates render in the browser locale', () => {
    expect(profile).not.toMatch(/Eastern Time|Pacific Time/);
  });
});
