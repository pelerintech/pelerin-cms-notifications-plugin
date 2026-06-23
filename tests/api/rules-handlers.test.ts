import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createTestDb, seedMinimal } from '../db/harness.ts';
import { createRuleHandler } from '../../src/api/notifications/rules/create.ts';
import { listRulesHandler } from '../../src/api/notifications/rules/index.ts';
import { updateRuleHandler, deleteRuleHandler } from '../../src/api/notifications/rules/[id].ts';

test('createRuleHandler returns 201 and the row exists for a valid body', async () => {
  const { db } = await createTestDb();
  const result = await createRuleHandler(db, {
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  assert.strictEqual(result.status, 201);
  assert.ok(result.body.data.id);
});

test('createRuleHandler returns 400 for an empty body', async () => {
  const { db } = await createTestDb();
  const result = await createRuleHandler(db, {});
  assert.strictEqual(result.status, 400);
  assert.strictEqual(result.body.error, 'Validation failed');
  assert.ok(result.body.details);
});

test('createRuleHandler returns 409 for a duplicate triple', async () => {
  const { db } = await createTestDb();
  await createRuleHandler(db, {
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'a@b.com',
  });
  const result = await createRuleHandler(db, {
    event_pattern: 'shop.order.created',
    template_id: 't1',
    provider_name: 'sendgrid',
    to: 'c@d.com',
  });
  assert.strictEqual(result.status, 409);
});

test('listRulesHandler returns 200 with paginated data', async () => {
  const { db } = await createTestDb();
  const result = await listRulesHandler(db, { page: 1, limit: 20 });
  assert.strictEqual(result.status, 200);
  assert.ok(result.body.data);
  assert.ok(result.body.pagination);
});

test('updateRuleHandler returns 200 with updated to', async () => {
  const { db } = await createTestDb();
  const { exactRuleId } = await seedMinimal(db);
  const result = await updateRuleHandler(db, exactRuleId, { to: 'new@example.com' });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.data.to, 'new@example.com');
});

test('updateRuleHandler returns 404 for missing id', async () => {
  const { db } = await createTestDb();
  const result = await updateRuleHandler(db, 'missing', { to: 'x' });
  assert.strictEqual(result.status, 404);
});

test('deleteRuleHandler returns 200 for existing id', async () => {
  const { db } = await createTestDb();
  const { exactRuleId } = await seedMinimal(db);
  const result = await deleteRuleHandler(db, exactRuleId);
  assert.strictEqual(result.status, 200);
});

test('deleteRuleHandler returns 404 for missing id', async () => {
  const { db } = await createTestDb();
  const result = await deleteRuleHandler(db, 'missing');
  assert.strictEqual(result.status, 404);
});

// Confirm canonical exports are functions
test('index.ts exports listRulesHandler', () => {
  assert.strictEqual(typeof listRulesHandler, 'function');
});
test('[id].ts exports updateRuleHandler and deleteRuleHandler', () => {
  assert.strictEqual(typeof updateRuleHandler, 'function');
  assert.strictEqual(typeof deleteRuleHandler, 'function');
});

// Structural assertions: Astro wrappers exist and call requireAdmin
test('create.ts exports POST and calls requireAdmin', () => {
  const src = readFileSync(new URL('../../src/api/notifications/rules/create.ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('export const POST'), 'create.ts should export POST');
  assert.ok(src.includes('requireAdmin'), 'create.ts should call requireAdmin');
});

test('index.ts exports GET and calls requireAdmin', () => {
  const src = readFileSync(new URL('../../src/api/notifications/rules/index.ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('export const GET'), 'index.ts should export GET');
  assert.ok(src.includes('requireAdmin'), 'index.ts should call requireAdmin');
});

test('[id].ts exports PUT and DELETE and calls requireAdmin', () => {
  const src = readFileSync(new URL('../../src/api/notifications/rules/[id].ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('export const PUT'), '[id].ts should export PUT');
  assert.ok(src.includes('export const DELETE'), '[id].ts should export DELETE');
  assert.ok(src.includes('requireAdmin'), '[id].ts should call requireAdmin');
});
