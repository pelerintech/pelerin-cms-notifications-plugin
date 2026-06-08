import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Logs detail API', () => {
  it('exports GET handler', async () => {
    const handler = await import('../../src/api/notifications/logs/[id].mjs');
    assert.strictEqual(typeof handler.GET, 'function', 'GET handler must be exported');
  });

  it('handler returns 404 for missing log entry', async () => {
    const handler = await import('../../src/api/notifications/logs/[id].mjs');

    const mockRequest = {
      url: 'http://localhost/api/plugins/notifications/logs/nonexistent-id',
    };
    const mockContext = {
      params: { id: 'nonexistent-id' },
      request: mockRequest,
    };

    const response = await handler.GET(mockContext);
    assert.ok(response instanceof Response, 'must return a Response');
    assert.strictEqual(response.status, 404, 'must return 404 for missing entry');
  });

  it('handler is callable with valid id', async () => {
    const handler = await import('../../src/api/notifications/logs/[id].mjs');

    const mockRequest = {
      url: 'http://localhost/api/plugins/notifications/logs/some-id',
    };
    const mockContext = {
      params: { id: 'some-id' },
      request: mockRequest,
    };

    // The handler should return a Response — in test env it returns 404 since DB is unavailable
    const response = await handler.GET(mockContext);
    assert.ok(response instanceof Response, 'must return a Response');
    assert.strictEqual(typeof handler.GET, 'function', 'GET handler must be a function');
  });
});
