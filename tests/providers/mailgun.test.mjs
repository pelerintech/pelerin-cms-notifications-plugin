import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Mailgun provider', () => {
  it('provider name is "mailgun"', async () => {
    const { mailgun } = await import('../../src/providers/mailgun.mjs');
    assert.strictEqual(mailgun.name, 'mailgun');
  });

  it('channels include "email"', async () => {
    const { mailgun } = await import('../../src/providers/mailgun.mjs');
    assert.ok(mailgun.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required keys "mailgun_url" and "mailgun_api_key"', async () => {
    const { mailgun } = await import('../../src/providers/mailgun.mjs');
    const schema = mailgun.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('mailgun_url'), 'must require mailgun_url');
    assert.ok(schema.requiredKeys.includes('mailgun_api_key'), 'must require mailgun_api_key');
  });
});
