import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Lightweight structural test — KNOWN BEHAVIORAL GAP.
 *
 * Verifies that `src/db/schema.ts` exports all four table definitions.
 * This is an exports-exist check, NOT a behavioural test — column/type
 * correctness is enforced by the accessor tests in `tests/lib/data/*.test.ts`.
 * Kept because it cheaply catches a dropped table export; runtime
 * correctness is verified elsewhere.
 */
describe('Database schema (schema.ts)', async () => {
  const schema = await import('../src/db/schema.ts');

  it('exports notification_rules table', () => {
    assert.ok(schema.notification_rules, 'notification_rules must be exported');
  });

  it('exports notification_templates table', () => {
    assert.ok(schema.notification_templates, 'notification_templates must be exported');
  });

  it('exports notification_settings table', () => {
    assert.ok(schema.notification_settings, 'notification_settings must be exported');
  });

  it('exports notification_logs table', () => {
    assert.ok(schema.notification_logs, 'notification_logs must be exported');
  });
});
