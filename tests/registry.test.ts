import { describe, it } from 'node:test';
import assert from 'node:assert';
import { registerProvider, getProvider } from '../src/providers/registry.ts';

describe('Provider registry', () => {
  it('exports registerProvider function', () => {
    assert.strictEqual(typeof registerProvider, 'function', 'registerProvider must be a function');
  });

  it('exports getProvider function', () => {
    assert.strictEqual(typeof getProvider, 'function', 'getProvider must be a function');
  });

  it('registered provider is retrievable', () => {
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

  it('duplicate registration throws', () => {
    assert.throws(
      () => {
        registerProvider({
          name: 'test',
          channels: ['email'],
          getConfigSchema: () => ({}),
          send: async () => ({}),
        });
      },
      /already registered/i,
      'Duplicate registration should throw'
    );
  });
});
