import { describe, it } from 'node:test';
import assert from 'node:assert';
import { brevo } from '../../src/providers/brevo.ts';

describe('Brevo provider', () => {
  it('provider name is "brevo"', () => {
    assert.strictEqual(brevo.name, 'brevo');
  });

  it('channels include "email"', () => {
    assert.ok(brevo.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required key "brevo_api_key"', () => {
    const schema = brevo.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('brevo_api_key'), 'must require brevo_api_key');
  });
});
