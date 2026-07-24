/**
 * Tests for DB-level unique constraints.
 *
 * Verifies that:
 * - The (event_pattern, template_id, provider_name, channel) quadruple on
 *   notification_rules is enforced as unique.
 * - The key column on notification_settings is unique.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { createTestDb } from './harness.ts';
import { notification_rules, notification_settings } from '../../src/db/schema.ts';

describe('DB unique constraints', () => {
  test('notification_rules quadruple (event_pattern, template_id, provider_name, channel) is unique', async () => {
    const { db, cleanup } = await createTestDb();
    const now = new Date();

    // Insert first row
    await db.insert(notification_rules).values({
      id: crypto.randomUUID(),
      event_pattern: 'shop.order.created',
      template_id: 'tmpl-1',
      provider_name: 'sendgrid',
      channel: 'email',
      active: 1,
      to: 'admin@example.com',
      created_at: now,
      updated_at: now,
    });

    // First, prove that a DIFFERENT quadruple inserts fine
    await db.insert(notification_rules).values({
      id: crypto.randomUUID(),
      event_pattern: 'shop.order.created',
      template_id: 'tmpl-2', // different template → different quadruple
      provider_name: 'sendgrid',
      channel: 'email',
      active: 1,
      to: 'other@example.com',
      created_at: now,
      updated_at: now,
    });

    // Now attempt the SAME quadruple — this should throw once constraints exist
    const secondInsert = db.insert(notification_rules).values({
      id: crypto.randomUUID(),
      event_pattern: 'shop.order.created',
      template_id: 'tmpl-1',
      provider_name: 'sendgrid',
      channel: 'email',
      active: 1,
      to: 'duplicate@example.com',
      created_at: now,
      updated_at: now,
    });

    // RED state: the insert succeeds (no constraint exists yet)
    // If this does NOT throw, the test fails via assert.fail below
    try {
      await secondInsert;
      // We should never reach here WITH the constraint
      // Since we currently have NO constraint, this succeeds — RED state
      cleanup();
    } catch (err: any) {
      // Constraint exists — GREEN state
      cleanup();
      return;
    }

    // If we got here, the duplicate insert succeeded without error → NO CONSTRAINT EXISTS
    // This is the expected RED state — the test assertion
    assert.fail('UNIQUE CONSTRAINT MISSING: duplicate quadruple inserted without error');
  });

  test('notification_settings key is unique', async () => {
    const { db, cleanup } = await createTestDb();
    const now = new Date();

    // Insert first row
    await db.insert(notification_settings).values({
      id: crypto.randomUUID(),
      key: 'sendgrid_api_key',
      value: 'encrypted-v1',
      created_at: now,
      updated_at: now,
    });

    // Attempt to insert a second row with the same key
    // RED state: this succeeds (no unique constraint)
    const secondInsert = db.insert(notification_settings).values({
      id: crypto.randomUUID(),
      key: 'sendgrid_api_key',
      value: 'encrypted-v2',
      created_at: now,
      updated_at: now,
    });

    try {
      await secondInsert;
      // No constraint → succeeds → falls through to assert.fail
      cleanup();
    } catch (err: any) {
      // Constraint exists — GREEN state
      cleanup();
      return;
    }

    assert.fail('UNIQUE CONSTRAINT MISSING: duplicate key inserted without error');
  });
});
