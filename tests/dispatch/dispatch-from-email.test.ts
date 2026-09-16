import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture } from '../db/harness.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';
import { dispatchEvent } from '../../src/lib/dispatch.ts';
import { notification_logs } from '../../src/db/schema.ts';
import { mock } from 'node:test';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;
const originalDev = process.env.NOTIFICATIONS_DEV_MODE;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
  delete process.env.NOTIFICATIONS_DEV_MODE;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
  if (originalDev === undefined) delete process.env.NOTIFICATIONS_DEV_MODE;
  else process.env.NOTIFICATIONS_DEV_MODE = originalDev;
});

/**
 * Capture the params passed to provider.send. We mock `fetch` because the
 * sendgrid rule is exercised in prod mode (sendgrid is the provider used by
 * the seeded rules), and assert on the `from` field of the request body.
 */
async function seedTemplate(db: any, templateId: string) {
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: templateId,
    name: 'Order Confirmation',
    subject: 'Order {{ data.order.order_number }}',
    body_html: '<p>Hi</p>',
    body_text: null,
    created_at: now,
    updated_at: null,
  });
}

test("dispatch passes a rule's from_email as params.from", async () => {
  const { db } = await createTestDb();
  const now = new Date();
  const templateId = 'tpl-1';
  await seedTemplate(db, templateId);
  await insertFixture(db, 'notification_rules', {
    id: 'r-from',
    event_pattern: 'shop.order.created',
    template_id: templateId,
    provider_name: 'sendgrid',
    channel: 'email',
    to: '{{ data.order.customer_email }}',
    cc: null,
    bcc: null,
    from_email: 'orders@shop.com',
    active: true,
    created_at: now,
    updated_at: null,
  });
  await setSetting(db, 'sendgrid_api_key', encrypt('SG.key'));

  let sendBody: any = null;
  const fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
    sendBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 202,
      headers: { get: (h: string) => (h.toLowerCase() === 'x-message-id' ? 'msg' : null) },
      text: async () => '',
    };
  });

  await dispatchEvent(db, 'shop.order.created', {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: '42', customer_email: 'buyer@example.com' } },
  });

  fetchMock.mock.restore();
  assert.ok(sendBody, 'fetch must have been called');
  assert.strictEqual(sendBody.from.email, 'orders@shop.com');

  const logs = await db.select().from(notification_logs);
  const row = logs.find((l: any) => l.rule_id === 'r-from');
  assert.ok(row, 'expected a log row for the rule');
  assert.strictEqual(row.success, true);
});

test('dispatch passes no from for a null-from rule (provider falls back to settings)', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  const templateId = 'tpl-2';
  await seedTemplate(db, templateId);
  await insertFixture(db, 'notification_rules', {
    id: 'r-null',
    event_pattern: 'shop.order.created',
    template_id: templateId,
    provider_name: 'sendgrid',
    channel: 'email',
    to: '{{ data.order.customer_email }}',
    cc: null,
    bcc: null,
    from_email: null,
    active: true,
    created_at: now,
    updated_at: null,
  });
  await setSetting(db, 'sendgrid_api_key', encrypt('SG.key'));
  await setSetting(db, 'sendgrid_from_email', encrypt('default@shop.com'));

  let sendBody: any = null;
  const fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: any) => {
    sendBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 202,
      headers: { get: (h: string) => (h.toLowerCase() === 'x-message-id' ? 'msg' : null) },
      text: async () => '',
    };
  });

  await dispatchEvent(db, 'shop.order.created', {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: '42', customer_email: 'buyer@example.com' } },
  });

  fetchMock.mock.restore();
  assert.ok(sendBody, 'fetch must have been called');
  // The null-from rule omits `from`, so the provider falls back to its settings default.
  assert.strictEqual(sendBody.from.email, 'default@shop.com');
});
