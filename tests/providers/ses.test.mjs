import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('SES provider', () => {
  it('provider name is "ses"', async () => {
    const { ses } = await import('../../src/providers/ses.mjs');
    assert.strictEqual(ses.name, 'ses');
  });

  it('channels include "email"', async () => {
    const { ses } = await import('../../src/providers/ses.mjs');
    assert.ok(ses.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required keys "ses_region", "ses_access_key", "ses_secret_key"', async () => {
    const { ses } = await import('../../src/providers/ses.mjs');
    const schema = ses.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('ses_region'), 'must require ses_region');
    assert.ok(schema.requiredKeys.includes('ses_access_key'), 'must require ses_access_key');
    assert.ok(schema.requiredKeys.includes('ses_secret_key'), 'must require ses_secret_key');
  });
});
