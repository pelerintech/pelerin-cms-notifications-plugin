import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture } from '../../db/harness.ts';
import { getSetting, setSetting, listSettingsForProvider } from '../../../src/lib/data/settings.ts';

test('setSetting then getSetting round-trips the value', async () => {
  const { db } = await createTestDb();
  await setSetting(db, 'sendgrid_api_key', 'secret');
  const value = await getSetting(db, 'sendgrid_api_key');
  assert.strictEqual(value, 'secret');
});

test('setSetting on existing key upserts (not duplicate insert)', async () => {
  const { db } = await createTestDb();
  await setSetting(db, 'sendgrid_api_key', 'old');
  await setSetting(db, 'sendgrid_api_key', 'new');
  const value = await getSetting(db, 'sendgrid_api_key');
  assert.strictEqual(value, 'new');
  const { notification_settings } = await import('../../../src/db/schema.ts');
  const rows = await db.select().from(notification_settings);
  assert.strictEqual(rows.length, 1);
});

test('listSettingsForProvider returns only that provider keys with prefix stripped', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_settings', {
    id: 's1',
    key: 'sendgrid_api_key',
    value: 'x',
    created_at: now,
  });
  await insertFixture(db, 'notification_settings', {
    id: 's2',
    key: 'smtp_host',
    value: 'localhost',
    created_at: now,
  });
  await insertFixture(db, 'notification_settings', {
    id: 's3',
    key: 'smtp_port',
    value: '587',
    created_at: now,
  });
  const result = await listSettingsForProvider(db, 'smtp');
  assert.deepStrictEqual(result, { host: 'localhost', port: '587' });
});

test('getSetting on missing key returns null', async () => {
  const { db } = await createTestDb();
  const value = await getSetting(db, 'nope');
  assert.strictEqual(value, null);
});
