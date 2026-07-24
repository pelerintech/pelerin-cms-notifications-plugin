/**
 * Tests for rule schema validation — channel enum, email format, event_pattern format.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { ruleSchema } from '../../src/schemas/rule.schema.ts';

test('channel: "email" passes', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    channel: 'email',
  });
  assert.strictEqual(result.success, true);
});

test('channel: "sms" fails', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    channel: 'sms',
  });
  assert.strictEqual(result.success, false);
});

test('to: valid emails pass', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com, c@d.com',
  });
  assert.strictEqual(result.success, true);
});

test('to: invalid email fails', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'not-an-email',
  });
  assert.strictEqual(result.success, false);
});

test('event_pattern: valid exact pattern passes', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, true);
});

test('event_pattern: valid prefix wildcard passes', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'shop.*',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, true);
});

test('event_pattern: valid global wildcard passes', () => {
  const result = ruleSchema.safeParse({
    event_pattern: '*',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, true);
});

test('event_pattern: "**" fails', () => {
  const result = ruleSchema.safeParse({
    event_pattern: '**',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, false);
});

test('event_pattern: "shop..." fails', () => {
  const result = ruleSchema.safeParse({
    event_pattern: 'shop...',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, false);
});

test('event_pattern: "*.x" fails (wildcard only valid alone or as suffix)', () => {
  const result = ruleSchema.safeParse({
    event_pattern: '*.x',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(result.success, false);
});
