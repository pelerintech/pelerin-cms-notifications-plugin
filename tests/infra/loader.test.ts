import { test } from 'node:test';
import assert from 'node:assert';
import { ensureLoader } from '../../tests/stubs/register.mjs';

test('ensureLoader() registers the loader hook (idempotent)', async () => {
  ensureLoader();
  ensureLoader(); // second call must not throw
});

test('after ensureLoader(), importing pelerin:plugin-sdk resolves to the inert stub', async () => {
  ensureLoader();
  const mod = await import('pelerin:plugin-sdk');
  assert.ok(mod, 'pelerin:plugin-sdk should resolve via the loader stub');
  assert.equal(typeof (mod as any).createPluginContext, 'function',
    'plugin-sdk stub must export createPluginContext as a function');
});

test('plugin-sdk stub createPluginContext returns an object', async () => {
  ensureLoader();
  const mod = await import('pelerin:plugin-sdk');
  const ctx = (mod as any).createPluginContext();
  assert.equal(typeof ctx, 'object');
});

test('relative specifier without a .ts extension resolves with .ts appended', async () => {
  // Mirrors Astro/Vite resolution: importing './matcher' should resolve to
  // './matcher.ts'. Handler source imports already carry .ts, so this case
  // directly exercises the loader's KNOWN_EXT / .ts-append branch — the only
  // loader path with no other test coverage.
  ensureLoader();
  // src/lib/matcher.ts exports `matches`; import it WITHOUT the .ts extension.
  const mod = await import('../../src/lib/matcher');
  assert.equal(typeof (mod as any).matches, 'function',
    'extension-less relative import must resolve to the .ts module');
  assert.equal((mod as any).matches('shop.*', 'shop.order.created'), true,
    'the resolved module must be the real matcher (not an inert stub)');
});
