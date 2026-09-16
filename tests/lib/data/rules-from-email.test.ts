import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../../db/harness.ts';
import { createRule, updateRule, getRule } from '../../../src/lib/data/rules.ts';

test('createRule stores from_email when provided', async () => {
  const { db } = await createTestDb();
  const rule = await createRule(db, {
    event_pattern: 'shop.order.created',
    template_id: 't',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    from_email: 'orders@shop.com',
  });
  assert.strictEqual(rule.from_email, 'orders@shop.com');
  // persisted
  const loaded = await getRule(db, rule.id);
  assert.strictEqual(loaded?.from_email, 'orders@shop.com');
});

test('createRule stores null when from_email is omitted', async () => {
  const { db } = await createTestDb();
  const rule = await createRule(db, {
    event_pattern: 'shop.order.created',
    template_id: 't',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(rule.from_email, null);
});

test('updateRule records a from_email change', async () => {
  const { db } = await createTestDb();
  const rule = await createRule(db, {
    event_pattern: 'shop.order.created',
    template_id: 't',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(rule.from_email, null);
  const updated = await updateRule(db, rule.id, { from_email: 'support@shop.com' });
  assert.strictEqual(updated.from_email, 'support@shop.com');
  const loaded = await getRule(db, rule.id);
  assert.strictEqual(loaded?.from_email, 'support@shop.com');
});

test('accessor does not reject a missing/null from_email on create or update', async () => {
  const { db } = await createTestDb();
  // create with from_email omitted does not throw
  const rule = await createRule(db, {
    event_pattern: 'shop.order.created',
    template_id: 't',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  // update with explicit null does not throw
  const updated = await updateRule(db, rule.id, { from_email: null });
  assert.strictEqual(updated.from_email, null);
  // update with from_email omitted does not throw and preserves existing
  const updated2 = await updateRule(db, rule.id, { to: 'b@c.com' });
  assert.strictEqual(updated2.from_email, null);
});
