import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';
import { getSetting, setSetting } from '../../src/lib/data/settings.ts';
import { encrypt, decryptIfNeeded, isEncrypted } from '../../src/lib/crypto.ts';
import {
  getSettingsHandler,
  saveSettingsHandler,
} from '../../src/api/notifications/providers/[name]/settings.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

describe('getSettingsHandler', () => {
  let db: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
  });

  test('password field is masked to ****<last4>', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('SG.real-key-12345'));
    const res = await getSettingsHandler(db, 'sendgrid');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      data: { sendgrid_api_key: '****2345' },
      provider: 'sendgrid',
    });
  });

  test('text fields are decrypted, password fields masked', async () => {
    await setSetting(db, 'mailgun_url', encrypt('https://api.mg.net/v3/d'));
    await setSetting(db, 'mailgun_api_key', encrypt('key-real'));
    const res = await getSettingsHandler(db, 'mailgun');
    assert.strictEqual(res.body.data.mailgun_url, 'https://api.mg.net/v3/d');
    assert.strictEqual(res.body.data.mailgun_api_key, '****real');
  });

  test('no rows → empty data object', async () => {
    const res = await getSettingsHandler(db, 'sendgrid');
    assert.deepStrictEqual(res.body, { data: {}, provider: 'sendgrid' });
  });
});

describe('saveSettingsHandler', () => {
  let db: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
  });

  test('encrypts and persists new values', async () => {
    const res = await saveSettingsHandler(db, 'sendgrid', { sendgrid_api_key: 'SG.new-key' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      data: { provider: 'sendgrid', saved: { sendgrid_api_key: true } },
      message: 'Settings saved successfully',
    });
    const stored = await getSetting(db, 'sendgrid_api_key');
    assert.ok(stored && isEncrypted(stored), 'stored value must be encrypted');
    assert.strictEqual(decryptIfNeeded(stored!), 'SG.new-key');
  });

  test('unchanged masked password is skipped', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('SG.real-key'));
    await saveSettingsHandler(db, 'sendgrid', { sendgrid_api_key: '****real' });
    const stored = await getSetting(db, 'sendgrid_api_key');
    assert.strictEqual(decryptIfNeeded(stored!), 'SG.real-key');
  });

  test('empty value is skipped', async () => {
    await saveSettingsHandler(db, 'sendgrid', { sendgrid_api_key: '' });
    const stored = await getSetting(db, 'sendgrid_api_key');
    assert.strictEqual(stored, null);
  });

  test('upsert: existing row is updated, not duplicated', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('old'));
    await saveSettingsHandler(db, 'sendgrid', { sendgrid_api_key: 'new' });
    const stored = await getSetting(db, 'sendgrid_api_key');
    assert.strictEqual(decryptIfNeeded(stored!), 'new');
    const { notification_settings } = await import('../../src/db/schema.ts');
    const rows = await db.select().from(notification_settings);
    const matching = rows.filter((r: any) => r.key === 'sendgrid_api_key');
    assert.strictEqual(matching.length, 1);
  });
});
