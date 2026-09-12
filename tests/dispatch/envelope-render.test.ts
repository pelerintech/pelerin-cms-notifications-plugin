/**
 * Dispatch behavioral test for the event-contract.
 *
 * Confirms `dispatchEvent` renders subject/body/recipients against the
 * delivered `EventEnvelope` (`{ event, timestamp, data }`), so existing order
 * templates using `{{data.order.*}}` keep working — no `data.payload` lookup.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture } from '../db/harness.ts';
import { notification_logs } from '../../src/db/schema.ts';
import { dispatchEvent } from '../../src/lib/dispatch.ts';

process.env.NOTIFICATIONS_DEV_MODE = 'true';

test('dispatchEvent renders a valid order envelope ({{data.order.*}}) with success', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't-env',
    name: 'Order',
    subject: 'Order {{ data.order.order_number }}',
    body_html: '<p>{{ data.order.customer_email }}</p>',
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-env',
    event_pattern: 'shop.order.confirmed',
    template_id: 't-env',
    provider_name: 'sendgrid',
    to: '{{ data.order.customer_email }}',
    active: true,
    created_at: now,
  });

  await dispatchEvent(db, 'shop.order.confirmed', {
    event: 'shop.order.confirmed',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: '42', customer_email: 'a@b.com' } },
  });

  const logs = await db.select().from(notification_logs);
  const log = logs.find((l: any) => l.rule_id === 'r-env');
  assert.ok(log, 'expected a log row');
  assert.strictEqual(log.success, true);
  assert.strictEqual(log.subject, 'Order 42');
  assert.strictEqual(log.to, 'a@b.com');
});
