import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { matches } from '../../src/lib/matcher.ts';
import { interpolate } from '../../src/lib/interpolation.ts';
import { findMatchingRules } from '../../src/lib/rule-lookup.ts';
import { getProviderForRule } from '../../src/lib/provider-selection.ts';

test('pure libs are converted to .ts (no .mjs remain)', () => {
  assert.ok(existsSync(new URL('../../src/lib/matcher.ts', import.meta.url)));
  assert.ok(!existsSync(new URL('../../src/lib/matcher.mjs', import.meta.url)));
  assert.ok(existsSync(new URL('../../src/lib/interpolation.ts', import.meta.url)));
  assert.ok(!existsSync(new URL('../../src/lib/interpolation.mjs', import.meta.url)));
  assert.ok(existsSync(new URL('../../src/lib/rule-lookup.ts', import.meta.url)));
  assert.ok(!existsSync(new URL('../../src/lib/rule-lookup.mjs', import.meta.url)));
  assert.ok(existsSync(new URL('../../src/lib/provider-selection.ts', import.meta.url)));
  assert.ok(!existsSync(new URL('../../src/lib/provider-selection.mjs', import.meta.url)));
});

test('matches works post-conversion', () => {
  assert.strictEqual(matches('shop.*', 'shop.order.created'), true);
});

test('interpolate works post-conversion', () => {
  assert.strictEqual(interpolate('Hi {{ name }}', { name: 'X' }), 'Hi X');
});

test('findMatchingRules orders by specificity', () => {
  const rules = [
    { id: 'r1', event_pattern: 'shop.*', active: true },
    { id: 'r2', event_pattern: 'shop.order.created', active: true },
  ];
  const results = findMatchingRules(rules as any, 'shop.order.created');
  assert.strictEqual(results[0].id, 'r2'); // exact first
  assert.strictEqual(results[1].id, 'r1'); // wildcard second
});

test('getProviderForRule returns local in dev mode', async () => {
  await import('../../src/providers/index.ts');
  const provider = getProviderForRule({ provider_name: 'sendgrid' } as any, true);
  assert.strictEqual(provider?.name, 'local');
});
