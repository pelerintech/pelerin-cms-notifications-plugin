/**
 * Tests that all 4 non-SES providers fail loud when the from-email is not
 * configured. The from-email is now read from the settings table (via
 * `*_from_email`), not from `process.env`, so the settings must NOT contain a
 * `*_from_email` value for these fail-loud assertions to hold.
 */
import { describe, test, before, after, beforeEach } from 'node:test';
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

describe('SendGrid from-email fail-loud', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'sendgrid_api_key', encrypt('sk-test'));
  });

  test('missing sendgrid_from_email setting returns error without network call', async () => {
    const { sendgrid } = await import('../../src/providers/sendgrid.ts');
    const result = await sendgrid.send({ to: ['a@b.com'], subject: 'S' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'SendGrid from email not configured');
  });
});

describe('Mailgun from-email fail-loud', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'mailgun_api_key', encrypt('mg-key'));
    await setSetting(db, 'mailgun_url', encrypt('https://api.mailgun.net/v3/domain.com'));
  });

  test('missing mailgun_from_email setting returns error without network call', async () => {
    const { mailgun } = await import('../../src/providers/mailgun.ts');
    const result = await mailgun.send({ to: ['a@b.com'], subject: 'S' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Mailgun from email not configured');
  });
});

describe('Brevo from-email fail-loud', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'brevo_api_key', encrypt('br-key'));
    await setSetting(db, 'brevo_api_url', encrypt('https://api.brevo.com/v3/smtp/email'));
  });

  test('missing brevo_from_email setting returns error without network call', async () => {
    const { brevo } = await import('../../src/providers/brevo.ts');
    const result = await brevo.send({ to: ['a@b.com'], subject: 'S' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Brevo from email not configured');
  });
});

describe('SMTP from-email fail-loud', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'smtp_host', encrypt('localhost'));
    await setSetting(db, 'smtp_port', encrypt('587'));
    await setSetting(db, 'smtp_username', encrypt('user'));
    await setSetting(db, 'smtp_password', encrypt('pass'));
  });

  test('missing smtp_from_email setting returns error without network call', async () => {
    const { smtp } = await import('../../src/providers/smtp.ts');
    const result = await smtp.send({ to: ['a@b.com'], subject: 'S' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'SMTP from email not configured');
  });
});
