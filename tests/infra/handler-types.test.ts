import { test } from 'node:test';
import assert from 'node:assert';
import type { HandlerDeps } from '../../src/lib/handler-types.ts';

test('HandlerDeps is a type with db, sdk, ctx keys', () => {
  const deps: HandlerDeps = { db: {}, sdk: {}, ctx: {} };
  assert.ok(deps, 'HandlerDeps should be constructable');
  const keys = Object.keys(deps);
  assert.ok(keys.includes('db'), 'HandlerDeps must have a db key');
  assert.ok(keys.includes('sdk'), 'HandlerDeps must have an sdk key');
  assert.ok(keys.includes('ctx'), 'HandlerDeps must have a ctx key');
  assert.equal(keys.length, 3, 'HandlerDeps must have exactly db, sdk, ctx');
});

// Runtime check: the module file must exist and be importable. `import type`
// is fully erased by Node's TS stripping, so it cannot alone prove the module
// exists — a dynamic runtime import can.
test('handler-types.ts module is importable at runtime', async () => {
  const mod = await import('../../src/lib/handler-types.ts');
  assert.ok(mod, 'handler-types.ts should load as a module');
});
