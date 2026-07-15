import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb } from '../../../db/harness.ts';
import { setSetting } from '../../../../src/lib/data/settings.ts';
import { encrypt } from '../../../../src/lib/crypto.ts';
import { matrix } from '../_matrix.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;
const originalDev = process.env.NOTIFICATIONS_DEV_MODE;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});
after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
  if (originalDev === undefined) delete process.env.NOTIFICATIONS_DEV_MODE;
  else process.env.NOTIFICATIONS_DEV_MODE = originalDev;
});

function setDevMode(on: boolean) {
  if (on) process.env.NOTIFICATIONS_DEV_MODE = 'true';
  else delete process.env.NOTIFICATIONS_DEV_MODE;
}

ensureLoader();
const { runGet } = await import('../../../../src/api/notifications/rules/providers.ts');

async function names(res: Response): Promise<string[]> {
  const b = await res.json();
  return b.data.map((p: any) => p.name);
}

describe('runGet (rules/providers) — auth + dev/prod filtering', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    setDevMode(true);
    await matrix.adminAuthFail({
      run: runGet,
      url: 'http://localhost/api/plugins/notifications/rules/providers?channel=email',
    });
  });

  test('prod + one configured (sendgrid) → only sendgrid, configured=true, no local', async () => {
    setDevMode(false);
    const { db, cleanup } = await createTestDb();
    try {
      await setSetting(db, 'sendgrid_api_key', encrypt('SG.realkey'));
      const res = await runGet({
        db,
        sdk: makeFakeSdk(),
        ctx: makeCtx({
          url: 'http://localhost/api/plugins/notifications/rules/providers?channel=email',
        }),
      });
      assert.equal(res.status, 200);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.deepStrictEqual(b.data.map((p: any) => p.name).sort(), ['sendgrid']);
      const sg = b.data.find((p: any) => p.name === 'sendgrid');
      assert.strictEqual(sg.configured, true);
      assert.ok(!b.data.map((p: any) => p.name).includes('local'));
    } finally {
      await cleanup();
    }
  });

  test('prod + none configured → empty data array', async () => {
    setDevMode(false);
    const { db, cleanup } = await createTestDb();
    try {
      const res = await runGet({
        db,
        sdk: makeFakeSdk(),
        ctx: makeCtx({
          url: 'http://localhost/api/plugins/notifications/rules/providers?channel=email',
        }),
      });
      const b = await res.json();
      assert.deepStrictEqual(b.data, []);
    } finally {
      await cleanup();
    }
  });

  test('dev + none configured → all real email providers with configured=false, no local', async () => {
    setDevMode(true);
    const { db, cleanup } = await createTestDb();
    try {
      const res = await runGet({
        db,
        sdk: makeFakeSdk(),
        ctx: makeCtx({
          url: 'http://localhost/api/plugins/notifications/rules/providers?channel=email',
        }),
      });
      const b = await res.json();
      const n = b.data.map((p: any) => p.name).sort();
      for (const expected of ['sendgrid', 'mailgun', 'ses', 'smtp', 'brevo']) {
        assert.ok(n.includes(expected), `must include ${expected}`);
      }
      assert.ok(!n.includes('local'));
      for (const p of b.data) {
        assert.strictEqual(p.configured, false);
      }
    } finally {
      await cleanup();
    }
  });

  test('channel=sms → empty array (no provider advertises sms today)', async () => {
    setDevMode(true);
    const { db, cleanup } = await createTestDb();
    try {
      const res = await runGet({
        db,
        sdk: makeFakeSdk(),
        ctx: makeCtx({
          url: 'http://localhost/api/plugins/notifications/rules/providers?channel=sms',
        }),
      });
      const b = await res.json();
      assert.deepStrictEqual(b.data, []);
    } finally {
      await cleanup();
    }
  });

  test('dev + one configured → that one configured=true, others false', async () => {
    setDevMode(true);
    const { db, cleanup } = await createTestDb();
    try {
      await setSetting(db, 'sendgrid_api_key', encrypt('SG.realkey'));
      const res = await runGet({
        db,
        sdk: makeFakeSdk(),
        ctx: makeCtx({
          url: 'http://localhost/api/plugins/notifications/rules/providers?channel=email',
        }),
      });
      const b = await res.json();
      const sg = b.data.find((p: any) => p.name === 'sendgrid');
      assert.strictEqual(sg.configured, true);
      for (const p of b.data) {
        if (p.name !== 'sendgrid') {
          assert.strictEqual(p.configured, false, `${p.name} should be unconfigured`);
        }
      }
    } finally {
      await cleanup();
    }
  });
});
