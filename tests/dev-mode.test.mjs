import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('Dev mode provider switching', () => {
  before(() => {
    process.env.NOTIFICATIONS_DEV_MODE = 'true';
  });

  after(() => {
    delete process.env.NOTIFICATIONS_DEV_MODE;
  });

  it('getProvider returns local provider', async () => {
    const { getProvider } = await import('../src/providers/registry.mjs');
    // Import all providers to trigger registration
    await import('../src/providers/index.mjs');

    const local = getProvider('local');
    assert.ok(local, 'local provider must be registered');
    assert.strictEqual(local.name, 'local');
  });

  it('getProviderForRule returns local when isDev is true', async () => {
    const { getProviderForRule } = await import('../src/lib/provider-selection.mjs');
    const { getProvider } = await import('../src/providers/registry.mjs');

    const rule = { provider_name: 'sendgrid' };
    const provider = getProviderForRule(rule, true);
    assert.ok(provider, 'provider must be returned');
    assert.strictEqual(provider.name, 'local', 'must return local provider when isDev is true');
  });

  it('getProviderForRule returns rule provider when isDev is false', async () => {
    const { getProviderForRule } = await import('../src/lib/provider-selection.mjs');
    const { getProvider } = await import('../src/providers/registry.mjs');

    const rule = { provider_name: 'sendgrid' };
    const provider = getProviderForRule(rule, false);
    assert.ok(provider, 'provider must be returned');
    assert.strictEqual(provider.name, 'sendgrid', 'must return rule provider when isDev is false');
  });
});
