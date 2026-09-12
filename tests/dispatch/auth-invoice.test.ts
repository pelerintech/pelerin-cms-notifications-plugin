/**
 * Auth + invoice dispatch tests for the event-contract.
 *
 * CMS auth events (`pelerin-cms.user.*`) and the ecomm `shop.order.invoice`
 * event ride the rule → template → send path once the envelope is valid.
 * Auth templates use `{{data.user.*}}` / `{{data.url}}`; invoice reuses the
 * order payload (`{{data.order.*}}`).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture } from '../db/harness.ts';
import { notification_logs } from '../../src/db/schema.ts';
import { dispatchEvent } from '../../src/lib/dispatch.ts';

process.env.NOTIFICATIONS_DEV_MODE = 'true';

async function seedAuthRule(db: any, event: string, subject: string, to: string) {
  const now = new Date();
  const tid = `t-${event.replace(/\./g, '-')}`;
  const rid = `r-${event.replace(/\./g, '-')}`;
  await insertFixture(db, 'notification_templates', {
    id: tid,
    name: event,
    subject,
    body_html: null,
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: rid,
    event_pattern: event,
    template_id: tid,
    provider_name: 'sendgrid',
    to,
    active: true,
    created_at: now,
  });
  return rid;
}

test('pelerin-cms.user.registered dispatches with {{data.user.email}}', async () => {
  const { db } = await createTestDb();
  await seedAuthRule(
    db,
    'pelerin-cms.user.registered',
    'Welcome {{ data.user.name }}',
    '{{ data.user.email }}'
  );
  await dispatchEvent(db, 'pelerin-cms.user.registered', {
    event: 'pelerin-cms.user.registered',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { user: { email: 'x@y.com', name: 'X' } },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, true);
  assert.strictEqual(logs[0].to, 'x@y.com');
  assert.strictEqual(logs[0].subject, 'Welcome X');
});

test('pelerin-cms.user.password-changed dispatches', async () => {
  const { db } = await createTestDb();
  await seedAuthRule(
    db,
    'pelerin-cms.user.password-changed',
    'Password changed',
    '{{ data.user.email }}'
  );
  await dispatchEvent(db, 'pelerin-cms.user.password-changed', {
    event: 'pelerin-cms.user.password-changed',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { user: { email: 'x@y.com' } },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, true);
});

test('pelerin-cms.user.password-reset-requested dispatches with {{data.url}}', async () => {
  const { db } = await createTestDb();
  await seedAuthRule(
    db,
    'pelerin-cms.user.password-reset-requested',
    'Reset: {{ data.url }}',
    '{{ data.user.email }}'
  );
  await dispatchEvent(db, 'pelerin-cms.user.password-reset-requested', {
    event: 'pelerin-cms.user.password-reset-requested',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { user: { email: 'x@y.com' }, url: 'https://example.com/reset/abc' },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, true);
  assert.strictEqual(logs[0].subject, 'Reset: https://example.com/reset/abc');
});

test('shop.order.invoice dispatches via the order payload ({{data.order.order_number}})', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't-inv',
    name: 'Invoice',
    subject: 'Invoice {{ data.order.order_number }}',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-inv',
    event_pattern: 'shop.order.invoice',
    template_id: 't-inv',
    provider_name: 'sendgrid',
    to: '{{ data.order.customer_email }}',
    active: true,
    created_at: now,
  });
  await dispatchEvent(db, 'shop.order.invoice', {
    event: 'shop.order.invoice',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: 'INV-1', customer_email: 'buyer@example.com' }, items: [] },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, true);
  assert.strictEqual(logs[0].subject, 'Invoice INV-1');
  assert.strictEqual(logs[0].to, 'buyer@example.com');
});
