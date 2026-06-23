import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mailgun } from '../../src/providers/mailgun.ts';

describe('Mailgun provider', () => {
  it('provider name is "mailgun"', () => {
    assert.strictEqual(mailgun.name, 'mailgun');
  });

  it('channels include "email"', () => {
    assert.ok(mailgun.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required keys "mailgun_url" and "mailgun_api_key"', () => {
    const schema = mailgun.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('mailgun_url'), 'must require mailgun_url');
    assert.ok(schema.requiredKeys.includes('mailgun_api_key'), 'must require mailgun_api_key');
  });
});
