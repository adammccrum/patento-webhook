/**
 * Form accessibility guard.
 *
 * A `<label>` with no `htmlFor`, and no input inside it, is not a label. It
 * renders as text: a screen reader announces the field as unlabelled, and
 * clicking the text does not focus the input.
 *
 * Recorded as H5 in the private beta readiness review — 21 labels, 2
 * associated — and left open long enough to reach a release-criteria document.
 * Enforced here rather than remembered.
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

/** The whole element, opening tag through `</label>`. */
function labelBlock(lines: string[], start: number): string {
  let block = '';
  for (let i = start; i < Math.min(lines.length, start + 12); i++) {
    block += `${lines[i]}\n`;
    if (lines[i]!.includes('</label>')) break;
  }
  return block;
}

describe('Every label is associated with its control', () => {
  it('no label is orphaned', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!/<label\b/.test(lines[i]!)) continue;

        const block = labelBlock(lines, i);
        const hasFor = /htmlFor=/.test(block);
        // A control nested inside the label is associated implicitly, which is
        // equally valid.
        const wrapsControl = /<(input|select|textarea)\b/.test(block);

        if (!hasFor && !wrapsControl) {
          offenders.push(`${rel(file)}:${i + 1} — ${lines[i]!.trim().slice(0, 60)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('every htmlFor points at an id that exists in the same file', () => {
    // An htmlFor with no matching id is worse than none: it looks correct.
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const ids = new Set<string>();
      for (const m of src.matchAll(/\bid=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
        ids.add(m[1] ?? m[2]!);
      }
      for (const m of src.matchAll(/htmlFor=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
        const target = m[1] ?? m[2]!;
        if (!ids.has(target)) offenders.push(`${rel(file)} → htmlFor="${target}" matches no id`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
