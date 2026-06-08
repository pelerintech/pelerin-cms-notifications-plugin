import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Templates CRUD API', () => {
  it('exports POST handler for creating templates', async () => {
    const handler = await import('../../src/api/notifications/templates/create.mjs');
    assert.strictEqual(typeof handler.POST, 'function', 'POST handler must be exported');
  });

  it('exports PUT and DELETE handlers for template updates', async () => {
    const handler = await import('../../src/api/notifications/templates/[id].mjs');
    assert.strictEqual(typeof handler.PUT, 'function', 'PUT handler must be exported');
    assert.strictEqual(typeof handler.DELETE, 'function', 'DELETE handler must be exported');
  });

  it('POST validates required fields', async () => {
    const handler = await import('../../src/api/notifications/templates/create.mjs');
    const mockRequest = new Request('http://localhost/api/plugins/notifications/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mockContext = { params: {}, request: mockRequest };

    const response = await handler.POST(mockContext);
    assert.ok(response.status === 400 || response.status === 422, 'should reject missing fields');
  });

  it('DELETE of unreferenced template succeeds', async () => {
    const handler = await import('../../src/api/notifications/templates/[id].mjs');
    const mockContext = { params: { id: 'tpl-nonexistent' } };
    const mockRequest = { method: 'DELETE' };
    mockContext.request = mockRequest;

    const response = await handler.DELETE(mockContext);
    assert.ok(response.status === 200 || response.status === 404, 'should return 200 or 404');
  });
});
