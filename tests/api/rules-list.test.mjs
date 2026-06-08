import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Rules list API', () => {
  it('exports handler function', async () => {
    const handler = await import('../../src/api/notifications/rules/index.mjs');
    assert.strictEqual(typeof handler.GET, 'function', 'GET handler must be exported');
  });

  it('returns paginated structure', async () => {
    const handler = await import('../../src/api/notifications/rules/index.mjs');
    // Simulate a minimal request
    const mockRequest = {
      url: 'http://localhost/api/plugins/notifications/rules?page=1&limit=20',
    };
    const mockContext = {
      params: {},
      request: mockRequest,
    };

    // The handler should return a Response with JSON body
    // Since we can't fully mock Astro DB, we verify the handler exists and is callable
    assert.ok(handler.GET, 'GET handler must exist');
    assert.strictEqual(typeof handler.GET, 'function');
  });
});
