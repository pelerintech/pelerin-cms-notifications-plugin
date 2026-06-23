import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sendgrid } from '../../src/providers/sendgrid.ts';

describe('SendGrid provider', () => {
  it('provider name is "sendgrid"', () => {
    assert.strictEqual(sendgrid.name, 'sendgrid');
  });

  it('channels include "email"', () => {
    assert.ok(sendgrid.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required key "sendgrid_api_key"', () => {
    const schema = sendgrid.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('sendgrid_api_key'), 'must require sendgrid_api_key');
  });
});
