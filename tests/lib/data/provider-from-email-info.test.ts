import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../../db/harness.ts';
import { setSetting } from '../../../src/lib/data/settings.ts';
import { encrypt } from '../../../src/lib/crypto.ts';
import { listAvailableProvidersForChannel } from '../../../src/lib/data/providers.ts';
import '../../../src/providers/index.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

test('listAvailableProvidersForChannel carries the provider from-email default (set)', async () => {
  const { db } = await createTestDb();
  await setSetting(db, 'brevo_from_email', encrypt('orders@shop.com'));
  const entries = await listAvailableProvidersForChannel(db, 'email', true);
  const brevo = entries.find((p) => p.name === 'brevo');
  assert.ok(brevo, 'brevo should be present in dev mode');
  assert.strictEqual(brevo!.fromEmail, 'orders@shop.com');
});

test('listAvailableProvidersForChannel yields null fromEmail when unset', async () => {
  const { db } = await createTestDb();
  const entries = await listAvailableProvidersForChannel(db, 'email', true);
  const brevo = entries.find((p) => p.name === 'brevo');
  assert.ok(brevo, 'brevo should be present in dev mode');
  assert.strictEqual(brevo!.fromEmail, null);
});
