// Structural test: after v7 migration, no admin page imports from astro:db.
// All pages source db from createPluginContext().db (sdk.db).

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PAGES_DIR = join(import.meta.dirname, '..', '..', 'src', 'pages');

function listAstroFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true })) {
    if (typeof entry === 'string' && entry.endsWith('.astro')) {
      results.push(entry);
    }
  }
  return results;
}

test('no admin page imports from astro:db', () => {
  const files = listAstroFiles(PAGES_DIR);
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(join(PAGES_DIR, file), 'utf-8');
    if (source.includes("from 'astro:db'") || source.includes('from "astro:db"')) {
      offenders.push(file);
    }
  }

  assert.deepStrictEqual(
    offenders,
    [],
    `These admin pages still import from astro:db: ${offenders.join(', ')}`
  );
});
