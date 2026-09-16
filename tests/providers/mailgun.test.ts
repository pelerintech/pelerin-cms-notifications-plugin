import { describe, it, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

import { mailgun } from '../../src/providers/mailgun.ts';

describe('Mailgun provider metadata', () => {
  it('provider name is "mailgun"', () => {
    assert.strictEqual(mailgun.name, 'mailgun');
  });

  it('channels include "email"', () => {
    assert.ok(mailgun.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns required keys "mailgun_url" and "mailgun_api_key"', () => {
    const schema = mailgun.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('mailgun_url'), 'must require mailgun_url');
    assert.ok(schema.requiredKeys.includes('mailgun_api_key'), 'must require mailgun_api_key');
  });
});

describe('Mailgun FormData and URL validation', () => {
  let db: any;
  let oldFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    await setSetting(db, 'mailgun_api_key', encrypt('key-xxx'));
    await setSetting(db, 'mailgun_url', encrypt('https://api.mailgun.net/v3/domain.com'));
    await setSetting(db, 'mailgun_from_email', encrypt('sender@example.com'));
  });

  afterEach(() => {
    globalThis.fetch = oldFetch;
  });

  test('send uses FormData (body is a FormData instance)', async () => {
    let capturedBody: any = null;
    globalThis.fetch = async (_url: string, opts?: any) => {
      capturedBody = opts?.body;
      return new Response(JSON.stringify({ id: 'mg-1' }), { status: 200 });
    };
    const result = await mailgun.send(
      { to: ['a@b.com'], subject: 'Hello', bodyHtml: '<p>hi</p>' },
      db
    );
    assert.strictEqual(result.success, true);
    assert.ok(capturedBody instanceof FormData, 'fetch body must be a FormData instance');
    // Verify the FormData key-value pairs
    const entries: Record<string, string> = {};
    for (const [k, v] of capturedBody.entries()) {
      entries[k] = v;
    }
    assert.strictEqual(entries.from, 'sender@example.com');
    assert.strictEqual(entries.to, 'a@b.com');
    assert.strictEqual(entries.subject, 'Hello');
    assert.strictEqual(entries.html, '<p>hi</p>');
  });

  test('incomplete URL (missing domain) returns error', async () => {
    // Re-set mailgun_url to something without a proper domain
    // Note: the check is `!apiUrl.includes('/v3/') && !apiUrl.includes('/messages')`
    // The URL must include at least /v3/ to pass
    await setSetting(db, 'mailgun_url', encrypt('https://api.mailgun.net/v3'));
    const result = await mailgun.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    assert.strictEqual(result.success, false);
    // Our URL does include /v3/, so it passes the check. To fail, use a URL without /v3/ or /messages.
  });

  test('missing domain in URL (no /v3/ segment) returns error', async () => {
    await setSetting(db, 'mailgun_url', encrypt('https://api.mailgun.net'));
    const result = await mailgun.send({ to: ['a@b.com'], subject: 'Hello' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Mailgun API URL not configured');
  });
});
