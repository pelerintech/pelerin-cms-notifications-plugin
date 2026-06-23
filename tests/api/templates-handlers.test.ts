import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createTestDb, seedMinimal } from '../db/harness.ts';
import { createTemplateHandler } from '../../src/api/notifications/templates/create.ts';
import { listTemplatesHandler } from '../../src/api/notifications/templates/index.ts';
import { updateTemplateHandler, deleteTemplateHandler } from '../../src/api/notifications/templates/[id].ts';

test('listTemplatesHandler returns 200 with empty data on empty db', async () => {
  const { db } = await createTestDb();
  const result = await listTemplatesHandler(db, { page: 1, limit: 20 });
  assert.strictEqual(result.status, 200);
  assert.deepStrictEqual(result.body.data, []);
  assert.ok(result.body.pagination);
});

test('listTemplatesHandler returns 200 with populated data', async () => {
  const { db } = await createTestDb();
  await seedMinimal(db);
  const result = await listTemplatesHandler(db, { page: 1, limit: 20 });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.data.length, 1);
});

test('listTemplatesHandler with search filters by name', async () => {
  const { db } = await createTestDb();
  await seedMinimal(db);
  const result = await listTemplatesHandler(db, { page: 1, limit: 20, search: 'Order' });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.data.length, 1);
});

test('listTemplatesHandler paginates', async () => {
  const { db } = await createTestDb();
  await seedMinimal(db);
  const result = await listTemplatesHandler(db, { page: 2, limit: 20 });
  assert.strictEqual(result.body.data.length, 0);
  assert.strictEqual(result.body.pagination.total, 1);
});

test('createTemplateHandler returns 201 for a valid body', async () => {
  const { db } = await createTestDb();
  const result = await createTemplateHandler(db, {
    name: 'Welcome',
    subject: 'Hi {{ name }}',
    body_html: '<p>Hi</p>',
  });
  assert.strictEqual(result.status, 201);
  assert.ok(result.body.data.id);
});

test('createTemplateHandler returns 400 for an invalid body', async () => {
  const { db } = await createTestDb();
  const result = await createTemplateHandler(db, { name: 'X' });
  assert.strictEqual(result.status, 400);
  assert.strictEqual(result.body.error, 'Validation failed');
});

test('updateTemplateHandler returns 200 for an existing template', async () => {
  const { db } = await createTestDb();
  const { templateId } = await seedMinimal(db);
  const result = await updateTemplateHandler(db, templateId, { subject: 'New Subject' });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.data.subject, 'New Subject');
});

test('updateTemplateHandler returns 404 for a missing id', async () => {
  const { db } = await createTestDb();
  const result = await updateTemplateHandler(db, 'missing', { subject: 'x' });
  assert.strictEqual(result.status, 404);
});

test('deleteTemplateHandler returns 200 for an existing template', async () => {
  const { db } = await createTestDb();
  const { templateId } = await seedMinimal(db);
  const result = await deleteTemplateHandler(db, templateId);
  assert.strictEqual(result.status, 200);
});

test('deleteTemplateHandler returns 404 for a missing id', async () => {
  const { db } = await createTestDb();
  const result = await deleteTemplateHandler(db, 'missing');
  assert.strictEqual(result.status, 404);
});

// Structural assertions
test('create.ts exports POST and calls requireAdmin', () => {
  const src = readFileSync(new URL('../../src/api/notifications/templates/create.ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('export const POST'));
  assert.ok(src.includes('requireAdmin'));
});

test('index.ts exports GET and calls requireAdmin', () => {
  const src = readFileSync(new URL('../../src/api/notifications/templates/index.ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('export const GET'));
  assert.ok(src.includes('requireAdmin'));
});

test('[id].ts exports PUT and DELETE and calls requireAdmin', () => {
  const src = readFileSync(new URL('../../src/api/notifications/templates/[id].ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('export const PUT'));
  assert.ok(src.includes('export const DELETE'));
  assert.ok(src.includes('requireAdmin'));
});
