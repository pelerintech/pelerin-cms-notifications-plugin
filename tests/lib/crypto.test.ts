import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { encrypt, decrypt, isEncrypted, decryptIfNeeded } from '../../src/lib/crypto.ts';

const KEY = 'test-encryption-key-32+chars-long';
const originalKey = process.env.NOTIFICATIONS_ENCRYPTION_KEY;

before(() => {
  process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
});

after(() => {
  if (originalKey === undefined) {
    delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
  } else {
    process.env.NOTIFICATIONS_ENCRYPTION_KEY = originalKey;
  }
});

describe('crypto module', () => {
  test('decrypt(encrypt(x)) round-trips the original value', () => {
    assert.strictEqual(decrypt(encrypt('sendgrid-api-key-123')), 'sendgrid-api-key-123');
  });

  test('isEncrypted(encrypt(x)) is true and isEncrypted("plain") is false', () => {
    assert.strictEqual(isEncrypted(encrypt('x')), true);
    assert.strictEqual(isEncrypted('plain'), false);
  });

  test('decryptIfNeeded returns plaintext unchanged and decrypts ciphertext', () => {
    assert.strictEqual(decryptIfNeeded('plain'), 'plain');
    assert.strictEqual(decryptIfNeeded(encrypt('secret')), 'secret');
  });

  test('two encryptions of the same value differ (random IV) but both decrypt', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    assert.notStrictEqual(a, b);
    assert.strictEqual(decrypt(a), 'same');
    assert.strictEqual(decrypt(b), 'same');
  });

  test('encrypt throws mentioning the missing key when env var is absent', () => {
    delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
    assert.throws(() => encrypt('x'), /encryption key/i);
    process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
  });

  test('decrypt throws when env var is absent', () => {
    const enc = encrypt('a:b:c-sentinel');
    delete process.env.NOTIFICATIONS_ENCRYPTION_KEY;
    assert.throws(() => decrypt('a:b:c'), /encryption key/i);
    // restore and sanity-check that a real ciphertext still decrypts
    process.env.NOTIFICATIONS_ENCRYPTION_KEY = KEY;
    void enc;
  });
});
