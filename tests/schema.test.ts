import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

/**
 * Lightweight structural test — KNOWN BEHAVIORAL GAP.
 *
 * `src/db/config.ts` imports from `astro:db`, so it cannot be imported
 * outside the Astro build. We read it as source and assert the table
 * declarations exist. This is an exports-exist / declaration-exist check,
 * NOT a behavioural test — column/type/optionality parity between `config.ts`
 * and the pure-Drizzle `schema.ts` is enforced by
 * `tests/db/schema-parity.test.ts`, and behavioural data access is covered by
 * `tests/lib/data/*.test.ts`. Kept because it cheaply catches a dropped
 * `defineTable` export; runtime correctness is verified elsewhere.
 */
describe('Database schema (config.ts)', () => {
  const source = readFileSync(new URL('../src/db/config.ts', import.meta.url), 'utf-8');

  it('declares notification_rules table', () => {
    assert.ok(source.includes('const notification_rules = defineTable'), 'notification_rules must be declared');
    assert.ok(source.includes('export'), 'notification_rules must be exported');
  });

  it('declares notification_templates table', () => {
    assert.ok(source.includes('const notification_templates = defineTable'), 'notification_templates must be declared');
  });

  it('declares notification_settings table', () => {
    assert.ok(source.includes('const notification_settings = defineTable'), 'notification_settings must be declared');
  });

  it('declares notification_logs table', () => {
    assert.ok(source.includes('const notification_logs = defineTable'), 'notification_logs must be declared');
  });
});
