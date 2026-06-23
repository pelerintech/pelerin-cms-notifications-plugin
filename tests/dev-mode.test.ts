import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { getProvider } from '../src/providers/registry.ts';
import { getProviderForRule } from '../src/lib/provider-selection.ts';
import '../src/providers/index.ts';

describe('Dev mode provider switching', () => {
  before(() => {
    process.env.NOTIFICATIONS_DEV_MODE = 'true';
  });

  after(() => {
    delete process.env.NOTIFICATIONS_DEV_MODE;
  });

  it('getProvider returns local provider', () => {
    const local = getProvider('local');
    assert.ok(local, 'local provider must be registered');
    assert.strictEqual(local.name, 'local');
  });

  it('getProviderForRule returns local when isDev is true', () => {
    const rule = { provider_name: 'sendgrid' };
    const provider = getProviderForRule(rule as any, true);
    assert.ok(provider, 'provider must be returned');
    assert.strictEqual(provider.name, 'local', 'must return local provider when isDev is true');
  });

  it('getProviderForRule returns rule provider when isDev is false', () => {
    const rule = { provider_name: 'sendgrid' };
    const provider = getProviderForRule(rule as any, false);
    assert.ok(provider, 'provider must be returned');
    assert.strictEqual(provider.name, 'sendgrid', 'must return rule provider when isDev is false');
  });
});
