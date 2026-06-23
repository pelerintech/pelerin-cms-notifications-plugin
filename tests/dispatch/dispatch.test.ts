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
    order_id: '123',
    customer_email: 'buyer@example.com',
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
    id: 'r-missing-tpl', event_pattern: 'shop.order.created', template_id: 'missing-tpl',
    provider_name: 'sendgrid', to: 'a@b.com', active: true, created_at: now,
  });
  await dispatchEvent(db, 'shop.order.created', {});
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
    id: 't-norc', name: 'T', subject: 'S', body_html: null, body_text: null, created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-norc', event_pattern: 'shop.order.created', template_id: 't-norc',
    provider_name: 'sendgrid', to: '{{ missing }}', active: true, created_at: now,
  });
  await dispatchEvent(db, 'shop.order.created', {});
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
    order_id: '123',
    customer_email: 'buyer@example.com',
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
  await dispatchEvent(db, 'shop.cart.added', {});
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].rule_id, wildcardRuleId);
});

test('dispatchEvent does not fire inactive rule', async () => {
  process.env.NOTIFICATIONS_DEV_MODE = 'true';
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_rules', {
    id: 'r-inactive', event_pattern: 'shop.*', template_id: 't',
    provider_name: 'sendgrid', to: 'a@b.com', active: false, created_at: now,
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
    id: 't-cc', name: 'T', subject: 'S', body_html: null, body_text: null, created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-cc', event_pattern: 'shop.order.created', template_id: 't-cc',
    provider_name: 'sendgrid', to: 'a@b.com', cc: 'c@d.com', bcc: '{{ hidden }}',
    active: true, created_at: now,
  });
  await dispatchEvent(db, 'shop.order.created', { hidden: 'e@f.com' });
  const logs = await db.select().from(notification_logs);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].cc, 'c@d.com');
  assert.strictEqual(logs[0].bcc, 'e@f.com');
});

// Cleanup
test('restore env', () => {
  if (originalDevMode === undefined) {
    delete process.env.NOTIFICATIONS_DEV_MODE;
  } else {
    process.env.NOTIFICATIONS_DEV_MODE = originalDevMode;
  }
});
