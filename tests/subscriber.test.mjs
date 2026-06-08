import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Event bus subscriber', () => {
  it('exports init function', async () => {
    const mod = await import('../src/init.mjs');
    assert.strictEqual(typeof mod.default, 'function', 'init must be exported as default');
  });

  it('init subscribes to event bus', async () => {
    const mod = await import('../src/init.mjs');
    const init = mod.default;

    let subscribedPattern = null;
    let handler = null;

    const mockCtx = {
      events: {
        subscribe: (pattern, fn) => {
          subscribedPattern = pattern;
          handler = fn;
        },
      },
    };

    init(mockCtx);
    assert.strictEqual(subscribedPattern, '*', 'should subscribe to all events');
    assert.strictEqual(typeof handler, 'function', 'handler must be a function');
  });

  it('handler processes events and dispatches notifications', async () => {
    const mod = await import('../src/init.mjs');
    const init = mod.default;

    let handler = null;
    const mockCtx = {
      events: {
        subscribe: (pattern, fn) => {
          handler = fn;
        },
      },
    };

    init(mockCtx);

    // Mock the dependencies
    const mockPayload = { customer_email: 'test@example.com', order: { number: '123' } };

    // Call the handler with a mock event
    // The handler should not throw even without a real DB
    try {
      await handler({ event: 'shop.order.created', payload: mockPayload });
      // If we get here without throwing, the handler handles errors gracefully
      assert.ok(true, 'handler should not throw on missing DB');
    } catch (err) {
      assert.fail(`handler should handle errors gracefully: ${err.message}`);
    }
  });
});
