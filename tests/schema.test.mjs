import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';

describe('Database schema', () => {
  it('exports notification_rules table', async () => {
    const config = await import('../src/db/config.mjs');
    assert.ok(config.notification_rules, 'notification_rules must be exported');
  });

  it('exports notification_templates table', async () => {
    const config = await import('../src/db/config.mjs');
    assert.ok(config.notification_templates, 'notification_templates must be exported');
  });

  it('exports notification_settings table', async () => {
    const config = await import('../src/db/config.mjs');
    assert.ok(config.notification_settings, 'notification_settings must be exported');
  });
});
