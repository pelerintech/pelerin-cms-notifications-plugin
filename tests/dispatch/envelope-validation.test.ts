/**
 * Dispatch envelope-validation tests for the event-contract.
 *
 * `dispatchEvent` must validate the delivered payload against the
 * `EventEnvelope` shape (`{ event, timestamp, data }`) before rendering, and
 * deep-validate known event families. A malformed / mismatched payload fails
 * LOUDLY — a `success:false` log row with a descriptive `error`, no send.
 * Unknown families are envelope-validated only (no deep schema rejection).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture } from '../db/harness.ts';
import { notification_logs } from '../../src/db/schema.ts';
import { dispatchEvent } from '../../src/lib/dispatch.ts';
import { mock } from 'node:test';

process.env.NOTIFICATIONS_DEV_MODE = 'true';

async function seedOrderRule(db: any, event = 'shop.order.confirmed') {
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't-val',
    name: 'Order',
    subject: 'Order {{ data.order.order_number }}',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-val',
    event_pattern: event,
    template_id: 't-val',
    provider_name: 'sendgrid',
    to: '{{ data.order.customer_email }}',
    active: true,
    created_at: now,
  });
}

test('a valid envelope that matches a rule dispatches (success)', async () => {
  const { db } = await createTestDb();
  await seedOrderRule(db);
  await dispatchEvent(db, 'shop.order.confirmed', {
    event: 'shop.order.confirmed',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: '42', customer_email: 'a@b.com' } },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, true);
});

test('a payload missing data fails loudly (success:false) and does not send', async () => {
  const { db } = await createTestDb();
  await seedOrderRule(db);
  const sendMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('should not be called');
  });
  try {
    await dispatchEvent(db, 'shop.order.confirmed', {
      event: 'shop.order.confirmed',
      timestamp: '2026-07-24T10:00:00.000Z',
    });
    assert.strictEqual(sendMock.mock.callCount(), 0, 'no network send');
    const logs = await db.select().from(notification_logs);
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].success, false);
    assert.match(logs[0].error || '', /Invalid event envelope/);
  } finally {
    sendMock.mock.restore();
  }
});

test('a non-object payload is rejected (success:false)', async () => {
  const { db } = await createTestDb();
  await seedOrderRule(db);
  await dispatchEvent(db, 'shop.order.confirmed', 'not-an-object');
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, false);
  assert.match(logs[0].error || '', /Invalid event envelope/);
});

test('an order envelope missing data.order is rejected (family validation)', async () => {
  const { db } = await createTestDb();
  await seedOrderRule(db);
  await dispatchEvent(db, 'shop.order.confirmed', {
    event: 'shop.order.confirmed',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: {},
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, false);
  assert.match(logs[0].error || '', /data\.order/);
});

test('an unvalidated (custom) family envelope renders (envelope-validated only)', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't-custom',
    name: 'Custom',
    subject: 'Arbitrary {{ data.arbitrary }}',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-custom',
    event_pattern: 'custom.thing',
    template_id: 't-custom',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    active: true,
    created_at: now,
  });
  await dispatchEvent(db, 'custom.thing', {
    event: 'custom.thing',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { arbitrary: 1 },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, true);
});
