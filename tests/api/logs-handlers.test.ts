import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createTestDb, insertFixture } from '../db/harness.ts';
import { listLogsHandler } from '../../src/api/notifications/logs/index.ts';
import { getLogHandler } from '../../src/api/notifications/logs/[id].ts';

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

test('listLogsHandler returns 200 with empty data on empty db', async () => {
  const { db } = await createTestDb();
  const result = await listLogsHandler(db, { page: 1, pageSize: 20 });
  assert.strictEqual(result.status, 200);
  assert.deepStrictEqual(result.body.data, []);
  assert.strictEqual(result.body.total, 0);
});

test('listLogsHandler filters by provider', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', provider_name: 'sendgrid' });
  await insertLog(db, { id: 'l2', provider_name: 'local' });
  const result = await listLogsHandler(db, { page: 1, pageSize: 20, provider: 'sendgrid' });
  assert.strictEqual(result.body.data.length, 1);
  assert.strictEqual(result.body.data[0].id, 'l1');
});

test('listLogsHandler filters by status', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', success: true });
  await insertLog(db, { id: 'l2', success: false });
  const result = await listLogsHandler(db, { page: 1, pageSize: 20, status: 'failure' });
  assert.strictEqual(result.body.data.length, 1);
  assert.strictEqual(result.body.data[0].id, 'l2');
});

test('listLogsHandler filters by rule', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', rule_id: 'r1' });
  await insertLog(db, { id: 'l2', rule_id: 'r2' });
  const result = await listLogsHandler(db, { page: 1, pageSize: 20, rule: 'r1' });
  assert.strictEqual(result.body.data.length, 1);
});

test('listLogsHandler filters by date range', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', created_at: new Date('2026-01-01T00:00:00.000Z') });
  await insertLog(db, { id: 'l2', created_at: new Date('2026-06-01T00:00:00.000Z') });
  const result = await listLogsHandler(db, {
    page: 1,
    pageSize: 20,
    from: '2026-05-01',
    to: '2026-07-01',
  });
  assert.strictEqual(result.body.data.length, 1);
  assert.strictEqual(result.body.data[0].id, 'l2');
});

test('listLogsHandler paginates', async () => {
  const { db } = await createTestDb();
  for (let i = 0; i < 25; i++) {
    await insertLog(db, { id: `l${i}`, created_at: new Date(2026, 0, 1, 0, 0, i) });
  }
  const result = await listLogsHandler(db, { page: 2, pageSize: 20 });
  assert.strictEqual(result.body.data.length, 5);
  assert.strictEqual(result.body.total, 25);
});

test('getLogHandler returns 200 for an existing id', async () => {
  const { db } = await createTestDb();
  await insertLog(db, { id: 'l1', subject: 'Test' });
  const result = await getLogHandler(db, 'l1');
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.data.id, 'l1');
});

test('getLogHandler returns 404 for a missing id', async () => {
  const { db } = await createTestDb();
  const result = await getLogHandler(db, 'missing');
  assert.strictEqual(result.status, 404);
});

// Structural assertions
test('index.ts exports GET and calls requireAdmin', () => {
  const src = readFileSync(new URL('../../src/api/notifications/logs/index.ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('export const GET'));
  assert.ok(src.includes('requireAdmin'));
});

test('[id].ts exports GET and calls requireAdmin', () => {
  const src = readFileSync(new URL('../../src/api/notifications/logs/[id].ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('export const GET'));
  assert.ok(src.includes('requireAdmin'));
});
