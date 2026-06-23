import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';

const settingsUrl = new URL('../../src/api/notifications/providers/[name]/settings.ts', import.meta.url);
const cryptoUrl = new URL('../../src/lib/crypto.ts', import.meta.url);

test('settings.ts exists as a .ts file', () => {
  assert.ok(existsSync(settingsUrl));
});

test('settings.mjs does NOT exist', () => {
  assert.ok(!existsSync(new URL('../../src/api/notifications/providers/[name]/settings.mjs', import.meta.url)));
});

test('settings.ts exports GET and POST', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(src.includes('export const GET'));
  assert.ok(src.includes('export const POST'));
});

test('settings.ts does not reference getTable', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(!src.includes('getTable'), 'getTable should be removed');
});

test('settings.ts has NO in-memory Map (_settingsStore)', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(!src.includes('_settingsStore'), 'in-memory Map must be removed');
});

test('settings.ts has NO base64 toy crypto', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(!src.includes('Buffer.from(JSON.stringify'), 'base64 toy encrypt must be removed');
  assert.ok(!src.includes("toString('base64')"), 'base64 encoding toy must be removed');
});

test('settings.ts has NO ENCRYPTION_KEY default constant / dev fallback', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(!/ENCRYPTION_KEY\s*=\s*process\.env/.test(src), 'ENCRYPTION_KEY constant must be removed');
  assert.ok(!src.includes('default-dev-key'), 'insecure dev default must be removed');
});

test('settings.ts calls requireAdmin', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(src.includes('requireAdmin'), 'must call requireAdmin');
});

test('settings.ts uses createPluginContext', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(src.includes('createPluginContext'), 'must use createPluginContext');
});

test('settings.ts dynamically imports astro:db', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(src.includes("await import('astro:db')"), 'must dynamically import astro:db');
});

test('settings.ts imports the real crypto module', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(src.includes('lib/crypto.ts'), 'must import from lib/crypto.ts');
  assert.ok(src.includes('encrypt'), 'must import encrypt');
  assert.ok(src.includes('decryptIfNeeded'), 'must import decryptIfNeeded');
});

test('settings.ts imports the settings accessor', () => {
  const src = readFileSync(settingsUrl, 'utf-8');
  assert.ok(src.includes('lib/data/settings.ts'), 'must import from lib/data/settings.ts');
});

test('src/lib/crypto.ts exists and exports encrypt/decrypt/decryptIfNeeded', () => {
  assert.ok(existsSync(cryptoUrl));
  const src = readFileSync(cryptoUrl, 'utf-8');
  assert.ok(/export function encrypt/.test(src));
  assert.ok(/export function decrypt/.test(src));
  assert.ok(/export function decryptIfNeeded/.test(src));
  assert.ok(/export function isEncrypted/.test(src));
});
