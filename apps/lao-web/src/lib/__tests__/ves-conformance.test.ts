/**
 * VES conformance guard.
 *
 * The IrisKey Verified Engineering Standard governs every project, and says
 * two things about itself that nothing was checking:
 *
 *   - No subsequent engineering document may contradict it. Two documents
 *     claiming to be the standard is the same defect class as documentation
 *     that has never been executed — you cannot tell which one is true.
 *   - It evolves through evidence, not preference. Every principle carries the
 *     defect that produced it, and every amendment carries four mandatory
 *     elements.
 *
 * Principle 6 says documentation is executable engineering. This is that
 * principle applied to the standard itself.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DOCS = join(__dirname, '..', '..', '..', '..', '..', 'docs', 'engineering');
const VES_FILE = 'VERIFIED_ENGINEERING_STANDARD.md';
const ves = readFileSync(join(DOCS, VES_FILE), 'utf8');

/** Every other engineering document, which must be derived rather than rival. */
const others = readdirSync(DOCS).filter((f) => f.endsWith('.md') && f !== VES_FILE);

describe('The standard is internally complete', () => {
  it('declares a version in its title', () => {
    expect(ves).toMatch(/^# IrisKey Verified Engineering Standard \(VES\) v\d+\.\d+/m);
  });

  it('states its authority and scope', () => {
    expect(ves).toMatch(/\*\*Authority:\*\*\s*Founder/);
    expect(ves).toMatch(/\*\*Applies to:\*\*/);
  });

  it('has exactly eight principles, each stated normatively', () => {
    const headings = [...ves.matchAll(/^### Principle (\d) — (.+)$/gm)];
    expect(headings.map((m) => Number(m[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // A principle without a blockquote is a paraphrase, not a rule.
    for (const [, n] of headings) {
      const start = ves.indexOf(`### Principle ${n} —`);
      const next = ves.indexOf('### Principle', start + 10);
      const body = ves.slice(start, next === -1 ? undefined : next);
      expect(body).toMatch(/^> /m);
    }
  });

  it('records the defect behind every principle', () => {
    // The authority of this standard is that each rule was paid for. A
    // principle with no derivation is a preference.
    const derivations = ves.match(/\*\*Derivation\.\*\*/g) ?? [];
    expect(derivations.length).toBe(8);
  });

  it('carries a version history with one row per principle', () => {
    const history = ves.slice(ves.indexOf('## Version history'));
    expect(history).toContain('### v1.0');
    for (let n = 1; n <= 8; n++) {
      expect(history).toMatch(new RegExp(`\\|\\s*${n} · `));
    }
  });
});

describe('Amendments require evidence, not preference', () => {
  const amendment = ves.slice(ves.indexOf('## Amendment process'));

  it('requires Founder approval', () => {
    expect(amendment).toMatch(/require explicit Founder approval/i);
  });

  it('names all four mandatory elements', () => {
    for (const required of [
      /motivated the change/i,
      /why existing principles were insufficient/i,
      /permanent engineering improvement/i,
      /expected effect on future verification/i,
    ]) {
      expect(amendment).toMatch(required);
    }
  });

  it('says plainly that preference is not grounds for an amendment', () => {
    expect(amendment).toMatch(/preference/i);
  });
});

describe('No document rivals the standard', () => {
  it('no other engineering document claims to be the standard', () => {
    const offenders: string[] = [];

    for (const file of others) {
      const text = readFileSync(join(DOCS, file), 'utf8');
      // The markers VES uses to declare itself normative.
      if (/\*\*Authority:\*\*\s*Founder/.test(text)) offenders.push(`${file} claims Founder authority`);
      if (/\*\*Status:\*\*\s*Company Engineering Standard/.test(text)) {
        offenders.push(`${file} claims to be the company standard`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('every other engineering document declares itself derived from VES', () => {
    // Without this, a reader landing on a casebook has no way to know it is
    // subordinate.
    const offenders = others.filter(
      (file) => !readFileSync(join(DOCS, file), 'utf8').includes(VES_FILE)
    );

    expect(offenders).toEqual([]);
  });
});

const REPO = join(__dirname, '..', '..', '..', '..', '..');

/** Every guard file the standard names anywhere in its prose or tables. */
const namedGuards = new Set(
  [...ves.matchAll(/`([\w.-]+\.(?:test\.ts|mjs|sh))`/g)].map((m) => m[1]!)
);

describe('The standard cites nothing that does not exist', () => {
  it('every named guard file is present', () => {
    const search = [
      join(REPO, 'apps', 'lao-web', 'src', 'lib', '__tests__'),
      join(REPO, 'scripts'),
      join(REPO, 'packages', 'iriskey', 'llm'),
    ];
    const present = new Set(search.flatMap((dir) => readdirSync(dir)));

    expect([...namedGuards].filter((f) => !present.has(f))).toEqual([]);
  });

  it('every cited document exists', () => {
    const cited = new Set([...ves.matchAll(/`([A-Z][A-Z_]+\.md)`/g)].map((m) => m[1]!));
    const missing = [...cited].filter((f) => !existsSync(join(REPO, f)));

    expect(missing).toEqual([]);
  });

  it('every npm script the standard names exists', () => {
    const scripts = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts ?? {};
    const named = [...ves.matchAll(/`npm run ([a-z:-]+)`/g)].map((m) => m[1]!);
    const missing = [...new Set(named)].filter((s) => !(s in scripts));

    expect(missing).toEqual([]);
  });
});

describe('The standard tells the truth about the pipeline', () => {
  const workflow = readFileSync(
    join(REPO, '.github', 'workflows', 'release-candidate.yml'),
    'utf8'
  );

  it('every guard it says runs on every push is actually invoked by the workflow', () => {
    // This is the check that was missing. The standard claimed "all run on
    // every push" while verify-pages.mjs and verify-mobile.mjs were not in the
    // workflow at all — a false normative statement in the document that
    // forbids unsupported normative statements.
    const offenders = [...namedGuards].filter((guard) => {
      // Jest guards are run collectively by `turbo run test`.
      if (guard.endsWith('.test.ts')) return !/turbo run test/.test(workflow);
      // Scripts must be invoked by name, or via the npm script that wraps them.
      const stem = guard.replace(/\.(mjs|sh)$/, '');
      return !workflow.includes(guard) && !workflow.includes(stem);
    });

    expect(offenders).toEqual([]);
  });

  it('no verification step is continue-on-error', () => {
    // One exception is allowed and stated in the standard: the artefact
    // download in the reporting job, which must tolerate a missing artefact.
    const lines = workflow.split('\n');
    const offenders: string[] = [];

    lines.forEach((line, i) => {
      if (!/^\s*continue-on-error:\s*true/.test(line)) return;
      // Look back for the step this belongs to.
      const step = lines
        .slice(Math.max(0, i - 6), i)
        .reverse()
        .find((l) => /^\s*- (name|uses):/.test(l)) ?? '(unknown step)';
      if (!/download-artifact/.test(step)) offenders.push(`${i + 1}: ${step.trim()}`);
    });

    expect(offenders).toEqual([]);
  });
});
