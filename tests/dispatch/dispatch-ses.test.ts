import { describe, test, before, after, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture } from '../db/harness.ts';
import { notification_logs } from '../../src/db/schema.ts';
import { dispatchEvent } from '../../src/lib/dispatch.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';
import { setSesClientFactory, resetSesClientFactory } from '../../src/providers/ses.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;
const originalDevMode = process.env.NOTIFICATIONS_DEV_MODE;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
  if (originalDevMode === undefined) delete process.env.NOTIFICATIONS_DEV_MODE;
  else process.env.NOTIFICATIONS_DEV_MODE = originalDevMode;
});

afterEach(() => {
  resetSesClientFactory();
});

/** Seed a ses rule + template + (optionally) ses credentials. */
async function seedSes(db: any, opts: { withCreds: boolean }) {
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't-ses', name: 'Order SES', subject: 'Order {{ order_id }}',
    body_html: '<p>{{ customer_email }}</p>', body_text: null, created_at: now,
  });
  await insertFixture(db, 'notification_rules', {
    id: 'r-ses', event_pattern: 'shop.order.created', template_id: 't-ses',
    provider_name: 'ses', to: '{{ customer_email }}', cc: null, bcc: null,
    active: true, created_at: now,
  });
  if (opts.withCreds) {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('verified@sender.com'));
  }
}

describe('dispatch e2e with SES (prod mode)', () => {
  test('prod-mode SES dispatch writes a truthful success log with the real MessageId', async () => {
    delete process.env.NOTIFICATIONS_DEV_MODE;
    const { db } = await createTestDb();
    await seedSes(db, { withCreds: true });

    setSesClientFactory(() => ({ send: async () => ({ MessageId: 'ses-dispatch-1' }) }));

    await dispatchEvent(db, 'shop.order.created', {
      order_id: '9',
      customer_email: 'buyer@example.com',
    });

    const logs = await db.select().from(notification_logs);
    assert.strictEqual(logs.length, 1);
    const log = logs[0];
    assert.strictEqual(log.provider_name, 'ses');
    assert.strictEqual(log.success, true);
    assert.strictEqual(log.message_id, 'ses-dispatch-1');
    assert.strictEqual(log.to, 'buyer@example.com');
    assert.strictEqual(log.subject, 'Order 9');
  });

  test('no ses creds in prod mode → failure log, factory NOT called', async () => {
    delete process.env.NOTIFICATIONS_DEV_MODE;
    const { db } = await createTestDb();
    await seedSes(db, { withCreds: false });

    let factoryCalls = 0;
    setSesClientFactory(() => {
      factoryCalls++;
      return { send: async () => ({ MessageId: 'should-not-happen' }) };
    });

    await dispatchEvent(db, 'shop.order.created', {
      order_id: '9',
      customer_email: 'buyer@example.com',
    });

    const logs = await db.select().from(notification_logs);
    assert.strictEqual(logs.length, 1);
    const log = logs[0];
    assert.strictEqual(log.provider_name, 'ses');
    assert.strictEqual(log.success, false);
    assert.match(log.error || '', /AWS SES credentials not configured/);
    assert.strictEqual(factoryCalls, 0, 'factory must NOT be called');
  });

  test('dev mode ON → local provider used, ses.send NOT called, provider_name preserved', async () => {
    process.env.NOTIFICATIONS_DEV_MODE = 'true';
    const { db } = await createTestDb();
    await seedSes(db, { withCreds: true });

    let factoryCalls = 0;
    setSesClientFactory(() => {
      factoryCalls++;
      return { send: async () => ({ MessageId: 'should-not-happen' }) };
    });

    await dispatchEvent(db, 'shop.order.created', {
      order_id: '9',
      customer_email: 'buyer@example.com',
    });

    const logs = await db.select().from(notification_logs);
    assert.strictEqual(logs.length, 1);
    const log = logs[0];
    assert.strictEqual(log.success, true);
    assert.ok(log.message_id?.startsWith('local-'), `expected local- id, got ${log.message_id}`);
    assert.strictEqual(log.provider_name, 'ses', 'provider_name preserved in dev mode');
    assert.strictEqual(factoryCalls, 0, 'ses factory must NOT be called in dev mode');
  });
});
