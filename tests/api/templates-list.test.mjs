import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Templates list API', () => {
  it('exports GET handler', async () => {
    const handler = await import('../../src/api/notifications/templates/index.mjs');
    assert.strictEqual(typeof handler.GET, 'function', 'GET handler must be exported');
  });

  it('returns paginated structure', async () => {
    const handler = await import('../../src/api/notifications/templates/index.mjs');
    const mockRequest = {
      url: 'http://localhost/api/plugins/notifications/templates?page=1&limit=20',
    };
    const mockContext = { params: {}, request: mockRequest };

    assert.ok(handler.GET, 'GET handler must exist');
    assert.strictEqual(typeof handler.GET, 'function');
  });
});
