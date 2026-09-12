/**
 * Test that init.ts consumes the bus as `(event, payload)` and forwards the
 * delivered event name + envelope directly to `dispatchEvent` — it must NOT
 * reverse-engineer the event name from the payload (`data.event ?? data.name`)
 * nor re-wrap the payload (`data.payload ?? {}`).
 *
 * Verifies:
 * - The injected stub `subscribe` invokes `handler(event, payload)` (two args).
 * - `dispatchEvent` receives the bus event name and the envelope, so
 *   `{{data.order.*}}` renders against the envelope (not `{}`).
 * - A missing event name logs a warning and does not dispatch.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';

// Turn on dev mode so dispatch works without external credentials
process.env.NOTIFICATIONS_DEV_MODE = 'true';

test('init.ts: subscribes as (event, payload) and forwards the envelope untouched', async () => {
  const { db, cleanup } = await createTestDb();

  const { createTemplate } = await import('../../src/lib/data/templates.ts');
  const { createRule } = await import('../../src/lib/data/rules.ts');

  const tpl = await createTemplate(db, {
    name: 'Order',
    subject: 'Order {{ data.order.order_number }}',
    body_text: 'OK {{ data.order.order_number }}',
  });
  const rule = await createRule(db, {
    event_pattern: 'shop.order.confirmed',
    template_id: tpl.id,
    provider_name: 'sendgrid',
    to: '{{ data.order.customer_email }}',
  });

  let subscribedHandler: ((event: any, payload: any) => Promise<void>) | null = null;
  const fakeCtx = {
    db,
    events: {
      subscribe(_pattern: string, handler: (event: any, payload: any) => Promise<void>) {
        subscribedHandler = handler;
      },
    },
  };

  const initModule = await import('../../src/init.ts');
  initModule.default(fakeCtx);
  assert.ok(subscribedHandler !== null, 'init must subscribe to *');

  const { notification_logs } = await import('../../src/db/schema.ts');

  // Bus delivers (event, envelope) with a two-arg handler invocation.
  await subscribedHandler!('shop.order.confirmed', {
    event: 'shop.order.confirmed',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: '42', customer_email: 'buyer@example.com' } },
  });

  const logs = await db.select().from(notification_logs);
  const log = logs.find((l: any) => l.rule_id === rule.id);
  assert.ok(log, 'expected a log row for the rule');
  assert.strictEqual(log.event_name, 'shop.order.confirmed', 'event name comes from the bus arg');
  assert.strictEqual(
    log.subject,
    'Order 42',
    '{{data.order.order_number}} renders from the envelope'
  );
  assert.strictEqual(log.to, 'buyer@example.com', 'recipients render from the envelope');
  assert.strictEqual(log.success, true);

  await cleanup();
});

test('init.ts: a missing event name logs a warning and does not dispatch', async () => {
  const { db, cleanup } = await createTestDb();

  let subscribedHandler: ((event: any, payload: any) => Promise<void>) | null = null;
  const fakeCtx = {
    db,
    events: {
      subscribe(_pattern: string, handler: (event: any, payload: any) => Promise<void>) {
        subscribedHandler = handler;
      },
    },
  };

  const initModule = await import('../../src/init.ts');
  initModule.default(fakeCtx);
  assert.ok(subscribedHandler !== null, 'init must subscribe to *');

  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  try {
    await subscribedHandler!(undefined, { event: 'x', timestamp: 't', data: {} });
  } finally {
    console.warn = originalWarn;
  }

  const { notification_logs } = await import('../../src/db/schema.ts');
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 0, 'no dispatch when event name is missing');
  assert.ok(
    warnings.some((m) => m.includes('without name')),
    'expected a warning about a missing event name'
  );

  await cleanup();
});
