/**
 * Behavioral test for Brevo send.
 *
 * Tests that brevo.send() constructs the correct request body:
 * - uses `sender` (not `from`) per the Brevo v3 API
 * - returns success/messageId from the API response
 * - fails loud with missing credentials
 */
import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';
import { brevo } from '../../src/providers/brevo.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

describe('Brevo provider send (stubbed fetch)', () => {
  let db: any;
  let capturedRequest: { url: string; body: any; headers: Record<string, string> } | null;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    capturedRequest = null;

    // Stub globalThis.fetch to capture the request
    globalThis.fetch = async (url: string, options: any) => {
      capturedRequest = {
        url,
        body: JSON.parse(options.body),
        headers: options.headers,
      };
      return {
        ok: true,
        json: async () => ({ messageId: 'brevo-1' }),
        text: async () => '',
      };
    };
  });

  afterEach(() => {
    // Restore fetch (if we stubbed it)
    delete (globalThis as any).fetch;
  });

  test('success: sends request with `sender` (not `from`) and returns messageId', async () => {
    await setSetting(db, 'brevo_api_key', encrypt('brevo-key-123'));
    await setSetting(db, 'brevo_api_url', encrypt('https://api.brevo.com/v3/smtp/email'));
    await setSetting(db, 'brevo_from_email', encrypt('sender@example.com'));

    const result = await brevo.send(
      {
        to: ['a@b.com'],
        cc: ['c@d.com'],
        bcc: ['e@f.com'],
        subject: 'Subj',
        bodyHtml: '<p>h</p>',
        bodyText: 't',
      },
      db
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.messageId, 'brevo-1');

    // Must have `sender` key (NOT `from`)
    assert.ok(capturedRequest !== null, 'fetch must have been called');
    assert.ok('sender' in capturedRequest!.body, 'body must have `sender` key');
    assert.ok(!('from' in capturedRequest!.body), 'body must NOT have `from` key');
    assert.deepStrictEqual(capturedRequest!.body.sender, { email: 'sender@example.com' });

    // Other fields should be correct
    assert.deepStrictEqual(capturedRequest!.body.to, [{ email: 'a@b.com' }]);
    assert.deepStrictEqual(capturedRequest!.body.cc, [{ email: 'c@d.com' }]);
    assert.deepStrictEqual(capturedRequest!.body.bcc, [{ email: 'e@f.com' }]);
    assert.strictEqual(capturedRequest!.body.subject, 'Subj');
    assert.strictEqual(capturedRequest!.body.htmlContent, '<p>h</p>');
    assert.strictEqual(capturedRequest!.body.textContent, 't');
    assert.strictEqual(capturedRequest!.headers['api-key'], 'brevo-key-123');
    assert.strictEqual(capturedRequest!.url, 'https://api.brevo.com/v3/smtp/email');
  });

  test('missing API key → credentials not configured', async () => {
    // Only set URL, no API key
    await setSetting(db, 'brevo_api_url', encrypt('https://api.brevo.com/v3/smtp/email'));

    const result = await brevo.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Brevo API key not configured');
  });

  test('missing API URL → URL not configured', async () => {
    await setSetting(db, 'brevo_api_key', encrypt('brevo-key-123'));

    const result = await brevo.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Brevo API URL not configured');
  });

  test('API error → failure with status and body', async () => {
    await setSetting(db, 'brevo_api_key', encrypt('brevo-key-123'));
    await setSetting(db, 'brevo_api_url', encrypt('https://api.brevo.com/v3/smtp/email'));
    await setSetting(db, 'brevo_from_email', encrypt('sender@example.com'));

    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 400,
        json: async () => ({ message: 'bad request' }),
        text: async () => 'Bad Request',
      };
    };

    const result = await brevo.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes('400'), 'error must include status code');
  });

  test('fetch throws → failure with error message', async () => {
    await setSetting(db, 'brevo_api_key', encrypt('brevo-key-123'));
    await setSetting(db, 'brevo_api_url', encrypt('https://api.brevo.com/v3/smtp/email'));
    await setSetting(db, 'brevo_from_email', encrypt('sender@example.com'));

    globalThis.fetch = async () => {
      throw new Error('Network failure');
    };

    const result = await brevo.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes('Network failure'), 'error must include exception message');
  });
});
