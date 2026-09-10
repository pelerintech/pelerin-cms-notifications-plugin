import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../../db/harness.ts';
import { setSetting } from '../../../src/lib/data/settings.ts';
import { encrypt } from '../../../src/lib/crypto.ts';
import {
  isProviderConfigured,
  listAvailableProvidersForChannel,
} from '../../../src/lib/data/providers.ts';
import '../../../src/providers/index.ts'; // trigger auto-registration

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

describe('isProviderConfigured', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
  });

  test('all required keys present and non-empty → true', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('SG.realkey'));
    assert.strictEqual(await isProviderConfigured(db, 'sendgrid'), true);
  });

  test('no settings rows at all → false', async () => {
    assert.strictEqual(await isProviderConfigured(db, 'sendgrid'), false);
  });

  test('partial keys (brevo with only api_key) → false', async () => {
    await setSetting(db, 'brevo_api_key', encrypt('xkeysib-abc'));
    assert.strictEqual(await isProviderConfigured(db, 'brevo'), false);
  });

  test('empty-string value → false', async () => {
    await setSetting(db, 'sendgrid_api_key', '');
    assert.strictEqual(await isProviderConfigured(db, 'sendgrid'), false);
  });

  test('whitespace-only value → false', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('   '));
    assert.strictEqual(await isProviderConfigured(db, 'sendgrid'), false);
  });

  test('local → false (never selectable)', async () => {
    assert.strictEqual(await isProviderConfigured(db, 'local'), false);
  });

  test('smtp configured with host/port/user/pass even when smtp_tls is absent (TLS optional)', async () => {
    // Regression: smtp_tls was a required key but it is a boolean toggle, and an
    // unticked checkbox submits no value, so SMTP was never detected as
    // configured unless TLS was enabled. TLS must not gate configuration.
    await setSetting(db, 'smtp_host', encrypt('smtp.example.com'));
    await setSetting(db, 'smtp_port', encrypt('587'));
    await setSetting(db, 'smtp_username', encrypt('user@example.com'));
    await setSetting(db, 'smtp_password', encrypt('pw'));
    assert.strictEqual(await isProviderConfigured(db, 'smtp'), true);
  });

  test('smtp is still unconfigured without the required credential keys', async () => {
    await setSetting(db, 'smtp_host', encrypt('smtp.example.com'));
    // smtp_port, smtp_username, smtp_password missing
    assert.strictEqual(await isProviderConfigured(db, 'smtp'), false);
  });

  test('production rule-editor dropdown includes smtp when only host/port/user/pass set', async () => {
    await setSetting(db, 'smtp_host', encrypt('smtp.example.com'));
    await setSetting(db, 'smtp_port', encrypt('587'));
    await setSetting(db, 'smtp_username', encrypt('user@example.com'));
    await setSetting(db, 'smtp_password', encrypt('pw'));
    const available = await listAvailableProvidersForChannel(db, 'email', false);
    assert.ok(
      available.some((p) => p.name === 'smtp'),
      'smtp should be offered without TLS'
    );
  });

  test('unknown provider → false', async () => {
    assert.strictEqual(await isProviderConfigured(db, 'nonexistent'), false);
  });

  test('ses all four keys → true', async () => {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('noreply@example.com'));
    assert.strictEqual(await isProviderConfigured(db, 'ses'), true);
  });

  test('ses three of four keys → false', async () => {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    // ses_from_email missing
    assert.strictEqual(await isProviderConfigured(db, 'ses'), false);
  });
});
