import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb } from '../../../db/harness.ts';
import { matrix } from '../_matrix.ts';

ensureLoader();
const { runPost } = await import('../../../../src/api/notifications/templates/create.ts');

describe('runPost (templates/create) — auth + validation + happy', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    await matrix.adminAuthFail({
      run: runPost,
      url: 'http://localhost/api/plugins/notifications/templates',
      body: { name: 'Welcome', subject: 'Hi' },
    });
  });

  test('validation-fail: missing subject → 422 + success:false + non-empty fields', async () => {
    await matrix.validationFail({
      run: runPost,
      url: 'http://localhost/api/plugins/notifications/templates',
      invalidBody: { name: 'X' },
    });
  });

  test('happy-path: valid body → 201 + success:true + data.id', async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const sdk = makeFakeSdk();
      const ctx = makeCtx({
        url: 'http://localhost/api/plugins/notifications/templates',
        body: { name: 'Welcome', subject: 'Hi {{ name }}', body_html: '<p>Hi</p>' },
      });
      const res = await runPost({ db, sdk, ctx });
      assert.equal(res.status, 201, `expected 201, got ${res.status}`);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.ok(b.data.id, 'data.id should exist');
    } finally {
      await cleanup();
    }
  });
});
