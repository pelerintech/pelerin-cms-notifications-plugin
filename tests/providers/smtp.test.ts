import { describe, it, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

import { smtp } from '../../src/providers/smtp.ts';

describe('SMTP provider metadata', () => {
  it('provider name is "smtp"', () => {
    assert.strictEqual(smtp.name, 'smtp');
  });

  it('channels include "email"', () => {
    assert.ok(smtp.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema requires the credential keys but not the smtp_tls boolean toggle', () => {
    const schema = smtp.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('smtp_host'), 'must require smtp_host');
    assert.ok(schema.requiredKeys.includes('smtp_port'), 'must require smtp_port');
    assert.ok(schema.requiredKeys.includes('smtp_username'), 'must require smtp_username');
    assert.ok(schema.requiredKeys.includes('smtp_password'), 'must require smtp_password');
    // smtp_tls is a boolean toggle (TLS on/off), not a credential; requiring it
    // made SMTP undetectable as "configured" whenever the checkbox was left
    // unticked (an unticked checkbox submits no value). It must not gate config.
    assert.ok(
      !schema.requiredKeys.includes('smtp_tls'),
      'smtp_tls must NOT be a required key (TLS is optional)'
    );
  });
});

describe('SMTP requireTLS behavior', () => {
  let db: any;
  let mod: any;
  let capturedConfig: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'smtp_host', encrypt('smtp.example.com'));
    await setSetting(db, 'smtp_port', encrypt('587'));
    await setSetting(db, 'smtp_username', encrypt('user'));
    await setSetting(db, 'smtp_password', encrypt('pass'));
    await setSetting(db, 'smtp_from_email', encrypt('sender@example.com'));
    mod = await import('../../src/providers/smtp.ts');
    capturedConfig = null;
  });

  afterEach(() => {
    mod?.resetTransportFactory?.();
    mod?.setSendTimeoutForTests?.(30_000);
  });

  test('smtp_tls=true adds requireTLS: true to transport config', async () => {
    await setSetting(db, 'smtp_tls', encrypt('true'));
    mod.setTransportFactory(async (config: any) => {
      capturedConfig = config;
      return { sendMail: async () => ({ messageId: 'test-id' }) };
    });
    const result = await mod.smtp.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    assert.strictEqual(result.success, true);
    assert.ok(capturedConfig, 'transport config was captured');
    assert.strictEqual(
      capturedConfig.requireTLS,
      true,
      'requireTLS should be true when smtp_tls=true'
    );
    assert.ok(capturedConfig.tls, 'tls should be set when smtp_tls=true');
    assert.strictEqual(capturedConfig.tls.rejectUnauthorized, true);
  });

  test('smtp_tls=false does not add requireTLS', async () => {
    await setSetting(db, 'smtp_tls', encrypt('false'));
    mod.setTransportFactory(async (config: any) => {
      capturedConfig = config;
      return { sendMail: async () => ({ messageId: 'test-id' }) };
    });
    const result = await mod.smtp.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    assert.strictEqual(result.success, true);
    assert.ok(capturedConfig, 'transport config was captured');
    assert.strictEqual(
      capturedConfig.requireTLS,
      undefined,
      'requireTLS should be undefined when smtp_tls=false'
    );
    assert.strictEqual(
      capturedConfig.tls,
      undefined,
      'tls should be undefined when smtp_tls=false'
    );
  });
});
