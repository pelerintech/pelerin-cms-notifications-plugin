// Structural test: after v7 migration, no stale astro:db references remain
// in the doc comments of three source files that previously justified the
// dual-definition pattern.

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const FILES = ['src/db/schema.ts', 'src/lib/handler-types.ts', 'src/lib/data/index.ts'];

for (const file of FILES) {
  test(`${file} contains no astro:db reference`, () => {
    const source = readFileSync(join(ROOT, file), 'utf-8');
    assert.ok(
      !source.includes('astro:db'),
      `${file} still contains 'astro:db' — stale doc comment should be cleaned`
    );
  });
}
