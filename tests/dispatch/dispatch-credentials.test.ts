import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { createTestDb, seedMinimal, insertFixture } from '../db/harness.ts';
import { notification_logs, notification_settings } from '../../src/db/schema.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';
import { dispatchEvent } from '../../src/lib/dispatch.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;
const originalDevMode = process.env.NOTIFICATIONS_DEV_MODE;
const originalSendgridEnv = process.env.SENDGRID_API_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
  delete process.env.SENDGRID_API_KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
  if (originalDevMode === undefined) delete process.env.NOTIFICATIONS_DEV_MODE;
  else process.env.NOTIFICATIONS_DEV_MODE = originalDevMode;
  if (originalSendgridEnv === undefined) delete process.env.SENDGRID_API_KEY;
  else process.env.SENDGRID_API_KEY = originalSendgridEnv;
});

describe('dispatch credential pass-through (structural)', () => {
  test('dispatch.ts source passes db as second arg to provider.send', () => {
    const src = readFileSync(new URL('../../src/lib/dispatch.ts', import.meta.url), 'utf-8');
    assert.ok(
      /provider\.send\(\s*\{[\s\S]*\}\s*,\s*db\s*\)/.test(src),
      'dispatch must call provider.send({...}, db)',
    );
  });
});

describe('dispatch credential pass-through (behavioral)', () => {
  let db: any;
  let fetchMock: any;
  let captured: { url: string; init: any } | null;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    captured = null;
    delete process.env.NOTIFICATIONS_DEV_MODE;
    fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      captured = { url, init };
      return {
        ok: true,
        status: 202,
        headers: { get: (h: string) => (h.toLowerCase() === 'x-message-id' ? 'msg-dispatch-1' : null) },
        text: async () => '',
      };
    });
  });

  afterEach(() => {
    fetchMock.mock.restore();
  });

  test('prod mode: sendgrid rule with encrypted creds → real send, success log', async () => {
    await seedMinimal(db);
    await setSetting(db, 'sendgrid_api_key', encrypt('SG.real-key'));
    await dispatchEvent(db, 'shop.order.created', {
      order_id: '42',
      customer_email: 'buyer@example.com',
    });
    assert.ok(captured, 'fetch was called');
    assert.strictEqual(captured!.init.headers['Authorization'], 'Bearer SG.real-key');
    const logs = await db.select().from(notification_logs);
    const row = logs.find((l: any) => l.provider_name === 'sendgrid');
    assert.ok(row, 'expected a sendgrid log row');
    assert.strictEqual(row.success, true);
    assert.strictEqual(row.message_id, 'msg-dispatch-1');
    assert.strictEqual(row.to, 'buyer@example.com');
  });

  test('prod mode: no creds anywhere → failure log, fetch NOT called', async () => {
    await seedMinimal(db);
    await dispatchEvent(db, 'shop.order.created', {
      order_id: '42',
      customer_email: 'buyer@example.com',
    });
    assert.strictEqual(fetchMock.mock.callCount(), 0);
    const logs = await db.select().from(notification_logs);
    const row = logs.find((l: any) => l.provider_name === 'sendgrid');
    assert.ok(row, 'expected a sendgrid log row');
    assert.strictEqual(row.success, false);
    assert.match(row.error || '', /SendGrid API key not configured/);
  });

  test('dev mode ON → local provider, message_id local-, fetch NOT called, provider_name preserved', async () => {
    process.env.NOTIFICATIONS_DEV_MODE = 'true';
    await seedMinimal(db);
    await dispatchEvent(db, 'shop.order.created', {
      order_id: '42',
      customer_email: 'buyer@example.com',
    });
    assert.strictEqual(fetchMock.mock.callCount(), 0);
    const logs = await db.select().from(notification_logs);
    const row = logs.find((l: any) => l.provider_name === 'sendgrid');
    assert.ok(row, 'expected a sendgrid log row');
    assert.strictEqual(row.success, true);
    assert.match(row.message_id || '', /^local-/);
    delete process.env.NOTIFICATIONS_DEV_MODE;
  });
});
