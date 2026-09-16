import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { createTestDb } from '../db/harness.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';
import { sendgrid } from '../../src/providers/sendgrid.ts';
import { mailgun } from '../../src/providers/mailgun.ts';
import { brevo } from '../../src/providers/brevo.ts';
import { smtp } from '../../src/providers/smtp.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;
const originalFromEmails = {
  sendgrid: process.env.SENDGRID_FROM_EMAIL,
  mailgun: process.env.MAILGUN_FROM_EMAIL,
  brevo: process.env.BREVO_FROM_EMAIL,
  smtp: process.env.SMTP_FROM_EMAIL,
};

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
  // Ensure env FROM_EMAIL vars are UNset so the "env ignored" scenario holds.
  delete process.env.SENDGRID_FROM_EMAIL;
  delete process.env.MAILGUN_FROM_EMAIL;
  delete process.env.BREVO_FROM_EMAIL;
  delete process.env.SMTP_FROM_EMAIL;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
  if (originalFromEmails.sendgrid === undefined) delete process.env.SENDGRID_FROM_EMAIL;
  else process.env.SENDGRID_FROM_EMAIL = originalFromEmails.sendgrid;
  if (originalFromEmails.mailgun === undefined) delete process.env.MAILGUN_FROM_EMAIL;
  else process.env.MAILGUN_FROM_EMAIL = originalFromEmails.mailgun;
  if (originalFromEmails.brevo === undefined) delete process.env.BREVO_FROM_EMAIL;
  else process.env.BREVO_FROM_EMAIL = originalFromEmails.brevo;
  if (originalFromEmails.smtp === undefined) delete process.env.SMTP_FROM_EMAIL;
  else process.env.SMTP_FROM_EMAIL = originalFromEmails.smtp;
});

describe('SendGrid from-email precedence', () => {
  let db: any;
  let fetchMock: any;
  let captured: { init: any } | null;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    captured = null;
    await setSetting(db, 'sendgrid_api_key', encrypt('SG.key'));
    fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      captured = { init };
      return {
        ok: true,
        status: 202,
        headers: { get: (h: string) => (h.toLowerCase() === 'x-message-id' ? 'msg' : null) },
        text: async () => '',
      };
    });
  });

  afterEach(() => {
    fetchMock.mock.restore();
  });

  test('falls back to the settings default when params.from is absent', async () => {
    await setSetting(db, 'sendgrid_from_email', encrypt('default@shop.com'));
    const result = await sendgrid.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, true);
    const body = JSON.parse(captured!.init.body);
    assert.strictEqual(body.from.email, 'default@shop.com');
  });

  test('params.from wins over the settings default', async () => {
    await setSetting(db, 'sendgrid_from_email', encrypt('default@shop.com'));
    const result = await sendgrid.send(
      { to: ['a@b.com'], subject: 's', from: 'override@example.com' },
      db
    );
    assert.strictEqual(result.success, true);
    const body = JSON.parse(captured!.init.body);
    assert.strictEqual(body.from.email, 'override@example.com');
  });

  test('fails loud when neither setting nor params.from is present', async () => {
    const result = await sendgrid.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'SendGrid from email not configured');
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });

  test('process.env FROM_EMAIL is ignored (env read removed)', async () => {
    process.env.SENDGRID_FROM_EMAIL = 'env@example.com';
    const result = await sendgrid.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'SendGrid from email not configured');
    delete process.env.SENDGRID_FROM_EMAIL;
  });
});

describe('Mailgun from-email precedence', () => {
  let db: any;
  let fetchMock: any;
  let captured: { init: any } | null;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    captured = null;
    await setSetting(db, 'mailgun_api_key', encrypt('mg-key'));
    await setSetting(db, 'mailgun_url', encrypt('https://api.mailgun.net/v3/domain.com'));
    fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      captured = { init };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'mg-1' }),
      };
    });
  });

  afterEach(() => {
    fetchMock.mock.restore();
  });

  test('falls back to the settings default when params.from is absent', async () => {
    await setSetting(db, 'mailgun_from_email', encrypt('default@shop.com'));
    const result = await mailgun.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, true);
    const entries = new Map<string, string>();
    for (const [k, v] of (captured!.init.body as FormData).entries()) entries.set(k, v as string);
    assert.strictEqual(entries.get('from'), 'default@shop.com');
  });

  test('params.from wins over the settings default', async () => {
    await setSetting(db, 'mailgun_from_email', encrypt('default@shop.com'));
    const result = await mailgun.send(
      { to: ['a@b.com'], subject: 's', from: 'override@example.com' },
      db
    );
    assert.strictEqual(result.success, true);
    const entries = new Map<string, string>();
    for (const [k, v] of (captured!.init.body as FormData).entries()) entries.set(k, v as string);
    assert.strictEqual(entries.get('from'), 'override@example.com');
  });

  test('fails loud when neither is present', async () => {
    const result = await mailgun.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Mailgun from email not configured');
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });
});

describe('Brevo from-email precedence', () => {
  let db: any;
  let fetchMock: any;
  let captured: { init: any } | null;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    captured = null;
    await setSetting(db, 'brevo_api_key', encrypt('br-key'));
    await setSetting(db, 'brevo_api_url', encrypt('https://api.brevo.com/v3/smtp/email'));
    fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      captured = { init };
      return {
        ok: true,
        status: 200,
        json: async () => ({ messageId: 'br-1' }),
      };
    });
  });

  afterEach(() => {
    fetchMock.mock.restore();
  });

  test('falls back to the settings default when params.from is absent', async () => {
    await setSetting(db, 'brevo_from_email', encrypt('default@shop.com'));
    const result = await brevo.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, true);
    const body = JSON.parse(captured!.init.body);
    assert.deepStrictEqual(body.sender, { email: 'default@shop.com' });
  });

  test('params.from wins over the settings default', async () => {
    await setSetting(db, 'brevo_from_email', encrypt('default@shop.com'));
    const result = await brevo.send(
      { to: ['a@b.com'], subject: 's', from: 'override@example.com' },
      db
    );
    assert.strictEqual(result.success, true);
    const body = JSON.parse(captured!.init.body);
    assert.deepStrictEqual(body.sender, { email: 'override@example.com' });
  });

  test('fails loud when neither is present', async () => {
    const result = await brevo.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Brevo from email not configured');
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });
});

describe('SMTP from-email precedence', () => {
  let db: any;
  let mod: any;
  let capturedMail: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'smtp_host', encrypt('smtp.example.com'));
    await setSetting(db, 'smtp_port', encrypt('587'));
    await setSetting(db, 'smtp_username', encrypt('user'));
    await setSetting(db, 'smtp_password', encrypt('pass'));
    mod = await import('../../src/providers/smtp.ts');
    capturedMail = null;
    mod.setTransportFactory(async () => ({
      sendMail: async (opts: any) => {
        capturedMail = opts;
        return { messageId: 'test-id' };
      },
    }));
  });

  afterEach(() => {
    mod?.resetTransportFactory?.();
  });

  test('falls back to the settings default when params.from is absent', async () => {
    await setSetting(db, 'smtp_from_email', encrypt('default@shop.com'));
    const result = await mod.smtp.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, true);
    assert.strictEqual(capturedMail.from, 'default@shop.com');
  });

  test('params.from wins over the settings default', async () => {
    await setSetting(db, 'smtp_from_email', encrypt('default@shop.com'));
    const result = await mod.smtp.send(
      { to: ['a@b.com'], subject: 's', from: 'override@example.com' },
      db
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(capturedMail.from, 'override@example.com');
  });

  test('fails loud when neither is present', async () => {
    const result = await mod.smtp.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'SMTP from email not configured');
    assert.strictEqual(capturedMail, null);
  });

  test('process.env SMTP_FROM_EMAIL is ignored', async () => {
    process.env.SMTP_FROM_EMAIL = 'env@example.com';
    const result = await mod.smtp.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'SMTP from email not configured');
    delete process.env.SMTP_FROM_EMAIL;
  });
});
