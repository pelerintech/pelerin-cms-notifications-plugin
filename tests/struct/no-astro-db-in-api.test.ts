// Structural test: after v7 migration, no handler file imports from astro:db.
// All handlers source db from createPluginContext().db (sdk.db).

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API_DIR = join(import.meta.dirname, '..', '..', 'src', 'api');

function listTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true })) {
    if (typeof entry === 'string' && entry.endsWith('.ts')) {
      results.push(entry);
    }
  }
  return results;
}

test('no handler file imports from astro:db', () => {
  const files = listTsFiles(API_DIR);
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(join(API_DIR, file), 'utf-8');
    if (source.includes("from 'astro:db'") || source.includes('from "astro:db"')) {
      offenders.push(file);
    }
  }

  assert.deepStrictEqual(
    offenders,
    [],
    `These handler files still import from astro:db: ${offenders.join(', ')}`,
  );
});

test('each handler wrapper sources db from sdk.db', () => {
  const files = listTsFiles(API_DIR);
  const missing: string[] = [];

  for (const file of files) {
    const source = readFileSync(join(API_DIR, file), 'utf-8');
    // Each handler file should have sdk.db in its wrapper
    if (source.includes('runGet') || source.includes('runPost') || source.includes('runPut') || source.includes('runDelete')) {
      if (!source.includes('sdk.db')) {
        missing.push(file);
      }
    }
  }

  assert.deepStrictEqual(
    missing,
    [],
    `These handler files don't source db from sdk.db: ${missing.join(', ')}`,
  );
});
