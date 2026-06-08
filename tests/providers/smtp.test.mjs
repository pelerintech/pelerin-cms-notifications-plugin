import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('SMTP provider', () => {
  it('provider name is "smtp"', async () => {
    const { smtp } = await import('../../src/providers/smtp.mjs');
    assert.strictEqual(smtp.name, 'smtp');
  });

  it('channels include "email"', async () => {
    const { smtp } = await import('../../src/providers/smtp.mjs');
    assert.ok(smtp.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required keys "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls"', async () => {
    const { smtp } = await import('../../src/providers/smtp.mjs');
    const schema = smtp.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('smtp_host'), 'must require smtp_host');
    assert.ok(schema.requiredKeys.includes('smtp_port'), 'must require smtp_port');
    assert.ok(schema.requiredKeys.includes('smtp_username'), 'must require smtp_username');
    assert.ok(schema.requiredKeys.includes('smtp_password'), 'must require smtp_password');
    assert.ok(schema.requiredKeys.includes('smtp_tls'), 'must require smtp_tls');
  });
});
