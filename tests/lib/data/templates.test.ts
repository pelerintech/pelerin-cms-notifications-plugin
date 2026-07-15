import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDb, insertFixture, seedMinimal } from '../../db/harness.ts';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../../../src/lib/data/templates.ts';

test('listTemplates on empty db returns empty paginated result', async () => {
  const { db } = await createTestDb();
  const result = await listTemplates(db, { page: 1, limit: 20 });
  assert.deepStrictEqual(result.data, []);
  assert.strictEqual(result.total, 0);
});

test('listTemplates returns templates ordered by created_at desc', async () => {
  const { db } = await createTestDb();
  const older = new Date('2026-01-01T00:00:00.000Z');
  const newer = new Date('2026-06-01T00:00:00.000Z');
  await insertFixture(db, 'notification_templates', {
    id: 't1',
    name: 'Order Confirmation',
    subject: 's1',
    body_html: null,
    body_text: null,
    created_at: older,
  });
  await insertFixture(db, 'notification_templates', {
    id: 't2',
    name: 'Shipping Notice',
    subject: 's2',
    body_html: null,
    body_text: null,
    created_at: newer,
  });
  const result = await listTemplates(db, { page: 1, limit: 20 });
  assert.strictEqual(result.data.length, 2);
  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.data[0].id, 't2');
});

test('listTemplates with search filters by name', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't1',
    name: 'Order Confirmation',
    subject: 's1',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_templates', {
    id: 't2',
    name: 'Shipping Notice',
    subject: 's2',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  const result = await listTemplates(db, { page: 1, limit: 20, search: 'ship' });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.data[0].id, 't2');
});

test('listTemplates paginates', async () => {
  const { db } = await createTestDb();
  const now = new Date();
  await insertFixture(db, 'notification_templates', {
    id: 't1',
    name: 'A',
    subject: 's',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  await insertFixture(db, 'notification_templates', {
    id: 't2',
    name: 'B',
    subject: 's',
    body_html: null,
    body_text: null,
    created_at: now,
  });
  const result = await listTemplates(db, { page: 2, limit: 1 });
  assert.strictEqual(result.data.length, 1);
  assert.strictEqual(result.total, 2);
});

test('getTemplate returns the template for an existing id', async () => {
  const { db } = await createTestDb();
  const { templateId } = await seedMinimal(db);
  const tpl = await getTemplate(db, templateId);
  assert.ok(tpl);
  assert.strictEqual(tpl.subject, 'Order {{ order_id }}');
});

test('getTemplate returns null for a missing id', async () => {
  const { db } = await createTestDb();
  const tpl = await getTemplate(db, 'missing');
  assert.strictEqual(tpl, null);
});

test('createTemplate inserts and returns with id and created_at', async () => {
  const { db } = await createTestDb();
  const tpl = await createTemplate(db, {
    name: 'Welcome',
    subject: 'Hi {{ name }}',
    body_html: '<p>Hi</p>',
  });
  assert.ok(tpl.id);
  assert.ok(tpl.created_at);
  const found = await getTemplate(db, tpl.id);
  assert.ok(found);
});

test('updateTemplate updates and returns with non-null updated_at', async () => {
  const { db } = await createTestDb();
  const { templateId } = await seedMinimal(db);
  const updated = await updateTemplate(db, templateId, { subject: 'New Subject' });
  assert.strictEqual(updated.subject, 'New Subject');
  assert.ok(updated.updated_at);
});

test('updateTemplate on missing id throws not_found', async () => {
  const { db } = await createTestDb();
  await assert.rejects(
    () => updateTemplate(db, 'missing', { subject: 'x' }),
    (err: any) => err.code === 'not_found'
  );
});

test('deleteTemplate removes the row', async () => {
  const { db } = await createTestDb();
  const { templateId } = await seedMinimal(db);
  await deleteTemplate(db, templateId);
  const found = await getTemplate(db, templateId);
  assert.strictEqual(found, null);
});
