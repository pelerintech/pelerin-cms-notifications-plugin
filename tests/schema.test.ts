import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

/**
 * Structural test for the astro:db config.ts.
 * The file imports from 'astro:db' so it cannot be imported outside Astro;
 * we read it as source and assert the table declarations exist.
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
