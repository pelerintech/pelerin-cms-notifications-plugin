import { test } from 'node:test';
import assert from 'node:assert';
import { ruleSchema } from '../../src/schemas/rule.schema.ts';

test('ruleSchema accepts an explicit channel field', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'e',
    template_id: 't',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    channel: 'email',
  });
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.channel, 'email');
  }
});

test('ruleSchema without channel still succeeds and defaults to email', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'e',
    template_id: 't',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.channel, 'email');
  }
});

test('ruleSchema rejects an empty-string channel', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'e',
    template_id: 't',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    channel: '',
  });
  assert.strictEqual(result.success, false);
});
