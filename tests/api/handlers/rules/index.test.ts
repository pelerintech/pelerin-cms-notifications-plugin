import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb, seedMinimal } from '../../../db/harness.ts';
import { matrix } from '../_matrix.ts';

const originalDev = process.env.NOTIFICATIONS_DEV_MODE;
after(() => {
  if (originalDev === undefined) delete process.env.NOTIFICATIONS_DEV_MODE;
  else process.env.NOTIFICATIONS_DEV_MODE = originalDev;
});

ensureLoader();
const { runGet } = await import('../../../../src/api/notifications/rules/index.ts');

describe('runGet (rules/index) — auth + happy path with pagination', () => {
  test('adminAuthFail: requireAdmin throws 401, poison db untouched → 401 + success:false', async () => {
    process.env.NOTIFICATIONS_DEV_MODE = 'true';
    await matrix.adminAuthFail({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/rules',
    });
  });

  test('happy-path: seeded db → 200 + success:true + data array + pagination', async () => {
    process.env.NOTIFICATIONS_DEV_MODE = 'true';
    const { db, cleanup } = await createTestDb();
    try {
      await seedMinimal(db);
      const sdk = makeFakeSdk();
      const ctx = makeCtx({
        url: 'http://localhost/api/plugins/notifications/rules?page=1&limit=20',
      });
      const res = await runGet({ db, sdk, ctx });
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.ok(Array.isArray(b.data), 'data should be an array');
      assert.ok(b.data.length >= 2, 'seeded db should have at least 2 rules');
      assert.ok(b.pagination, 'pagination object should exist');
      assert.equal(b.pagination.page, 1);
      assert.equal(b.pagination.limit, 20);
    } finally {
      await cleanup();
    }
  });

  test('error-wrap: poison db, auth passes → 500 + success:false', async () => {
    await matrix.errorWrap({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/rules',
    });
  });
});
