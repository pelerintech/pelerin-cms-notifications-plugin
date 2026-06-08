import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Rules CRUD API', () => {
  it('exports POST handler for creating rules', async () => {
    const handler = await import('../../src/api/notifications/rules/create.mjs');
    assert.strictEqual(typeof handler.POST, 'function', 'POST handler must be exported');
  });

  it('exports PUT and DELETE handlers for rule updates', async () => {
    const handler = await import('../../src/api/notifications/rules/[id].mjs');
    assert.strictEqual(typeof handler.PUT, 'function', 'PUT handler must be exported');
    assert.strictEqual(typeof handler.DELETE, 'function', 'DELETE handler must be exported');
  });

  it('POST validates required fields', async () => {
    const handler = await import('../../src/api/notifications/rules/create.mjs');
    const mockRequest = new Request('http://localhost/api/plugins/notifications/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // Missing required fields
    });
    const mockContext = { params: {}, request: mockRequest };

    const response = await handler.POST(mockContext);
    assert.ok(response.status === 400 || response.status === 422, 'should reject missing fields');
  });

  it('POST returns 409 for duplicate rule', async () => {
    const handler = await import('../../src/api/notifications/rules/create.mjs');

    // First request — creates a rule
    const req1 = new Request('http://localhost/api/plugins/notifications/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_pattern: 'shop.order.created',
        template_id: 'tpl-1',
        provider_name: 'sendgrid',
        to: 'test@example.com',
      }),
    });
    const ctx1 = { params: {}, request: req1 };
    await handler.POST(ctx1);

    // Second request — same unique constraint
    const req2 = new Request('http://localhost/api/plugins/notifications/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_pattern: 'shop.order.created',
        template_id: 'tpl-1',
        provider_name: 'sendgrid',
        to: 'other@example.com',
      }),
    });
    const ctx2 = { params: {}, request: req2 };
    const response = await handler.POST(ctx2);
    assert.strictEqual(response.status, 409, 'duplicate should return 409');
  });
});
