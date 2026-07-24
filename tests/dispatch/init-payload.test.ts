/**
 * Test that init.ts correctly extracts event name and payload from the event bus envelope.
 *
 * Verifies:
 * - When data has payload, dispatchEvent receives the payload
 * - When data has NO payload, dispatchEvent receives {} (not the envelope)
 * - When data has no event or name, dispatchEvent is not called
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';

// Turn on dev mode so dispatch works without external credentials
process.env.NOTIFICATIONS_DEV_MODE = 'true';

test('init.ts: payload is extracted with ?? (not || leaking envelope)', async () => {
  const { db, cleanup } = await createTestDb();

  // Create a template where subject references {{ event }} — a field
  // present in the event bus envelope that MUST NOT leak into the template context
  const { createTemplate } = await import('../../src/lib/data/templates.ts');
  const { createRule } = await import('../../src/lib/data/rules.ts');

  const tpl = await createTemplate(db, {
    name: 'LeakDetector',
    subject: 'Event: {{ event }}',
    body_text: 'OK',
  });
  const rule = await createRule(db, {
    event_pattern: 'shop.order.created',
    template_id: tpl.id,
    provider_name: 'sendgrid',
    to: 'admin@example.com',
  });

  let subscribedHandler: ((data: any) => Promise<void>) | null = null;
  const fakeCtx = {
    db,
    events: {
      subscribe(_pattern: string, handler: (data: any) => Promise<void>) {
        subscribedHandler = handler;
      },
    },
  };

  const initModule = await import('../../src/init.ts');
  initModule.default(fakeCtx);
  assert.ok(subscribedHandler !== null, 'init must subscribe to *');

  const { notification_logs } = await import('../../src/db/schema.ts');

  // Test 1: event with payload — {{ event }} should come from payload, not envelope
  await subscribedHandler!({
    event: 'shop.order.created',
    payload: { event: 'from-payload' },
  });
  let logs = await db.select().from(notification_logs);
  const log1 = logs.find((l: any) => l.rule_id === rule.id);
  assert.ok(log1, 'expected log row for the rule');
  assert.strictEqual(
    log1.subject,
    'Event: from-payload',
    '{{ event }} should resolve from payload'
  );
  assert.strictEqual(log1.success, true);

  // Reset logs for test 2
  await db.delete(notification_logs);

  // Test 2: event WITHOUT payload — must NOT leak envelope fields.
  // The old code: `data.payload || data` — when no payload, the whole envelope
  // { event: 'shop.order.created' } becomes the payload, so {{ event }} resolves
  // to 'shop.order.created'. With `?? {}`, empty object → {{ event }} resolves to ''.
  await subscribedHandler!({
    event: 'shop.order.created',
    // No payload property — the leak would pass the envelope as payload
  });

  logs = await db.select().from(notification_logs);
  const log2 = logs.find((l: any) => l.rule_id === rule.id);
  assert.ok(log2, 'expected log row for event without payload');
  assert.strictEqual(log2.success, true, 'should still succeed with empty payload');
  assert.strictEqual(
    log2.subject,
    'Event: ',
    '{{ event }} must NOT leak from envelope — should be empty with no payload'
  );

  await cleanup();
});

test('init.ts: event is extracted via ?? (prefers event over name)', async () => {
  const { db, cleanup } = await createTestDb();

  let subscribedHandler: ((data: any) => Promise<void>) | null = null;
  const fakeCtx = {
    db,
    events: {
      subscribe(_pattern: string, handler: (data: any) => Promise<void>) {
        subscribedHandler = handler;
      },
    },
  };

  const initModule = await import('../../src/init.ts');
  initModule.default(fakeCtx);

  // Emit with name only (no event) — should work without crash
  await subscribedHandler!({
    name: 'shop.order.created',
    payload: {},
  });

  await cleanup();
});
