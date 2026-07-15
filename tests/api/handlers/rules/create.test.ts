import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../../stubs/register.mjs';
import { makeFakeSdk, makeCtx, poisonDb, unauthorizedError } from '../../helpers.ts';
import { createTestDb, insertFixture } from '../../../db/harness.ts';
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
const { runPost } = await import('../../../../src/api/notifications/rules/create.ts');

function setDevMode(on: boolean) {
  if (on) process.env.NOTIFICATIONS_DEV_MODE = 'true';
  else delete process.env.NOTIFICATIONS_DEV_MODE;
}

async function seedTemplate(db: any) {
  await insertFixture(db, 'notification_templates', {
    id: 'tpl-1',
    name: 'T',
    subject: 'S',
    body_html: '<p>x</p>',
    body_text: null,
    created_at: new Date(),
    updated_at: null,
  });
}

describe('runPost (rules/create) — auth + validation + happy + guardrail + duplicate', () => {
  test('adminAuthFail: requireAdmin throws 401, poison db untouched → 401 + success:false', async () => {
    setDevMode(true);
    await matrix.adminAuthFail({
      run: runPost,
      url: 'http://localhost/api/plugins/notifications/rules',
      body: {
        event_pattern: 'shop.order.created',
        template_id: 'tpl-1',
        provider_name: 'sendgrid',
        to: 'a@b.com',
      },
    });
  });

  test('validation-fail: empty body → 422 + success:false + non-empty fields', async () => {
    setDevMode(true);
    await matrix.validationFail({
      run: runPost,
      url: 'http://localhost/api/plugins/notifications/rules',
      invalidBody: {},
    });
  });

  test('happy-path (dev mode): valid body → 201 + success:true + data.id', async () => {
    setDevMode(true);
    const { db, cleanup } = await createTestDb();
    try {
      await seedTemplate(db);
      const sdk = makeFakeSdk();
      const ctx = makeCtx({
        url: 'http://localhost/api/plugins/notifications/rules',
        body: {
          event_pattern: 'shop.order.created',
          template_id: 'tpl-1',
          provider_name: 'sendgrid',
          to: 'a@b.com',
          channel: 'email',
        },
      });
      const res = await runPost({ db, sdk, ctx });
      assert.equal(res.status, 201, `expected 201, got ${res.status}`);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.ok(b.data.id, 'data.id should exist');
      assert.equal(b.data.channel, 'email');
    } finally {
      await cleanup();
    }
  });

  test('guardrail: prod + unconfigured provider → 400 + success:false, no row', async () => {
    setDevMode(false);
    const { db, cleanup } = await createTestDb();
    try {
      await seedTemplate(db);
      const sdk = makeFakeSdk();
      const ctx = makeCtx({
        url: 'http://localhost/api/plugins/notifications/rules',
        body: {
          event_pattern: 'e',
          template_id: 'tpl-1',
          provider_name: 'sendgrid',
          to: 'a@b.com',
          channel: 'email',
        },
      });
      const res = await runPost({ db, sdk, ctx });
      assert.equal(res.status, 400, `expected 400, got ${res.status}`);
      const b = await res.json();
      assert.equal(b.success, false);
      assert.match(b.error, /not configured/i);
      const r = await getRule(db, b.data?.id ?? 'none');
      assert.equal(r, null);
    } finally {
      await cleanup();
    }
  });

  test('guardrail: prod + configured sendgrid → 201', async () => {
    setDevMode(false);
    const { db, cleanup } = await createTestDb();
    try {
      await seedTemplate(db);
      await setSetting(db, 'sendgrid_api_key', encrypt('SG.realkey'));
      const sdk = makeFakeSdk();
      const ctx = makeCtx({
        url: 'http://localhost/api/plugins/notifications/rules',
        body: {
          event_pattern: 'e',
          template_id: 'tpl-1',
          provider_name: 'sendgrid',
          to: 'a@b.com',
          channel: 'email',
        },
      });
      const res = await runPost({ db, sdk, ctx });
      assert.equal(res.status, 201);
      const b = await res.json();
      assert.equal(b.success, true);
      assert.equal(b.data.provider_name, 'sendgrid');
    } finally {
      await cleanup();
    }
  });

  test('guardrail: prod + provider_name=local → 400', async () => {
    setDevMode(false);
    const { db, cleanup } = await createTestDb();
    try {
      await seedTemplate(db);
      const sdk = makeFakeSdk();
      const ctx = makeCtx({
        url: 'http://localhost/api/plugins/notifications/rules',
        body: {
          event_pattern: 'e',
          template_id: 'tpl-1',
          provider_name: 'local',
          to: 'a@b.com',
          channel: 'email',
        },
      });
      const res = await runPost({ db, sdk, ctx });
      assert.equal(res.status, 400);
      const b = await res.json();
      assert.equal(b.success, false);
      assert.match(b.error, /not configured/i);
    } finally {
      await cleanup();
    }
  });

  test('duplicate triple → 409 + success:false', async () => {
    setDevMode(true);
    const { db, cleanup } = await createTestDb();
    try {
      await seedTemplate(db);
      const body = {
        event_pattern: 'shop.order.created',
        template_id: 'tpl-1',
        provider_name: 'sendgrid',
        to: 'a@b.com',
        channel: 'email',
      };
      await runPost({
        db,
        sdk: makeFakeSdk(),
        ctx: makeCtx({ url: 'http://localhost/api', body }),
      });
      const res = await runPost({
        db,
        sdk: makeFakeSdk(),
        ctx: makeCtx({
          url: 'http://localhost/api',
          body: { ...body, to: 'c@d.com' },
        }),
      });
      assert.equal(res.status, 409, `expected 409, got ${res.status}`);
      const b = await res.json();
      assert.equal(b.success, false);
    } finally {
      await cleanup();
    }
  });
});
