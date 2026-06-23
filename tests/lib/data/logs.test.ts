import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture } from '../../db/harness.ts';
import { listLogs, getLog, createLog } from '../../../src/lib/data/logs.ts';

async function insertLog(db: any, overrides: Record<string, any> = {}) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    event_name: 'shop.order.created',
    rule_id: 'r1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    cc: null,
    bcc: null,
    subject: 'Order 123',
    body_html: null,
    body_text: null,
    success: true,
    error: null,
    message_id: 'local-1',
    created_at: overrides.created_at ?? new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
  await insertFixture(db, 'notification_logs', row);
  return row;
}

test('listLogs on empty db returns empty paginated result', async () => {
  const { db } = await createTestDb();
  const result = await listLogs(db, { page: 1, pageSize: 20 });
  assert.deepStrictEqual(result.data, []);
  assert.strictEqual(result.total, 0);
});

test('listLogs returns logs ordered by created_at desc', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', created_at: new Date('2026-01-01T00:00:00.000Z') });
  await insertLog(db, { id: 'l2', created_at: new Date('2026-06-01T00:00:00.000Z') });
  const result = await listLogs(db, { page: 1, pageSize: 20 });
  assert.strictEqual(result.data.length, 2);
  assert.strictEqual(result.data[0].id, 'l2');
});

test('listLogs filters by provider', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', provider_name: 'sendgrid' });
  await insertLog(db, { id: 'l2', provider_name: 'local' });
  const result = await listLogs(db, { page: 1, pageSize: 20, provider: 'sendgrid' });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.data[0].id, 'l1');
});

test('listLogs filters by status success', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', success: true });
  await insertLog(db, { id: 'l2', success: false });
  const result = await listLogs(db, { page: 1, pageSize: 20, status: 'success' });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.data[0].id, 'l1');
});

test('listLogs filters by status failure', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', success: true });
  await insertLog(db, { id: 'l2', success: false });
  const result = await listLogs(db, { page: 1, pageSize: 20, status: 'failure' });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.data[0].id, 'l2');
});

test('listLogs filters by rule', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', rule_id: 'r1' });
  await insertLog(db, { id: 'l2', rule_id: 'r2' });
  const result = await listLogs(db, { page: 1, pageSize: 20, rule: 'r1' });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.data[0].id, 'l1');
});

test('listLogs filters by date range', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', created_at: new Date('2026-01-01T00:00:00.000Z') });
  await insertLog(db, { id: 'l2', created_at: new Date('2026-06-01T00:00:00.000Z') });
  const result = await listLogs(db, {
    page: 1,
    pageSize: 20,
    from: new Date('2026-05-01T00:00:00.000Z'),
    to: new Date('2026-07-01T00:00:00.000Z'),
  });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.data[0].id, 'l2');
});

test('listLogs paginates', async () => {
  const { db } = await createTestDb();
  for (let i = 0; i < 25; i++) {
    await insertLog(db, { id: `l${i}`, created_at: new Date(2026, 0, 1, 0, 0, i) });
  }
  const result = await listLogs(db, { page: 2, pageSize: 20 });
  assert.strictEqual(result.data.length, 5);
  assert.strictEqual(result.total, 25);
});

test('getLog returns the log for an existing id', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', subject: 'Test subject' });
  const log = await getLog(db, 'l1');
  assert.ok(log);
  assert.strictEqual(log.subject, 'Test subject');
});

test('getLog returns null for a missing id', async () => {
  const { db } = await createTestDb();
  const log = await getLog(db, 'missing');
  assert.strictEqual(log, null);
});

test('createLog inserts and returns with id and created_at', async () => {
  const { db } = await createTestDb();
  const log = await createLog(db, {
    event_name: 'shop.order.created',
    rule_id: 'r1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    subject: 'Test',
    success: true,
  });
  assert.ok(log.id);
  assert.ok(log.created_at);
  const found = await getLog(db, log.id);
  assert.ok(found);
});
