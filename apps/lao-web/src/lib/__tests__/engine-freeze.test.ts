/**
 * Enforces the IrisKey Core freeze.
 *
 * packages/lao-engine is frozen: preserved and kept green, but not developed
 * and not consumed by the product. See packages/lao-engine/FROZEN.md.
 *
 * This test makes the decision structural rather than a convention someone has
 * to remember.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

describe('IrisKey Core freeze', () => {
  const files = sourceFiles(SRC);

  it('scans the app source', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('the product does not import the frozen engine', () => {
    const offenders = files.filter((f) => {
      if (f.endsWith('engine-freeze.test.ts')) return false;
      const source = readFileSync(f, 'utf8');
      return /from\s+['"]@lao\/engine|from\s+['"].*lao-engine/.test(source);
    });

    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});
