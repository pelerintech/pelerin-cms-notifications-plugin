import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Provider settings API', () => {
  it('exports POST handler for saving settings', async () => {
    const handler = await import('../../src/api/notifications/providers/[name]/settings.mjs');
    assert.strictEqual(typeof handler.POST, 'function', 'POST handler must be exported');
  });

  it('exports GET handler for retrieving settings', async () => {
    const handler = await import('../../src/api/notifications/providers/[name]/settings.mjs');
    assert.strictEqual(typeof handler.GET, 'function', 'GET handler must be exported');
  });

  it('POST saves settings and returns 200', async () => {
    const handler = await import('../../src/api/notifications/providers/[name]/settings.mjs');
    const mockRequest = new Request('http://localhost/api/plugins/notifications/providers/sendgrid/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendgrid_api_key: 'SG.test123' }),
    });
    const mockContext = { params: { name: 'sendgrid' }, request: mockRequest };

    const response = await handler.POST(mockContext);
    assert.ok(response.status === 200 || response.status === 201, `expected 200/201, got ${response.status}`);
  });

  it('GET returns settings', async () => {
    const handler = await import('../../src/api/notifications/providers/[name]/settings.mjs');
    const mockRequest = new Request('http://localhost/api/plugins/notifications/providers/sendgrid/settings');
    const mockContext = { params: { name: 'sendgrid' }, request: mockRequest };

    const response = await handler.GET(mockContext);
    assert.ok(response.status === 200, `expected 200, got ${response.status}`);
  });
});
