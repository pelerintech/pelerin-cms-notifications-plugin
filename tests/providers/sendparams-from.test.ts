import { test } from 'node:test';
import assert from 'node:assert';
import type { SendParams } from '../../src/providers/interface.ts';
import { local } from '../../src/providers/local.ts';
import { createTestDb } from '../db/harness.ts';

// Compile-time assertion that SendParams has an optional `from?: string`.
// This fails `tsc --noEmit --strict` if `from` is not part of the interface.
const _paramsWithFrom: SendParams = { to: [], subject: '', from: 'orders@shop.com' };
void _paramsWithFrom;

/**
 * Type-resolution check that `SendParams` accepts an optional `from?: string`.
 * If `from` were absent from `SendParams`, a provider `send` typed against the
 * interface would reject it at the type level. Under `node --test` (Node strips
 * types), this is a runtime check that the provider accepts the `from` field
 * without throwing and that the local provider ignores it.
 */
test('providers accept an optional `from` field in send params', async () => {
  const { db } = await createTestDb();
  const result = await local.send({ to: ['a@b.com'], subject: 's', from: 'orders@shop.com' }, db);
  assert.strictEqual(result.success, true);
  // local provider ignores `from` and returns a local messageId
  assert.match(result.messageId || '', /^local-/);
});
