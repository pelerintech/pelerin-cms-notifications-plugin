import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Brevo provider', () => {
  it('provider name is "brevo"', async () => {
    const { brevo } = await import('../../src/providers/brevo.mjs');
    assert.strictEqual(brevo.name, 'brevo');
  });

  it('channels include "email"', async () => {
    const { brevo } = await import('../../src/providers/brevo.mjs');
    assert.ok(brevo.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required key "brevo_api_key"', async () => {
    const { brevo } = await import('../../src/providers/brevo.mjs');
    const schema = brevo.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('brevo_api_key'), 'must require brevo_api_key');
  });
});
