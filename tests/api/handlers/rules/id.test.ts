import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx } from '../../helpers.ts';
import { createTestDb, insertFixture, seedMinimal } from '../../../db/harness.ts';
import { setSetting } from '../../../../src/lib/data/settings.ts';
import { encrypt } from '../../../../src/lib/crypto.ts';
import { getRule } from '../../../../src/lib/data/rules.ts';
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

ensureLoader();
const { runPut, runDelete } = await import('../../../../src/api/notifications/rules/[id].ts');

function setDevMode(on: boolean) {
  if (on) process.env.NOTIFICATIONS_DEV_MODE = 'true';
  else delete process.env.NOTIFICATIONS_DEV_MODE;
}

async function seedRule(db: any, providerName: string) {
  const id = 'rule-1';
  await insertFixture(db, 'notification_rules', {
    id,
    event_pattern: 'e',
    template_id: 'tpl-1',
    provider_name: providerName,
    channel: 'email',
    to: 'a@b.com',
    cc: null,
    bcc: null,
    active: true,
    created_at: new Date(),
    updated_at: null,
  });
  return id;
}

describe('runPut (rules/[id]) — auth + 404 + happy + guardrail', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    setDevMode(true);
    await matrix.adminAuthFail({
      run: runPut,
      url: 'http://localhost/api/plugins/notifications/rules/rule-1',
      body: { to: 'new@example.com' },
      params: { id: 'rule-1' },
    });
  });

  test('404 for unknown id', async () => {
    setDevMode(true);
    const { db, cleanup } = await createTestDb();
    try {
      const res = await runPut({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', body: { to: 'x' }, params: { id: 'missing' } }),
      });
      assert.equal(res.status, 404);
      const b = await res.json();
      assert.equal(b.success, false);
    } finally {
      await cleanup();
    }
  });

  test('happy-path: update to field → 200 + data.to matches', async () => {
    setDevMode(true);
    const { db, cleanup } = await createTestDb();
    try {
      const { exactRuleId } = await seedMinimal(db);
      const res = await runPut({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', body: { to: 'new@example.com' }, params: { id: exactRuleId } }),
      });
      assert.equal(res.status, 200);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.equal(b.data.to, 'new@example.com');
    } finally {
      await cleanup();
    }
  });

  test('guardrail: prod + unconfigured brevo → 400, db unchanged', async () => {
    setDevMode(false);
    const { db, cleanup } = await createTestDb();
    try {
      await setSetting(db, 'sendgrid_api_key', encrypt('SG.realkey'));
      const id = await seedRule(db, 'sendgrid');
      const res = await runPut({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', body: { provider_name: 'brevo' }, params: { id } }),
      });
      assert.equal(res.status, 400);
      const b = await res.json();
      assert.equal(b.success, false);
      assert.match(b.error, /not configured/i);
      const r = await getRule(db, id);
      assert.equal(r!.provider_name, 'sendgrid');
    } finally {
      await cleanup();
    }
  });

  test('guardrail: prod + configured mailgun → 200, db updated', async () => {
    setDevMode(false);
    const { db, cleanup } = await createTestDb();
    try {
      await setSetting(db, 'sendgrid_api_key', encrypt('SG.realkey'));
      await setSetting(db, 'mailgun_url', encrypt('https://api.mailgun.net/v3/x'));
      await setSetting(db, 'mailgun_api_key', encrypt('key-xxx'));
      const id = await seedRule(db, 'sendgrid');
      const res = await runPut({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', body: { provider_name: 'mailgun' }, params: { id } }),
      });
      assert.equal(res.status, 200);
      const r = await getRule(db, id);
      assert.equal(r!.provider_name, 'mailgun');
    } finally {
      await cleanup();
    }
  });
});

describe('runDelete (rules/[id]) — auth + 404 + happy', () => {
  test('adminAuthFail → 401 + success:false', async () => {
    setDevMode(true);
    await matrix.adminAuthFail({
      run: runDelete,
      url: 'http://localhost/api/plugins/notifications/rules/rule-1',
      params: { id: 'rule-1' },
    });
  });

  test('404 for unknown id', async () => {
    setDevMode(true);
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
    setDevMode(true);
    const { db, cleanup } = await createTestDb();
    try {
      const { exactRuleId } = await seedMinimal(db);
      const res = await runDelete({
        db, sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', params: { id: exactRuleId } }),
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
