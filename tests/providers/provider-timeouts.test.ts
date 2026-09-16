/**
 * Timeout tests for all 5 remote providers.
 *
 * Verifies that each provider times out after a short interval when the
 * underlying transport never responds. Uses setSendTimeoutForTests(100) to
 * force a 100ms timeout.
 */
import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;
const SHORT_MS = 100;
const TEST_TIMEOUT_MS = 15_000;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

/**
 * A fetch stub that never resolves on its own but rejects with a TimeoutError
 * DOMException when the AbortSignal fires. This lets us test that providers
 * correctly handle signal-based timeouts.
 */
function signalAwareNeverResolvingFetch(
  _url: string,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const signal = options?.signal;
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
        return;
      }
      signal.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
      });
    }
  });
}

// ─── SendGrid ──────────────────────────────────────────────────────────────

describe('SendGrid provider timeout', { timeout: TEST_TIMEOUT_MS }, () => {
  let db: any;
  let oldFetch: typeof globalThis.fetch;
  let mod: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'sendgrid_api_key', encrypt('sg-key-123'));
    await setSetting(db, 'sendgrid_from_email', encrypt('sg@test.com'));
    oldFetch = globalThis.fetch;
    globalThis.fetch = signalAwareNeverResolvingFetch;
    mod = await import('../../src/providers/sendgrid.ts');
  });

  afterEach(() => {
    globalThis.fetch = oldFetch;
    mod?.setSendTimeoutForTests?.(30_000);
  });

  test('times out when fetch never resolves', async () => {
    mod.setSendTimeoutForTests(SHORT_MS);
    const start = Date.now();
    const result = await mod.sendgrid.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    const elapsed = Date.now() - start;
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /SendGrid send timed out after \d+ms/);
    assert.ok(elapsed < 10_000, `took ${elapsed}ms — expected <10s`);
  });
});

// ─── Mailgun ───────────────────────────────────────────────────────────────

describe('Mailgun provider timeout', { timeout: TEST_TIMEOUT_MS }, () => {
  let db: any;
  let oldFetch: typeof globalThis.fetch;
  let mod: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'mailgun_api_key', encrypt('mg-key-123'));
    await setSetting(db, 'mailgun_url', encrypt('https://api.mailgun.net/v3/example.com'));
    await setSetting(db, 'mailgun_from_email', encrypt('mg@test.com'));
    oldFetch = globalThis.fetch;
    globalThis.fetch = signalAwareNeverResolvingFetch;
    mod = await import('../../src/providers/mailgun.ts');
  });

  afterEach(() => {
    globalThis.fetch = oldFetch;
    mod?.setSendTimeoutForTests?.(30_000);
  });

  test('times out when fetch never resolves', async () => {
    mod.setSendTimeoutForTests(SHORT_MS);
    const start = Date.now();
    const result = await mod.mailgun.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    const elapsed = Date.now() - start;
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /Mailgun send timed out after \d+ms/);
    assert.ok(elapsed < 10_000, `took ${elapsed}ms — expected <10s`);
  });
});

// ─── Brevo ─────────────────────────────────────────────────────────────────

describe('Brevo provider timeout', { timeout: TEST_TIMEOUT_MS }, () => {
  let db: any;
  let oldFetch: typeof globalThis.fetch;
  let mod: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'brevo_api_key', encrypt('brevo-key-123'));
    await setSetting(db, 'brevo_api_url', encrypt('https://api.brevo.com/v3/smtp/email'));
    await setSetting(db, 'brevo_from_email', encrypt('br@test.com'));
    oldFetch = globalThis.fetch;
    globalThis.fetch = signalAwareNeverResolvingFetch;
    mod = await import('../../src/providers/brevo.ts');
  });

  afterEach(() => {
    globalThis.fetch = oldFetch;
    mod?.setSendTimeoutForTests?.(30_000);
  });

  test('times out when fetch never resolves', async () => {
    mod.setSendTimeoutForTests(SHORT_MS);
    const start = Date.now();
    const result = await mod.brevo.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    const elapsed = Date.now() - start;
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /Brevo send timed out after \d+ms/);
    assert.ok(elapsed < 10_000, `took ${elapsed}ms — expected <10s`);
  });
});

// ─── SES ───────────────────────────────────────────────────────────────────

describe('SES provider timeout', { timeout: TEST_TIMEOUT_MS }, () => {
  let db: any;
  let mod: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('verified@sender.com'));

    mod = await import('../../src/providers/ses.ts');
    mod.setSesClientFactory(() => ({
      send: async (_cmd: any, options?: { abortSignal?: AbortSignal }) => {
        return new Promise<any>((_resolve, reject) => {
          const signal = options?.abortSignal;
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException('The operation was aborted due to timeout', 'AbortError'));
              return;
            }
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted due to timeout', 'AbortError'));
            });
          }
        });
      },
    }));
  });

  afterEach(() => {
    mod?.resetSesClientFactory();
    mod?.setSendTimeoutForTests?.(30_000);
  });

  test('times out when client.send never resolves', async () => {
    mod.setSendTimeoutForTests(SHORT_MS);
    const start = Date.now();
    const result = await mod.ses.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    const elapsed = Date.now() - start;
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /SES send timed out after \d+ms/);
    assert.ok(elapsed < 10_000, `took ${elapsed}ms — expected <10s`);
  });
});

// ─── SMTP ──────────────────────────────────────────────────────────────────

describe('SMTP provider timeout', { timeout: TEST_TIMEOUT_MS }, () => {
  let db: any;
  let mod: any;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'smtp_host', encrypt('smtp.example.com'));
    await setSetting(db, 'smtp_port', encrypt('587'));
    await setSetting(db, 'smtp_username', encrypt('user'));
    await setSetting(db, 'smtp_password', encrypt('pass'));
    await setSetting(db, 'smtp_from_email', encrypt('test@example.com'));
    mod = await import('../../src/providers/smtp.ts');
  });

  afterEach(() => {
    mod?.setSendTimeoutForTests?.(30_000);
  });

  test('times out when transport never connects (short timeout)', async () => {
    mod.setSendTimeoutForTests(SHORT_MS);
    const start = Date.now();
    const result = await mod.smtp.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    const elapsed = Date.now() - start;
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /SMTP send timed out after \d+ms/);
    assert.ok(elapsed < 10_000, `took ${elapsed}ms — expected <10s`);
  });
});
