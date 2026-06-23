import { test } from 'node:test';
import assert from 'node:assert';

test('drizzle-orm/libsql resolves', async () => {
  const mod = await import('drizzle-orm/libsql');
  assert.ok(mod.drizzle, 'drizzle should be exported');
});

test('zod resolves', async () => {
  const mod = await import('zod');
  assert.ok(mod.z, 'z should be exported');
});

test('@libsql/client resolves', async () => {
  const mod = await import('@libsql/client');
  assert.ok(mod.createClient, 'createClient should be exported');
});
