import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, seedMinimal } from '../../db/harness.ts';
import { createRule, updateRule, getRule } from '../../../src/lib/data/rules.ts';

test('updateRule carries channel', async () => {
  const { db } = await createTestDb();
  const { templateId } = await seedMinimal(db);

  const rule = await createRule(db, {
    event_pattern: 'e6',
    template_id: templateId,
    provider_name: 'sendgrid',
    to: 'a@b.com',
    channel: 'email',
  });
  assert.strictEqual(rule.channel, 'email');

  const updated = await updateRule(db, rule.id, { channel: 'sms' });
  assert.strictEqual(updated.channel, 'sms');

  const fetched = await getRule(db, rule.id);
  assert.strictEqual(fetched!.channel, 'sms');
});

test('updateRule without channel field leaves channel unchanged', async () => {
  const { db } = await createTestDb();
  const { templateId } = await seedMinimal(db);

  const rule = await createRule(db, {
    event_pattern: 'e7',
    template_id: templateId,
    provider_name: 'sendgrid',
    to: 'a@b.com',
    channel: 'sms',
  });

  const updated = await updateRule(db, rule.id, { to: 'new@example.com' });
  assert.strictEqual(updated.to, 'new@example.com');
  assert.strictEqual(updated.channel, 'sms');
});
