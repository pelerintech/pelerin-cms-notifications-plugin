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
import { ses } from '../../src/providers/ses.ts';
import { local } from '../../src/providers/local.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;
const originalSendgridEnv = process.env.SENDGRID_API_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
  delete process.env.SENDGRID_API_KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
  if (originalSendgridEnv === undefined) delete process.env.SENDGRID_API_KEY;
  else process.env.SENDGRID_API_KEY = originalSendgridEnv;
});

describe('SendGrid provider credentials', () => {
  let db: any;
  let fetchMock: any;
  let captured: { url: string; init: any } | null;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    captured = null;
    fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      captured = { url, init };
      return {
        ok: true,
        status: 202,
        headers: { get: (h: string) => (h.toLowerCase() === 'x-message-id' ? 'msg-1' : null) },
        text: async () => '',
      };
    });
  });

  afterEach(() => {
    fetchMock.mock.restore();
  });

  test('reads decrypted API key from settings table (not process.env)', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('SG.real-key'));
    const result = await sendgrid.send({ to: ['a@b.com'], subject: 's', bodyText: 't' }, db);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.messageId, 'msg-1');
    assert.ok(captured, 'fetch was called');
    const auth = captured!.init.headers['Authorization'];
    assert.strictEqual(auth, 'Bearer SG.real-key');
  });

  test('no creds in db + no env → configuration error, fetch NOT called', async () => {
    const result = await sendgrid.send({ to: ['a@b.com'], subject: 's', bodyText: 't' }, db);
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /SendGrid API key not configured/);
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });
});

describe('Mailgun provider credentials', () => {
  let db: any;
  let fetchMock: any;
  let captured: { url: string; init: any } | null;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    captured = null;
    fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      captured = { url, init };
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

  test('reads decrypted URL + API key from settings table', async () => {
    await setSetting(db, 'mailgun_url', encrypt('https://api.mg.net/v3/d'));
    await setSetting(db, 'mailgun_api_key', encrypt('key-real'));
    const result = await mailgun.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, true);
    assert.ok(captured, 'fetch was called');
    assert.ok(String(captured!.url).endsWith('/messages'), `url was ${captured!.url}`);
    const expected = `Basic ${Buffer.from('api:key-real').toString('base64')}`;
    assert.strictEqual(captured!.init.headers['Authorization'], expected);
  });

  test('no creds in db + no env → configuration error, fetch NOT called', async () => {
    const result = await mailgun.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /Mailgun API key not configured/);
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });
});

describe('Brevo provider credentials', () => {
  let db: any;
  let fetchMock: any;
  let captured: { url: string; init: any } | null;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    captured = null;
    fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      captured = { url, init };
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

  test('reads decrypted API key + URL from settings table', async () => {
    await setSetting(db, 'brevo_api_key', encrypt('xkeysib-real'));
    await setSetting(db, 'brevo_api_url', encrypt('https://api.brevo.com/v3/smtp/email'));
    const result = await brevo.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, true);
    assert.ok(captured, 'fetch was called');
    assert.strictEqual(captured!.init.headers['api-key'], 'xkeysib-real');
  });

  test('no creds in db + no env → configuration error, fetch NOT called', async () => {
    const result = await brevo.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /Brevo API key not configured/);
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });
});

describe('SMTP provider credentials', () => {
  let db: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
  });

  test('with creds present → gets past validation (error is "SMTP request failed", not "configuration incomplete")', async () => {
    await setSetting(db, 'smtp_host', encrypt('smtp.example.com'));
    await setSetting(db, 'smtp_port', encrypt('587'));
    await setSetting(db, 'smtp_username', encrypt('user'));
    await setSetting(db, 'smtp_password', encrypt('pass'));
    await setSetting(db, 'smtp_tls', encrypt('true'));
    const result = await smtp.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /SMTP request failed/);
    assert.doesNotMatch(result.error || '', /configuration incomplete/);
  });

  test('no creds in db → "SMTP configuration incomplete"', async () => {
    const result = await smtp.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /SMTP configuration incomplete/);
  });
});

describe('SES provider credentials', () => {
  let db: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
  });

  test('no creds in db → "AWS SES credentials not configured"', async () => {
    const result = await ses.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /AWS SES credentials not configured/);
  });
});

describe('Local provider', () => {
  test('send(params, db) ignores db and returns success with local- message id', async () => {
    const t = await createTestDb();
    const result = await local.send({ to: ['a@b.com'], subject: 's' }, t.db);
    assert.strictEqual(result.success, true);
    assert.match(result.messageId || '', /^local-/);
  });
});
