// Structural test: after Astro v7 migration, schema.ts is the sole schema.
// config.ts (defineTable/defineDb) and schema-parity.test.ts are deleted.
// The manifest points dbConfig at schema.ts.

import { test } from 'node:test';
import assert from 'node:assert';
import { promises as fs, readFileSync, constants } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

test('config.ts does not exist', async () => {
  await assert.rejects(
    () => fs.access(join(ROOT, 'src/db/config.ts'), constants.F_OK),
    { code: 'ENOENT' },
    'src/db/config.ts should not exist after v7 migration'
  );
});

test('schema.ts exports all four table definitions', async () => {
  const schema = await import('../../src/db/schema.ts');
  assert.ok(schema.notification_rules, 'notification_rules export missing');
  assert.ok(schema.notification_templates, 'notification_templates export missing');
  assert.ok(schema.notification_logs, 'notification_logs export missing');
  assert.ok(schema.notification_settings, 'notification_settings export missing');
});

test('manifest dbConfig points at schema.ts', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'pelerin.manifest.json'), 'utf-8'));
  assert.strictEqual(
    manifest.dbConfig,
    './src/db/schema.ts',
    'manifest dbConfig should point at schema.ts, not config.ts'
  );
});

test('schema-parity.test.ts does not exist', async () => {
  await assert.rejects(
    () => fs.access(join(ROOT, 'tests/db/schema-parity.test.ts'), constants.F_OK),
    { code: 'ENOENT' },
    'tests/db/schema-parity.test.ts should not exist after v7 migration'
  );
});
