import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Logs list API', () => {
  it('exports GET handler', async () => {
    const handler = await import('../../src/api/notifications/logs/index.mjs');
    assert.strictEqual(typeof handler.GET, 'function', 'GET handler must be exported');
  });

  it('handler is callable with mock context', async () => {
    const handler = await import('../../src/api/notifications/logs/index.mjs');

    const mockRequest = {
      url: 'http://localhost/api/plugins/notifications/logs?page=1&pageSize=20',
    };
    const mockContext = {
      params: {},
      request: mockRequest,
    };

    const response = await handler.GET(mockContext);
    assert.ok(response instanceof Response, 'must return a Response');
    assert.strictEqual(response.status, 200, 'must return 200');

    const body = await response.json();
    assert.ok(Array.isArray(body.data), 'must return data array');
    assert.ok(typeof body.total === 'number', 'must return total count');
    assert.ok(typeof body.page === 'number', 'must return page number');
    assert.ok(typeof body.pageSize === 'number', 'must return pageSize');
  });

  it('handler supports filter query params', async () => {
    const handler = await import('../../src/api/notifications/logs/index.mjs');

    const mockRequest = {
      url: 'http://localhost/api/plugins/notifications/logs?provider=sendgrid&status=success&page=1&pageSize=10',
    };
    const mockContext = {
      params: {},
      request: mockRequest,
    };

    const response = await handler.GET(mockContext);
    assert.strictEqual(response.status, 200, 'must return 200 with filters');

    const body = await response.json();
    assert.strictEqual(body.pageSize, 10, 'must respect custom pageSize');
  });
});
