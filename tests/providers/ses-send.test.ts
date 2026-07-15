import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from '../db/harness.ts';
import { setSetting } from '../../src/lib/data/settings.ts';
import { encrypt } from '../../src/lib/crypto.ts';
import { ses, setSesClientFactory, resetSesClientFactory } from '../../src/providers/ses.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  else process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
});

describe('SES provider send (mocked client factory)', () => {
  let db: any;
  let capturedCmd: any;
  let factoryCallCount: number;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    capturedCmd = null;
    factoryCallCount = 0;
  });

  afterEach(() => {
    resetSesClientFactory();
  });

  test('success: constructs SendEmailCommand with the right fields and returns the AWS MessageId', async () => {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('verified@sender.com'));

    setSesClientFactory(() => {
      factoryCallCount++;
      return {
        send: async (cmd: any) => {
          capturedCmd = cmd;
          return { MessageId: 'ses-real-1' };
        },
      };
    });

    const result = await ses.send(
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
    assert.strictEqual(result.messageId, 'ses-real-1');
    assert.strictEqual(factoryCallCount, 1, 'factory must be called exactly once');
    assert.strictEqual(capturedCmd.input.Source, 'verified@sender.com');
    assert.deepStrictEqual(capturedCmd.input.Destination.ToAddresses, ['a@b.com']);
    assert.deepStrictEqual(capturedCmd.input.Destination.CcAddresses, ['c@d.com']);
    assert.deepStrictEqual(capturedCmd.input.Destination.BccAddresses, ['e@f.com']);
    assert.strictEqual(capturedCmd.input.Message.Subject.Data, 'Subj');
    assert.strictEqual(capturedCmd.input.Message.Body.Html.Data, '<p>h</p>');
    assert.strictEqual(capturedCmd.input.Message.Body.Text.Data, 't');
  });

  test('missing access key → credentials not configured, factory NOT called', async () => {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('verified@sender.com'));

    setSesClientFactory(() => {
      factoryCallCount++;
      return { send: async () => ({ MessageId: 'x' }) };
    });

    const result = await ses.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'AWS SES credentials not configured');
    assert.strictEqual(factoryCallCount, 0, 'factory must NOT be called');
  });

  test('missing from-email → from email not configured, factory NOT called', async () => {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));

    setSesClientFactory(() => {
      factoryCallCount++;
      return { send: async () => ({ MessageId: 'x' }) };
    });

    const result = await ses.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'AWS SES from email not configured');
    assert.strictEqual(factoryCallCount, 0, 'factory must NOT be called');
  });

  test('missing region → region not configured', async () => {
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('verified@sender.com'));

    const result = await ses.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'AWS SES region not configured');
    assert.strictEqual(factoryCallCount, 0, 'factory must NOT be called');
  });

  test('SDK throw → failure with the SDK error message', async () => {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('verified@sender.com'));

    setSesClientFactory(() => ({
      send: async () => {
        throw new Error(
          'Email address is not verified. The following identities failed the check in region us-east-1: a@b.com'
        );
      },
    }));

    const result = await ses.send({ to: ['a@b.com'], subject: 's' }, db);
    assert.strictEqual(result.success, false);
    assert.strictEqual(
      result.error,
      'SES send failed: Email address is not verified. The following identities failed the check in region us-east-1: a@b.com'
    );
  });

  test('HTML-only body → Body has Html but not Text', async () => {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('verified@sender.com'));

    setSesClientFactory(() => ({
      send: async (cmd: any) => {
        capturedCmd = cmd;
        return { MessageId: 'ses-real-1' };
      },
    }));

    await ses.send({ to: ['a@b.com'], subject: 's', bodyHtml: '<p>h</p>' }, db);
    assert.strictEqual(capturedCmd.input.Message.Body.Html.Data, '<p>h</p>');
    assert.strictEqual(capturedCmd.input.Message.Body.Text, undefined);
  });

  test('text-only body → Body has Text but not Html', async () => {
    await setSetting(db, 'ses_region', encrypt('us-east-1'));
    await setSetting(db, 'ses_access_key', encrypt('AKIA...'));
    await setSetting(db, 'ses_secret_key', encrypt('secret'));
    await setSetting(db, 'ses_from_email', encrypt('verified@sender.com'));

    setSesClientFactory(() => ({
      send: async (cmd: any) => {
        capturedCmd = cmd;
        return { MessageId: 'ses-real-1' };
      },
    }));

    await ses.send({ to: ['a@b.com'], subject: 's', bodyText: 't' }, db);
    assert.strictEqual(capturedCmd.input.Message.Body.Text.Data, 't');
    assert.strictEqual(capturedCmd.input.Message.Body.Html, undefined);
  });
});
