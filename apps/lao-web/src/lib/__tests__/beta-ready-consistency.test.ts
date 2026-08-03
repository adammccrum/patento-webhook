/**
 * BETA_READY.md self-consistency guard.
 *
 * The document answers one question: "if someone asks why we believe LAO is
 * ready for beta, where is the proof?" A summary line that disagrees with the
 * table beneath it undermines exactly that.
 *
 * Its header count has now been wrong twice — "2 of 21" against 29 rows, then
 * "2 of 32" against 36. Both times it was written by hand, in the one document
 * whose purpose is that nothing is asserted from memory. Twice is a pattern,
 * so it is enforced rather than corrected again.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const FILE = join(__dirname, '..', '..', '..', '..', '..', 'BETA_READY.md');
const doc = readFileSync(FILE, 'utf8');

/** Evidenced rows: `| 1.2 | … |`. Unevidenced are bolded: `| **8.1** | … |`. */
const evidenced = [...doc.matchAll(/^\| (\d+\.\d+) \|/gm)].map((m) => m[1]!);
const unevidenced = [...doc.matchAll(/^\| \*\*(\d+\.\d+)\*\* \|/gm)].map((m) => m[1]!);

describe('BETA_READY.md agrees with itself', () => {
  it('the header count matches the number of criteria', () => {
    const header = doc.match(/\*\*Status:[^*]*?(\d+) criteri[ao]n? of (\d+) lack evidence\.\*\*/);
    expect(header).not.toBeNull();

    const [, statedUnevidenced, statedTotal] = header!;
    expect({
      unevidenced: Number(statedUnevidenced),
      total: Number(statedTotal),
    }).toEqual({
      unevidenced: unevidenced.length,
      total: evidenced.length + unevidenced.length,
    });
  });

  it('no criterion number is used twice', () => {
    const all = [...evidenced, ...unevidenced];
    const duplicates = all.filter((id, i) => all.indexOf(id) !== i);

    expect(duplicates).toEqual([]);
  });

  it('every criterion has evidence in its row, or is listed as lacking it', () => {
    // A row whose evidence cell is empty or a placeholder is worse than an
    // absent row: it reads as covered.
    const offenders: string[] = [];
    for (const line of doc.split('\n')) {
      const m = line.match(/^\| (\d+\.\d+|\*\*\d+\.\d+\*\*) \| ([^|]*) \| ([^|]*) \|/);
      if (!m) continue;
      const evidence = m[3]!.trim();
      if (!evidence || /^(tbd|todo|—|-|n\/a)$/i.test(evidence)) {
        offenders.push(`${m[1]} has no evidence: "${evidence}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('still names the two operational blockers, so neither is quietly dropped', () => {
    expect(doc).toMatch(/master logo/i);
    expect(doc).toMatch(/provider verification|live credentials/i);
  });
});
