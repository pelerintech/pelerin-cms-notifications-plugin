import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Provider registry', () => {
  it('exports registerProvider function', async () => {
    const registry = await import('../src/providers/registry.mjs');
    assert.strictEqual(typeof registry.registerProvider, 'function', 'registerProvider must be a function');
  });

  it('exports getProvider function', async () => {
    const registry = await import('../src/providers/registry.mjs');
    assert.strictEqual(typeof registry.getProvider, 'function', 'getProvider must be a function');
  });

  it('registered provider is retrievable', async () => {
    const registry = await import('../src/providers/registry.mjs');
    const { registerProvider, getProvider } = registry;

    const testProvider = {
      name: 'test',
      channels: ['email'],
      getConfigSchema: () => ({}),
      send: async () => ({}),
    };

    registerProvider(testProvider);
    const retrieved = getProvider('test');
    assert.ok(retrieved, 'Provider "test" must be retrievable');
    assert.strictEqual(retrieved.name, 'test');
  });

  it('duplicate registration throws', async () => {
    const registry = await import('../src/providers/registry.mjs');
    const { registerProvider } = registry;

    // "test" was already registered above, so registering again should throw
    assert.throws(() => {
      registerProvider({
        name: 'test',
        channels: ['email'],
        getConfigSchema: () => ({}),
        send: async () => ({}),
      });
    }, /already registered/i, 'Duplicate registration should throw');
  });
});
