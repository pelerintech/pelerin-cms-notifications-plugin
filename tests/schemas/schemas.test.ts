import { test } from 'node:test';
import assert from 'node:assert';
import { ruleSchema } from '../../src/schemas/rule.schema.ts';
import { templateSchema } from '../../src/schemas/template.schema.ts';

test('ruleSchema accepts a valid rule', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'x',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, true);
});

test('ruleSchema rejects an empty object', () => {
  const result = ruleSchema.safeParse({});
  assert.strictEqual(result.success, false);
});

test('ruleSchema rejects empty event_pattern', () => {
  const result = ruleSchema.safeParse({
    event_pattern: '',
    template_id: 't',
    provider_name: 'p',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, false);
});

test('templateSchema accepts a valid template', () => {
  const result = templateSchema.safeParse({
    name: 'n',
    subject: 's',
  });
  assert.strictEqual(result.success, true);
});

test('templateSchema rejects missing subject', () => {
  const result = templateSchema.safeParse({ name: 'X' });
  assert.strictEqual(result.success, false);
});
