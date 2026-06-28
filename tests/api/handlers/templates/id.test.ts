import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb, seedMinimal } from '../../../db/harness.ts';
import { matrix } from '../_matrix.ts';

ensureLoader();
const { runPut, runDelete } = await import('../../../../src/api/notifications/templates/[id].ts');

describe('runPut (templates/[id]) — auth + 404 + happy', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    await matrix.adminAuthFail({
      run: runPut,
      url: 'http://localhost/api/plugins/notifications/templates/tpl',
      body: { subject: 'New' },
      params: { id: 'tpl' },
    });
  });

  test('404 for unknown id', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const res = await runPut({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', body: { subject: 'x' }, params: { id: 'missing' } }),
      });
      assert.equal(res.status, 404);
      const b = await res.json();
      assert.equal(b.success, false);
    } finally {
      await cleanup();
    }
  });

  test('happy-path: update subject → 200 + data.subject matches', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { templateId } = await seedMinimal(db);
      const res = await runPut({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', body: { subject: 'New Subject' }, params: { id: templateId } }),
      });
      assert.equal(res.status, 200);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.equal(b.data.subject, 'New Subject');
    } finally {
      await cleanup();
    }
  });
});

describe('runDelete (templates/[id]) — auth + 404 + happy', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    await matrix.adminAuthFail({
      run: runDelete,
      url: 'http://localhost/api/plugins/notifications/templates/tpl',
      params: { id: 'tpl' },
    });
  });

  test('404 for unknown id', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const res = await runDelete({
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

  test('happy-path: delete → 200 + data.deleted === true', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { templateId } = await seedMinimal(db);
      const res = await runDelete({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', params: { id: templateId } }),
      });
      assert.equal(res.status, 200);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.equal(b.data.deleted, true);
    } finally {
      await cleanup();
    }
  });
});
