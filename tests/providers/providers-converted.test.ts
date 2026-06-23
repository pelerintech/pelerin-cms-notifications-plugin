import { test } from 'node:test';
import assert from 'node:assert';
import { readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { listProviders } from '../../src/providers/index.ts';

test('no .mjs files remain under src/providers/', () => {
  const mjsFiles = readdirSync(new URL('../../src/providers/', import.meta.url))
    .filter(f => f.endsWith('.mjs'));
  assert.deepStrictEqual(mjsFiles, []);
});

test('interface.ts declares NotificationProvider interface', () => {
  const src = readFileSync(new URL('../../src/providers/interface.ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('interface NotificationProvider'));
  assert.ok(src.includes('name:'));
  assert.ok(src.includes('channels:'));
  assert.ok(src.includes('getConfigSchema'));
  assert.ok(src.includes('send'));
});

test('all 6 providers are registered after import', () => {
  const providers = listProviders();
  assert.ok(providers.includes('sendgrid'));
  assert.ok(providers.includes('mailgun'));
  assert.ok(providers.includes('ses'));
  assert.ok(providers.includes('smtp'));
  assert.ok(providers.includes('brevo'));
  assert.ok(providers.includes('local'));
});
