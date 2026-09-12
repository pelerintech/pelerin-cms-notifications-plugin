/**
 * Dev mode behavioral test.
 *
 * In dev mode (NOTIFICATIONS_DEV_MODE=true), dispatch uses the local provider
 * which returns success without a network call. This test verifies the full
 * dispatch path: rule matching, template interpolation, local provider send,
 * and notification_logs row creation.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from './db/harness.ts';
import { dispatchEvent } from '../src/lib/dispatch.ts';
import { notification_logs } from '../src/db/schema.ts';
import '../src/providers/index.ts';

const originalDevMode = process.env.NOTIFICATIONS_DEV_MODE;

before(() => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
});

after(() => {
  if (originalDevMode === undefined) delete process.env.NOTIFICATIONS_DEV_MODE;
  else process.env.NOTIFICATIONS_DEV_MODE = originalDevMode;
});

test('dev mode: dispatchEvent uses local provider and writes a full log row', async () => {
  const { db } = await createTestDb();
  const { seedMinimal } = await import('./db/harness.ts');
  const { exactRuleId } = await seedMinimal(db);

  await dispatchEvent(db, 'shop.order.created', {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: '42', customer_email: 'buyer@example.com' } },
  });

  const logs = await db.select().from(notification_logs);
  const log = logs.find((l: any) => l.rule_id === exactRuleId);
  assert.ok(log, 'expected a log row for the exact rule');
  assert.strictEqual(log.success, true);
  assert.ok(log.message_id?.startsWith('local-'), 'message_id should start with local-');
  // provider_name = rule's provider_name (sendgrid), NOT 'local'
  assert.strictEqual(log.provider_name, 'sendgrid', 'provider_name must match rule, not local');
  assert.strictEqual(log.to, 'buyer@example.com');
  assert.strictEqual(log.subject, 'Order 42');
  assert.strictEqual(log.body_html, '<p>Hi buyer@example.com</p>');
  assert.strictEqual(log.event_name, 'shop.order.created');
});

test('dev mode: local provider send() directly returns success', async () => {
  const { local } = await import('../src/providers/local.ts');
  const { db } = await createTestDb();
  const result = await local.send({ to: ['a@b.com'], subject: 'S', bodyHtml: '<p>h</p>' }, db);
  assert.strictEqual(result.success, true);
  assert.ok(result.messageId?.startsWith('local-'));
});
