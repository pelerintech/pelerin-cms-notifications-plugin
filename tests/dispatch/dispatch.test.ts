import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, seedMinimal, insertFixture, resetDb } from '../db/harness.ts';
import { notification_logs } from '../../src/db/schema.ts';
import { dispatchEvent } from '../../src/lib/dispatch.ts';

const originalDevMode = process.env.NOTIFICATIONS_DEV_MODE;

test('dispatchEvent writes a success log row for a matching rule via local provider', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const { exactRuleId } = await seedMinimal(db);
  await dispatchEvent(db, 'shop.order.created', {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: {
      order: { order_number: '123', customer_email: 'buyer@example.com' },
    },
  });
  const logs = await db.select().from(notification_logs);
  const exactLog = logs.find((l: any) => l.rule_id === exactRuleId);
  assert.ok(exactLog, 'expected a log row for the exact rule');
  assert.strictEqual(exactLog.event_name, 'shop.order.created');
  assert.strictEqual(exactLog.provider_name, 'sendgrid');
  assert.strictEqual(exactLog.to, 'buyer@example.com');
  assert.strictEqual(exactLog.subject, 'Order 123');
  assert.strictEqual(exactLog.success, true);
  assert.ok(exactLog.message_id?.startsWith('local-'));
});

test('dispatchEvent with no matching rules writes no log row', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  await seedMinimal(db);
  await dispatchEvent(db, 'cms.user.created', {});
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 0);
});

test('dispatchEvent with a missing template writes a failure log and does not throw', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_rules', {
    id: 'r-missing-tpl',
    event_pattern: 'shop.order.created',
    template_id: 'missing-tpl',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    active: true,
    created_at: now,
  });
  await dispatchEvent(db, 'shop.order.created', {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: 'x', customer_email: 'a@b.com' } },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, false);
  assert.ok(logs[0].error);
});

test('dispatchEvent with no recipients writes a failure log and does not call provider', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't-norc',
    name: 'T',
    subject: 'S',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-norc',
    event_pattern: 'shop.order.created',
    template_id: 't-norc',
    provider_name: 'sendgrid',
    to: '{{ missing }}',
    active: true,
    created_at: now,
  });
  await dispatchEvent(db, 'shop.order.created', {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { order: { order_number: 'x', customer_email: 'a@b.com' } },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].success, false);
  assert.ok(logs[0].error);
});

test('dispatchEvent with two matching rules writes two log rows', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const { exactRuleId, wildcardRuleId } = await seedMinimal(db);
  await dispatchEvent(db, 'shop.order.created', {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: {
      order: { order_number: '123', customer_email: 'buyer@example.com' },
    },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 2);
  const ruleIds = logs.map((l: any) => l.rule_id).sort();
  assert.ok(ruleIds.includes(exactRuleId));
  assert.ok(ruleIds.includes(wildcardRuleId));
});

test('dispatchEvent fires wildcard rule for shop.cart.added', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const { wildcardRuleId } = await seedMinimal(db);
  await dispatchEvent(db, 'shop.cart.added', {
    event: 'shop.cart.added',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { cart: {} },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].rule_id, wildcardRuleId);
});

test('dispatchEvent does not fire inactive rule', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_rules', {
    id: 'r-inactive',
    event_pattern: 'shop.*',
    template_id: 't',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    active: false,
    created_at: now,
  });
  await dispatchEvent(db, 'shop.cart.added', {});
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 0);
});

test('dispatchEvent resolves cc and bcc from payload', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't-cc',
    name: 'T',
    subject: 'S',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-cc',
    event_pattern: 'shop.order.created',
    template_id: 't-cc',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    cc: 'c@d.com',
    bcc: '{{ data.hidden }}',
    active: true,
    created_at: now,
  });
  await dispatchEvent(db, 'shop.order.created', {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: { hidden: 'e@f.com', order: { order_number: 'x', customer_email: 'a@b.com' } },
  });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].cc, 'c@d.com');
  assert.strictEqual(logs[0].bcc, 'e@f.com');
});

test('dispatchEvent catch block creates a failure log on unexpected exception', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const { exactRuleId } = await seedMinimal(db);

  // Use a value that throws on String() conversion (null-prototype object)
  // inside the order payload to trigger an exception during interpolation.
  const payload = {
    event: 'shop.order.created',
    timestamp: '2026-07-24T10:00:00.000Z',
    data: {
      customer_email: 'buyer@example.com',
      order: { order_number: Object.create(null), customer_email: 'buyer@example.com' },
    },
  };

  await dispatchEvent(db, 'shop.order.created', payload);

  // Even though dispatch threw, a failure log should exist
  const logs = await db.select().from(notification_logs);
  assert.ok(logs.length >= 1, 'expected at least one log row from the catch block');
  // The rule that threw should have a failure log
  const ruleLog = logs.find((l: any) => l.rule_id === exactRuleId);
  assert.ok(ruleLog, 'expected a log row for the exact rule from catch');
  assert.strictEqual(ruleLog.success, false);
  assert.ok(ruleLog.error, 'expected error message');
});

// Cleanup
test('restore env', () => {
  if (originalDevMode === undefined) {
    delete process.env.NOTIFICATIONS_DEV_MODE;
  } else {
    process.env.NOTIFICATIONS_DEV_MODE = originalDevMode;
  }
});
