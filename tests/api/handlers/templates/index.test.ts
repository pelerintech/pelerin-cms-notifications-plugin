import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb, seedMinimal } from '../../../db/harness.ts';
import { matrix } from '../_matrix.ts';

ensureLoader();
const { runGet } = await import('../../../../src/api/notifications/templates/index.ts');

describe('runGet (templates/index) — auth + happy path with pagination', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    await matrix.adminAuthFail({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/templates',
    });
  });

  test('happy-path: seeded db → 200 + success:true + data array + pagination', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await seedMinimal(db);
      const res = await runGet({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api/plugins/notifications/templates?page=1&limit=20' }),
      });
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.ok(Array.isArray(b.data), 'data should be an array');
      assert.equal(b.data.length, 1);
      assert.ok(b.pagination, 'pagination object should exist');
      assert.equal(b.pagination.total, 1);
    } finally {
      await cleanup();
    }
  });

  test('happy-path: search filters by name', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await seedMinimal(db);
      const res = await runGet({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api/plugins/notifications/templates?search=Order' }),
      });
      const b = await res.json();
      assert.equal(b.data.length, 1);
    } finally {
      await cleanup();
    }
  });

  test('error-wrap: poison db, auth passes → 500 + success:false', async () => {
    await matrix.errorWrap({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/templates',
    });
  });
});
