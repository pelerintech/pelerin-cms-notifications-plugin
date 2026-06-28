import { test } from 'node:test';
import assert from 'node:assert';
import {
  makeFakeSdk,
  makeCtx,
  poisonDb,
  unauthorizedError,
  forbiddenError,
} from '../api/helpers.ts';

test('makeFakeSdk().auth.requireAdmin() resolves to a stub admin user', async () => {
  const sdk = makeFakeSdk();
  const user = await sdk.auth.requireAdmin({} as any);
  assert.ok(user, 'requireAdmin should resolve to a truthy user');
  assert.equal(user.role, 'admin');
});

test('makeFakeSdk({ authThrows: unauthorizedError() }) throws with status 401', async () => {
  const sdk = makeFakeSdk({ authThrows: unauthorizedError() });
  await assert.rejects(
    () => sdk.auth.requireAdmin({} as any),
    (err: any) => err.status === 401,
  );
});

test('makeCtx({ body }) — request.json() returns the body, method is POST', async () => {
  const ctx = makeCtx({ url: 'http://x/y', body: { foo: 'bar' } });
  const parsed = await ctx.request.json();
  assert.deepEqual(parsed, { foo: 'bar' });
  assert.equal(ctx.request.method, 'POST');
});

test('makeCtx({ params }) — ctx.params holds the params', () => {
  const ctx = makeCtx({ params: { id: '123' } });
  assert.equal(ctx.params.id, '123');
});

test('poisonDb() throws on any property access or call', () => {
  const db = poisonDb();
  assert.throws(() => db.select(), /poison/i);
  assert.throws(() => db.anything, /poison/i);
});

test('unauthorizedError().status === 401', () => {
  assert.equal(unauthorizedError().status, 401);
});

test('forbiddenError().status === 403', () => {
  assert.equal(forbiddenError().status, 403);
});
