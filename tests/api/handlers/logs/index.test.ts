import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb, insertFixture } from '../../../db/harness.ts';
import { matrix } from '../_matrix.ts';

ensureLoader();
const { runGet } = await import('../../../../src/api/notifications/logs/index.ts');

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

describe('runGet (logs/index) — auth + happy path with filters/pagination', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    await matrix.adminAuthFail({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/logs',
    });
  });

  test('happy-path: seeded logs → 200 + success:true + data + total + page', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await insertLog(db, { id: 'l1', provider_name: 'sendgrid' });
      await insertLog(db, { id: 'l2', provider_name: 'local' });
      const res = await runGet({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api/plugins/notifications/logs?page=1&pageSize=20' }),
      });
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.ok(Array.isArray(b.data), 'data should be an array');
      assert.equal(b.data.length, 2);
      assert.equal(b.total, 2);
      assert.equal(b.page, 1);
    } finally {
      await cleanup();
    }
  });

  test('filters by provider', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await insertLog(db, { id: 'l1', provider_name: 'sendgrid' });
      await insertLog(db, { id: 'l2', provider_name: 'local' });
      const res = await runGet({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api/plugins/notifications/logs?provider=sendgrid' }),
      });
      const b = await res.json();
      assert.equal(b.data.length, 1);
      assert.equal(b.data[0].id, 'l1');
    } finally {
      await cleanup();
    }
  });

  test('filters by status', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await insertLog(db, { id: 'l1', success: true });
      await insertLog(db, { id: 'l2', success: false });
      const res = await runGet({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api/plugins/notifications/logs?status=failure' }),
      });
      const b = await res.json();
      assert.equal(b.data.length, 1);
      assert.equal(b.data[0].id, 'l2');
    } finally {
      await cleanup();
    }
  });

  test('error-wrap: poison db, auth passes → 500 + success:false', async () => {
    await matrix.errorWrap({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/logs',
    });
  });
});
