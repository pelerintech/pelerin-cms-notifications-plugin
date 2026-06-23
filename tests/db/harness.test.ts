import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, resetDb, insertFixture, seedMinimal } from './harness.ts';
import {
  notification_rules,
  notification_templates,
  notification_logs,
  notification_settings,
} from '../../src/db/schema.ts';

test('createTestDb returns a db and cleanup function', async () => {
  const { db, cleanup } = await createTestDb();
  assert.ok(db, 'db should be truthy');
  assert.strictEqual(typeof cleanup, 'function');
});

test('notification_rules table is queryable and empty', async () => {
  const { db } = await createTestDb();
  const rows = await db.select().from(notification_rules);
  assert.deepStrictEqual(rows, []);
});

test('notification_templates table is queryable and empty', async () => {
  const { db } = await createTestDb();
  const rows = await db.select().from(notification_templates);
  assert.deepStrictEqual(rows, []);
});

test('notification_logs table is queryable and empty', async () => {
  const { db } = await createTestDb();
  const rows = await db.select().from(notification_logs);
  assert.deepStrictEqual(rows, []);
});

test('notification_settings table is queryable and empty', async () => {
  const { db } = await createTestDb();
  const rows = await db.select().from(notification_settings);
  assert.deepStrictEqual(rows, []);
});

test('seedMinimal returns stable IDs and inserts 1 template + 2 rules', async () => {
  const { db } = await createTestDb();
  const ids = await seedMinimal(db);
  assert.ok(ids.templateId, 'templateId should be set');
  assert.ok(ids.exactRuleId, 'exactRuleId should be set');
  assert.ok(ids.wildcardRuleId, 'wildcardRuleId should be set');
  const templates = await db.select().from(notification_templates);
  assert.strictEqual(templates.length, 1);
  const rules = await db.select().from(notification_rules);
  assert.strictEqual(rules.length, 2);
  const patterns = rules.map(r => r.event_pattern).sort();
  assert.ok(patterns.includes('shop.order.created'));
  assert.ok(patterns.includes('shop.*'));
});

test('resetDb clears all 4 tables after seedMinimal', async () => {
  const { db } = await createTestDb();
  await seedMinimal(db);
  await resetDb(db);
  assert.deepStrictEqual(await db.select().from(notification_logs), []);
  assert.deepStrictEqual(await db.select().from(notification_rules), []);
  assert.deepStrictEqual(await db.select().from(notification_templates), []);
  assert.deepStrictEqual(await db.select().from(notification_settings), []);
});

test('insertFixture inserts a row into notification_rules', async () => {
  const { db } = await createTestDb();
  await insertFixture(db, 'notification_rules', {
    id: 'r1',
    event_pattern: 'x',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: true,
    created_at: new Date(),
  });
  const rows = await db.select().from(notification_rules);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].id, 'r1');
});
