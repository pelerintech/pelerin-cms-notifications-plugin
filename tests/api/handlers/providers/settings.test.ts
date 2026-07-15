import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb } from '../../../db/harness.ts';
import { getSetting, setSetting } from '../../../../src/lib/data/settings.ts';
import { encrypt, decryptIfNeeded, isEncrypted } from '../../../../src/lib/crypto.ts';
import { matrix } from '../_matrix.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});
after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

ensureLoader();
const { runGet, runPost } =
  await import('../../../../src/api/notifications/providers/[name]/settings.ts');

describe('runGet (providers/[name]/settings) — auth + masked retrieval', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
  });

  test('adminAuthFail → 401 + success:false', async () => {
    await matrix.adminAuthFail({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/providers/sendgrid/settings',
      params: { name: 'sendgrid' },
    });
  });

  test('happy-path: password field is masked to ****<last4>', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('SG.real-key-12345'));
    const res = await runGet({
      db,
      sdk: makeFakeSdk(),
      ctx: makeCtx({ url: 'http://localhost/api', params: { name: 'sendgrid' } }),
    });
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.success, true);
    assert.equal(b.data.sendgrid_api_key, '****2345');
    assert.equal(b.provider, 'sendgrid');
  });

  test('happy-path: text fields decrypted, password fields masked', async () => {
    await setSetting(db, 'mailgun_url', encrypt('https://api.mg.net/v3/d'));
    await setSetting(db, 'mailgun_api_key', encrypt('key-real'));
    const res = await runGet({
      db,
      sdk: makeFakeSdk(),
      ctx: makeCtx({ url: 'http://localhost/api', params: { name: 'mailgun' } }),
    });
    const b = await res.json();
    assert.equal(b.data.mailgun_url, 'https://api.mg.net/v3/d');
    assert.equal(b.data.mailgun_api_key, '****real');
  });

  test('no rows → empty data object', async () => {
    const res = await runGet({
      db,
      sdk: makeFakeSdk(),
      ctx: makeCtx({ url: 'http://localhost/api', params: { name: 'sendgrid' } }),
    });
    const b = await res.json();
    assert.deepEqual(b.data, {});
  });
});

describe('runPost (providers/[name]/settings) — auth + save', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
  });

  test('adminAuthFail → 401 + success:false', async () => {
    await matrix.adminAuthFail({
      run: runPost,
      url: 'http://localhost/api/plugins/notifications/providers/sendgrid/settings',
      body: { sendgrid_api_key: 'SG.new' },
      params: { name: 'sendgrid' },
    });
  });

  test('happy-path: save settings → 200 + data.saved', async () => {
    const res = await runPost({
      db,
      sdk: makeFakeSdk(),
      ctx: makeCtx({
        url: 'http://localhost/api',
        body: { sendgrid_api_key: 'SG.new-key' },
        params: { name: 'sendgrid' },
      }),
    });
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.success, true);
    assert.equal(b.data.provider, 'sendgrid');
    assert.equal(b.data.saved.sendgrid_api_key, true);

    const stored = await getSetting(db, 'sendgrid_api_key');
    assert.ok(stored && isEncrypted(stored), 'stored value must be encrypted');
    assert.equal(decryptIfNeeded(stored!), 'SG.new-key');
  });

  test('unchanged masked password is skipped', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('SG.real-key'));
    await runPost({
      db,
      sdk: makeFakeSdk(),
      ctx: makeCtx({
        url: 'http://localhost/api',
        body: { sendgrid_api_key: '****real' },
        params: { name: 'sendgrid' },
      }),
    });
    const stored = await getSetting(db, 'sendgrid_api_key');
    assert.equal(decryptIfNeeded(stored!), 'SG.real-key');
  });

  test('empty value is skipped', async () => {
    await runPost({
      db,
      sdk: makeFakeSdk(),
      ctx: makeCtx({
        url: 'http://localhost/api',
        body: { sendgrid_api_key: '' },
        params: { name: 'sendgrid' },
      }),
    });
    const stored = await getSetting(db, 'sendgrid_api_key');
    assert.equal(stored, null);
  });

  test('upsert: existing row is updated, not duplicated', async () => {
    await setSetting(db, 'sendgrid_api_key', encrypt('old'));
    await runPost({
      db,
      sdk: makeFakeSdk(),
      ctx: makeCtx({
        url: 'http://localhost/api',
        body: { sendgrid_api_key: 'new' },
        params: { name: 'sendgrid' },
      }),
    });
    const stored = await getSetting(db, 'sendgrid_api_key');
    assert.equal(decryptIfNeeded(stored!), 'new');
    const { notification_settings } = await import('../../../../src/db/schema.ts');
    const rows = await db.select().from(notification_settings);
    const matching = rows.filter((r: any) => r.key === 'sendgrid_api_key');
    assert.equal(matching.length, 1);
  });
});
