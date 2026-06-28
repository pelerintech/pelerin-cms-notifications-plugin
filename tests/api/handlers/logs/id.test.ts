import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb, insertFixture } from '../../../db/harness.ts';
import { matrix } from '../_matrix.ts';

ensureLoader();
const { runGet } = await import('../../../../src/api/notifications/logs/[id].ts');

async function insertLog(db: any, overrides: Record<string, any> = {}) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    event_name: 'shop.order.created',
    rule_id: 'r1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
    cc: null,
    bcc: null,
    subject: 'Test',
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

describe('runGet (logs/[id]) — auth + 404 + happy', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    await matrix.adminAuthFail({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/logs/l1',
      params: { id: 'l1' },
    });
  });

  test('404 for unknown id', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const res = await runGet({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', params: { id: 'missing' } }),
      });
      assert.equal(res.status, 404);
      const b = await res.json();
      assert.equal(b.success, false);
    } finally {
      await cleanup();
    }
  });

  test('happy-path: seeded log → 200 + success:true + data.id', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await insertLog(db, { id: 'l1', subject: 'Test' });
      const res = await runGet({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', params: { id: 'l1' } }),
      });
      assert.equal(res.status, 200);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.equal(b.data.id, 'l1');
    } finally {
      await cleanup();
    }
  });
});
