import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('SendGrid provider', () => {
  it('provider name is "sendgrid"', async () => {
    const { sendgrid } = await import('../../src/providers/sendgrid.mjs');
    assert.strictEqual(sendgrid.name, 'sendgrid');
  });

  it('channels include "email"', async () => {
    const { sendgrid } = await import('../../src/providers/sendgrid.mjs');
    assert.ok(sendgrid.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required key "sendgrid_api_key"', async () => {
    const { sendgrid } = await import('../../src/providers/sendgrid.mjs');
    const schema = sendgrid.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('sendgrid_api_key'), 'must require sendgrid_api_key');
  });
});
