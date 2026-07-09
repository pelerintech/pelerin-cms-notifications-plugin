import { test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guard against the silent-skip regression: `node --test` treats `[`/`]` in a
// path as a glob character class, so a file named
// `tests/api/handlers/rules/[id].test.ts` is silently skipped (0 tests
// registered, 0 failures — a false green). No test file discovered under
// tests/api/handlers/ may contain `[` or `]` in its relative path.
//
// Source files legitimately keep `[id]` for Astro routing; test files mirror
// the source name MINUS brackets (e.g. `id.test.ts`, not `[id].test.ts`).

const ROOT = 'tests/api/handlers';

function listTestFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listTestFiles(full, acc);
    } else if (entry.endsWith('.test.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

test('no handler test file path contains glob-bracket characters', () => {
  const files = listTestFiles(ROOT);
  assert.ok(files.length > 5, `expected several handler test files, found ${files.length}`);
  const bracketed = files.filter((f) => relative('.', f).includes('[') || relative('.', f).includes(']'));
  assert.deepEqual(
    bracketed,
    [],
    `bracket paths silently skipped by node --test (glob char class):\n${bracketed.join('\n')}`,
  );
});
