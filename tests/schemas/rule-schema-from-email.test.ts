import { test } from 'node:test';
import assert from 'node:assert';
import { ruleSchema } from '../../src/schemas/rule.schema.ts';

const base = {
  event_pattern: 'shop.order.created',
  template_id: 't',
  provider_name: 'sendgrid',
  to: 'a@b.com',
};

test('ruleSchema accepts a valid from_email and carries it', () => {
  const r = ruleSchema.safeParse({ ...base, from_email: 'orders@shop.com' });
  assert.strictEqual(r.success, true);
  if (r.success) {
    assert.strictEqual(r.data.from_email, 'orders@shop.com');
  }
});

test('ruleSchema accepts an omitted from_email', () => {
  const r = ruleSchema.safeParse(base);
  assert.strictEqual(r.success, true);
  if (r.success) {
    assert.strictEqual(r.data.from_email, undefined);
  }
});

test('ruleSchema accepts a null from_email', () => {
  const r = ruleSchema.safeParse({ ...base, from_email: null });
  assert.strictEqual(r.success, true);
  if (r.success) {
    assert.strictEqual(r.data.from_email, null);
  }
});

test('ruleSchema does not reject an invalid-format from_email (form is the only gate)', () => {
  const r = ruleSchema.safeParse({ ...base, from_email: 'not-an-email' });
  assert.strictEqual(r.success, true);
  if (r.success) {
    assert.strictEqual(r.data.from_email, 'not-an-email');
  }
});
