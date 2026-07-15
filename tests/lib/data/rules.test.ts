import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture, seedMinimal } from '../../db/harness.ts';
import {
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  findActiveRulesMatching,
} from '../../../src/lib/data/rules.ts';

test('listRules on empty db returns empty paginated result', async () => {
  const { db } = await createTestDb();
  const result = await listRules(db, { page: 1, limit: 20 });
  assert.deepStrictEqual(result.data, []);
  assert.strictEqual(result.total, 0);
});

test('listRules returns rules ordered by created_at desc', async () => {
  const { db } = await createTestDb();
  const older = new Date('2026-01-01T00:00:00.000Z');
  const newer = new Date('2026-06-01T00:00:00.000Z');
  await insertFixture(db, 'notification_rules', {
    id: 'r1',
    event_pattern: 'shop.order.created',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: true,
    created_at: older,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r2',
    event_pattern: 'cms.user.created',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: true,
    created_at: newer,
  });
  const result = await listRules(db, { page: 1, limit: 20 });
  assert.strictEqual(result.data.length, 2);
  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.data[0].id, 'r2'); // newer first
  assert.strictEqual(result.data[1].id, 'r1');
});

test('listRules with search filters by event_pattern', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_rules', {
    id: 'r1',
    event_pattern: 'shop.order.created',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: true,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r2',
    event_pattern: 'cms.user.created',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: true,
    created_at: now,
  });
  const result = await listRules(db, { page: 1, limit: 20, search: 'order' });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.data[0].id, 'r1');
});

test('listRules with active filter returns only active rules', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_rules', {
    id: 'r1',
    event_pattern: 'shop.order.created',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: true,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r2',
    event_pattern: 'cms.user.created',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: false,
    created_at: now,
  });
  const result = await listRules(db, { page: 1, limit: 20, active: true });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.data[0].id, 'r1');
});

test('listRules paginates with page and limit', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_rules', {
    id: 'r1',
    event_pattern: 'a',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: true,
    created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r2',
    event_pattern: 'b',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: true,
    created_at: now,
  });
  const result = await listRules(db, { page: 2, limit: 1 });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.total, 2);
});

test('getRule returns the rule for an existing id', async () => {
  const { db } = await createTestDb();
  const { exactRuleId } = await seedMinimal(db);
  const rule = await getRule(db, exactRuleId);
  assert.ok(rule);
  assert.strictEqual(rule.event_pattern, 'shop.order.created');
});

test('getRule returns null for a missing id', async () => {
  const { db } = await createTestDb();
  const rule = await getRule(db, 'missing');
  assert.strictEqual(rule, null);
});

test('createRule inserts and returns a rule with id, created_at, active:true', async () => {
  const { db } = await createTestDb();
  const rule = await createRule(db, {
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.ok(rule.id);
  assert.ok(rule.created_at);
  assert.strictEqual(rule.active, true);
  const found = await getRule(db, rule.id);
  assert.ok(found);
});

test('createRule with a duplicate triple throws code duplicate', async () => {
  const { db } = await createTestDb();
  await createRule(db, {
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  await assert.rejects(
    () =>
      createRule(db, {
        event_pattern: 'shop.order.created',
        template_id: 't1',
        provider_name: 'sendgrid',
        to: 'c@d.com',
      }),
    (err: any) => err.code === 'duplicate'
  );
});

test('updateRule updates and returns with non-null updated_at', async () => {
  const { db } = await createTestDb();
  const { exactRuleId } = await seedMinimal(db);
  const updated = await updateRule(db, exactRuleId, { to: 'new@example.com' });
  assert.strictEqual(updated.to, 'new@example.com');
  assert.ok(updated.updated_at);
});

test('updateRule on missing id throws code not_found', async () => {
  const { db } = await createTestDb();
  await assert.rejects(
    () => updateRule(db, 'missing', { to: 'x' }),
    (err: any) => err.code === 'not_found'
  );
});

test('deleteRule removes the row', async () => {
  const { db } = await createTestDb();
  const { exactRuleId } = await seedMinimal(db);
  await deleteRule(db, exactRuleId);
  const found = await getRule(db, exactRuleId);
  assert.strictEqual(found, null);
});

test('findActiveRulesMatching returns exact + wildcard, exact first', async () => {
  const { db } = await createTestDb();
  const { exactRuleId, wildcardRuleId } = await seedMinimal(db);
  const rules = await findActiveRulesMatching(db, 'shop.order.created');
  assert.strictEqual(rules.length, 2);
  assert.strictEqual(rules[0].id, exactRuleId);
  assert.strictEqual(rules[1].id, wildcardRuleId);
});

test('findActiveRulesMatching returns [] for an unrelated event', async () => {
  const { db } = await createTestDb();
  await seedMinimal(db);
  const rules = await findActiveRulesMatching(db, 'cms.user.created');
  assert.deepStrictEqual(rules, []);
});

test('findActiveRulesMatching excludes inactive rules', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_rules', {
    id: 'r1',
    event_pattern: 'shop.*',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
    active: false,
    created_at: now,
  });
  const rules = await findActiveRulesMatching(db, 'shop.order.created');
  assert.deepStrictEqual(rules, []);
});

test('findActiveRulesMatching fires wildcard for shop.cart.added', async () => {
  const { db } = await createTestDb();
  const { wildcardRuleId } = await seedMinimal(db);
  const rules = await findActiveRulesMatching(db, 'shop.cart.added');
  assert.strictEqual(rules.length, 1);
  assert.strictEqual(rules[0].id, wildcardRuleId);
});
