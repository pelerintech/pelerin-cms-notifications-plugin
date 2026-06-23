import { test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, existsSync } from 'node:fs';

test('no .mjs files remain under tests/', () => {
  const allFiles: string[] = [];
  function walk(dir: URL) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(new URL(entry.name + '/', dir));
      } else if (entry.name.endsWith('.mjs')) {
        allFiles.push(entry.name);
      }
    }
  }
  walk(new URL('./', import.meta.url));
  assert.deepStrictEqual(allFiles, [], `expected no .mjs files under tests/, found: ${allFiles.join(', ')}`);
});

test('converted test files exist as .ts', () => {
  assert.ok(existsSync(new URL('./breadcrumbs.test.ts', import.meta.url)));
  assert.ok(existsSync(new URL('./pagination.test.ts', import.meta.url)));
  assert.ok(existsSync(new URL('./registry.test.ts', import.meta.url)));
  assert.ok(existsSync(new URL('./local-provider.test.ts', import.meta.url)));
  assert.ok(existsSync(new URL('./schema.test.ts', import.meta.url)));
});
