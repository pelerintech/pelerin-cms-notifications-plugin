import { test } from 'node:test';
import assert from 'node:assert';
import { listProviderObjects, listProviders } from '../../src/providers/index.ts';

test('listProviderObjects returns an array of provider objects', () => {
  const objs = listProviderObjects();
  assert.ok(Array.isArray(objs));
  assert.ok(objs.length > 0);
  for (const p of objs) {
    assert.strictEqual(typeof p.name, 'string');
    assert.ok(Array.isArray(p.channels));
  }
});

test('listProviderObjects includes brevo with channels including email', () => {
  const objs = listProviderObjects();
  const brevo = objs.find((p) => p.name === 'brevo');
  assert.ok(brevo, 'brevo must be registered');
  assert.ok(brevo!.channels.includes('email'));
  assert.deepStrictEqual(brevo!.getConfigSchema().requiredKeys, ['brevo_api_key', 'brevo_api_url']);
});

test('listProviders (names-only) still returns string[] including brevo (non-breaking)', () => {
  const names = listProviders();
  assert.ok(Array.isArray(names));
  for (const n of names) {
    assert.strictEqual(typeof n, 'string');
  }
  assert.ok(names.includes('brevo'));
});
