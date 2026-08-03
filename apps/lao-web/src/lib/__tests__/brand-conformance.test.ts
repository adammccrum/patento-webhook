/**
 * Brand conformance.
 *
 * The mechanical half of /brand/brand-guidelines.md. This fails the build, not
 * a linter, because brand consistency is part of engineering quality.
 *
 * It cannot judge taste — only drift. Taste is still your job.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..');
const BRAND = join(__dirname, '..', '..', '..', '..', '..', 'brand');

function tsxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...tsxFiles(full));
    else if (entry.endsWith('.tsx')) found.push(full);
  }
  return found;
}

const files = tsxFiles(APP);
const rel = (f: string) => f.replace(APP, '');

describe('Brand system is present', () => {
  it('the guidelines exist and are the stated authority', () => {
    const doc = join(BRAND, 'brand-guidelines.md');
    expect(existsSync(doc)).toBe(true);
    expect(readFileSync(doc, 'utf8')).toContain('the brand system wins');
  });

  it.each([
    ['colors/palette.md'],
    ['typography/typography.md'],
    ['icons/README.md'],
    ['illustrations/README.md'],
    ['logo/README.md'],
  ])('/brand/%s exists', (path) => {
    expect(existsSync(join(BRAND, path))).toBe(true);
  });

  it('the master logo is committed', () => {
    // Deliberately failing until the supplied artwork is added. The logo must
    // never be recreated or AI-generated, so an honest gap is correct — but it
    // must not be quietly forgotten either. See /brand/logo/README.md.
    const png = existsSync(join(BRAND, 'logo', 'lao-master.png'));
    const svg = existsSync(join(BRAND, 'logo', 'lao-master.svg'));

    if (!png && !svg) {
      throw new Error(
        'The master logo is missing from /brand/logo/. Add the supplied ' +
          'lao-master.png (and .svg if one exists). Do not recreate or generate it — ' +
          'see /brand/logo/README.md.'
      );
    }
  });
});

describe('Surfaces are white', () => {
  it('no screen uses a grey or coloured page gradient', () => {
    const offenders = files.filter((f) =>
      /className="[^"]*min-h-screen[^"]*bg-gradient-to/.test(readFileSync(f, 'utf8'))
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it('no dark page surface', () => {
    // "Never a dark theme for the product surface." — guidelines §4
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (/className="[^"]*min-h-screen[^"]*bg-(black|slate-[89]00|gray-[89]00|zinc-[89]00)/.test(src)) {
        offenders.push(rel(f));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Colour is a token, not a literal', () => {
  it('no raw brand hex codes in components', () => {
    // Brand hues belong in tailwind.config.ts, so they can change in one place.
    const brandHex = /#(1E6FEB|22B4F5|E8256B|F5911E|7B33D6|1FA85C|F5C518|12225C)/i;
    const offenders = files.filter((f) => brandHex.test(readFileSync(f, 'utf8')));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe('Icons are one family', () => {
  it('no emoji used as interface', () => {
    // Emoji render differently on every platform and read as informal.
    // Rounded line icons only — Lucide. See /brand/icons/README.md.
    // Astral pictographs, or a BMP symbol forced into emoji presentation.
    // Plain Extended_Pictographic would flag © and ™, which are legitimate
    // typography; a naive codepoint range would flag em-dashes and CJK.
    const emoji = /\p{Extended_Pictographic}️|[\u{1F000}-\u{1FAFF}]/u;
    const offenders: string[] = [];
    for (const f of files) {
      for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
        if (emoji.test(line)) offenders.push(`${rel(f)}:${i + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no second icon library', () => {
    const offenders = files.filter((f) =>
      /from ['"](react-icons|@heroicons|@fortawesome|feather-icons)/.test(readFileSync(f, 'utf8'))
    );
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe('Voice', () => {
  it('never names the infrastructure to a learner', () => {
    // Reinforces the rule in COLLABORATOR.md at the presentation layer.
    const banned = /\b(AI-powered|powered by AI|GPT|Claude|ChatGPT)\b/i;
    const offenders: string[] = [];
    for (const f of files) {
      for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
        if (banned.test(line)) offenders.push(`${rel(f)}:${i + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no exclamation marks in interface copy', () => {
    // "Confidence is quiet." — /brand/typography/typography.md
    const offenders: string[] = [];
    for (const f of files) {
      for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
        // Only prose between JSX tags or in a quoted string, not code (!== etc).
        if (/>[^<>{}]*[a-z][^<>{}]*!\s*(<|$)/.test(line)) {
          offenders.push(`${rel(f)}:${i + 1} — ${line.trim().slice(0, 70)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
