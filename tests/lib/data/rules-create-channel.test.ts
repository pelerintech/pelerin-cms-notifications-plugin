import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, seedMinimal } from '../../db/harness.ts';
import { createRule, getRule, RuleError } from '../../../src/lib/data/rules.ts';

async function setupWithTemplate() {
  const { db } = await createTestDb();
  const { templateId } = await seedMinimal(db);
  return { db, templateId };
}

test('createRule without channel returns a row with channel === "email"', async () => {
  const { db, templateId } = await setupWithTemplate();
  const rule = await createRule(db, {
    event_pattern: 'e1',
    template_id: templateId,
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(rule.channel, 'email');
  const fetched = await getRule(db, rule.id);
  assert.strictEqual(fetched!.channel, 'email');
});

test('createRule with explicit channel stores it', async () => {
  const { db, templateId } = await setupWithTemplate();
  const rule = await createRule(db, {
    event_pattern: 'e2',
    template_id: templateId,
    provider_name: 'sendgrid',
    to: 'a@b.com',
    channel: 'sms',
  });
  assert.strictEqual(rule.channel, 'sms');
  const fetched = await getRule(db, rule.id);
  assert.strictEqual(fetched!.channel, 'sms');
});

test('two rules same triple but different channels both succeed', async () => {
  const { db, templateId } = await setupWithTemplate();
  const a = await createRule(db, {
    event_pattern: 'e3', template_id: templateId, provider_name: 'sendgrid',
    to: 'a@b.com', channel: 'email',
  });
  const b = await createRule(db, {
    event_pattern: 'e3', template_id: templateId, provider_name: 'sendgrid',
    to: 'a@b.com', channel: 'sms',
  });
  assert.notStrictEqual(a.id, b.id);
  assert.notStrictEqual(a.channel, b.channel);
});

test('two rules same triple + same channel throws RuleError duplicate', async () => {
  const { db, templateId } = await setupWithTemplate();
  await createRule(db, {
    event_pattern: 'e4', template_id: templateId, provider_name: 'sendgrid',
    to: 'a@b.com', channel: 'email',
  });
  await assert.rejects(
    () => createRule(db, {
      event_pattern: 'e4', template_id: templateId, provider_name: 'sendgrid',
      to: 'x@y.com', channel: 'email',
    }),
    (err: any) => err instanceof RuleError && err.code === 'duplicate',
  );
});
