/**
 * Tests that all 4 non-SES providers fail loud when FROM_EMAIL is not set.
 */
import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;
const originalFrom = {
  sendgrid: process.env.SENDGRID_FROM_EMAIL,
  mailgun: process.env.MAILGUN_FROM_EMAIL,
  brevo: process.env.BREVO_FROM_EMAIL,
  smtp: process.env.SMTP_FROM_EMAIL,
};

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
  // Delete all FROM_EMAIL env vars so providers fail loud
  delete process.env.SENDGRID_FROM_EMAIL;
  delete process.env.MAILGUN_FROM_EMAIL;
  delete process.env.BREVO_FROM_EMAIL;
  delete process.env.SMTP_FROM_EMAIL;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
  if (originalFrom.sendgrid === undefined) delete process.env.SENDGRID_FROM_EMAIL;
  else process.env.SENDGRID_FROM_EMAIL = originalFrom.sendgrid;
  if (originalFrom.mailgun === undefined) delete process.env.MAILGUN_FROM_EMAIL;
  else process.env.MAILGUN_FROM_EMAIL = originalFrom.mailgun;
  if (originalFrom.brevo === undefined) delete process.env.BREVO_FROM_EMAIL;
  else process.env.BREVO_FROM_EMAIL = originalFrom.brevo;
  if (originalFrom.smtp === undefined) delete process.env.SMTP_FROM_EMAIL;
  else process.env.SMTP_FROM_EMAIL = originalFrom.smtp;
});

describe('SendGrid from-email fail-loud', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'sendgrid_api_key', encrypt('sk-test'));
  });

  test('missing SENDGRID_FROM_EMAIL returns error without network call', async () => {
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

  test('missing MAILGUN_FROM_EMAIL returns error without network call', async () => {
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

  test('missing BREVO_FROM_EMAIL returns error without network call', async () => {
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

  test('missing SMTP_FROM_EMAIL returns error without network call', async () => {
    const { smtp } = await import('../../src/providers/smtp.ts');
    const result = await smtp.send({ to: ['a@b.com'], subject: 'S' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'SMTP from email not configured');
  });
});
