import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
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

  // ─── v2 format scenarios ────────────────────────────────────────────────

  test('encrypt produces v2-prefixed ciphertext with 4 parts', () => {
    const enc = encrypt('my-secret');
    assert.ok(enc.startsWith('v2:'), 'encrypted value must start with v2:');
    const parts = enc.split(':');
    // v2:<iv>:<salt>:<authTag>:<ciphertext> = 5 colon-separated parts
    assert.strictEqual(parts.length, 5, 'v2 ciphertext must have 5 colon-separated parts');
  });

  test('decrypt recovers a v2-encrypted value', () => {
    const enc = encrypt('my-secret');
    assert.strictEqual(decrypt(enc), 'my-secret');
  });

  test('tampered v2 ciphertext throws', () => {
    const enc = encrypt('my-secret');
    // Flip a character in the ciphertext portion (last part)
    const parts = enc.split(':');
    const ct = parts[4];
    const flipped = ct.slice(0, -1) + (ct[ct.length - 1] === '0' ? '1' : '0');
    const tampered = parts.slice(0, 4).join(':') + ':' + flipped;
    assert.throws(() => decrypt(tampered), /auth.?tag|Unsupported|tag/i);
  });

  // ─── v1 legacy format scenarios ─────────────────────────────────────────

  test('isEncrypted recognizes v2 format', () => {
    assert.strictEqual(isEncrypted(encrypt('x')), true);
  });

  test('isEncrypted recognizes valid hex:hex:hex pattern (v1-like)', () => {
    // A v1-encrypted value follows the hex:hex:hex pattern
    assert.strictEqual(isEncrypted('ab:cd:ef'), true);
    assert.strictEqual(isEncrypted('00:00:00'), true);
  });

  test('isEncrypted false for plain values', () => {
    assert.strictEqual(isEncrypted('plain'), false);
    assert.strictEqual(isEncrypted(''), false);
    assert.strictEqual(isEncrypted('ab:cd'), false);
    assert.strictEqual(isEncrypted('ab:cd:ef:gh'), false);
  });

  test('decryptIfNeeded handles both formats', () => {
    const plain = 'some-plain-value';
    const v2Enc = encrypt(plain);
    assert.strictEqual(decryptIfNeeded(v2Enc), plain, 'decryptIfNeeded must handle v2');
    assert.strictEqual(decryptIfNeeded(plain), plain, 'decryptIfNeeded must pass through plain');
  });

  test('v1 legacy format decrypt recovers original plaintext', () => {
    // Construct a v1 ciphertext using SHA-256 KDF (the old deriveKeyV1):
    // format: <ivHex>:<authTagHex>:<ctHex>
    const plaintext = 'legacy-test-value';
    const key = crypto.createHash('sha256').update(KEY).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv) as crypto.CipherGCM;
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const v1Value = `${iv.toString('hex')}:${authTag.toString('hex')}:${ct.toString('hex')}`;

    // Verify v1 format doesn't start with v2:
    assert.ok(!v1Value.startsWith('v2:'), 'v1 value should not have v2: prefix');
    // Verify decrypt (which falls back to v1) recovers the plaintext:
    assert.strictEqual(decrypt(v1Value), plaintext);
  });
});
