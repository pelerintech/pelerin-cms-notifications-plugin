import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Local provider', () => {
  it('exports localProvider', async () => {
    const mod = await import('../src/providers/local.mjs');
    assert.ok(mod.localProvider, 'localProvider must be exported');
  });

  it('provider name is "local"', async () => {
    const { localProvider } = await import('../src/providers/local.mjs');
    assert.strictEqual(localProvider.name, 'local');
  });

  it('channels include "email"', async () => {
    const { localProvider } = await import('../src/providers/local.mjs');
    assert.ok(localProvider.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns empty requiredKeys', async () => {
    const { localProvider } = await import('../src/providers/local.mjs');
    const schema = localProvider.getConfigSchema();
    assert.deepStrictEqual(schema.requiredKeys, [], 'requiredKeys must be empty');
  });

  it('send resolves with success and local- messageId', async () => {
    const { localProvider } = await import('../src/providers/local.mjs');
    const result = await localProvider.send({
      to: ['test@example.com'],
      subject: 'Test',
      bodyHtml: '<p>Test</p>',
      bodyText: 'Test',
    });
    assert.strictEqual(result.success, true, 'send must return success: true');
    assert.ok(result.messageId, 'send must return a messageId');
    assert.ok(result.messageId.startsWith('local-'), 'messageId must start with "local-"');
  });

  it('no network request is made', async () => {
    const { localProvider } = await import('../src/providers/local.mjs');
    // If send() makes a network call, it would fail in this offline test environment.
    // The fact that it resolves means no network was attempted.
    const result = await localProvider.send({
      to: ['test@example.com'],
      subject: 'Test',
      bodyHtml: '<p>Test</p>',
    });
    assert.strictEqual(result.success, true, 'send must succeed without network');
  });
});
