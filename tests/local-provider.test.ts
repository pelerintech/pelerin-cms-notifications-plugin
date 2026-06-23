import { describe, it } from 'node:test';
import assert from 'node:assert';
import { localProvider } from '../src/providers/local.ts';

describe('Local provider', () => {
  it('exports localProvider', () => {
    assert.ok(localProvider, 'localProvider must be exported');
  });

  it('provider name is "local"', () => {
    assert.strictEqual(localProvider.name, 'local');
  });

  it('channels include "email"', () => {
    assert.ok(localProvider.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema returns empty requiredKeys', () => {
    const schema = localProvider.getConfigSchema();
    assert.deepStrictEqual(schema.requiredKeys, [], 'requiredKeys must be empty');
  });

  it('send resolves with success and local- messageId', async () => {
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
    const result = await localProvider.send({
      to: ['test@example.com'],
      subject: 'Test',
      bodyHtml: '<p>Test</p>',
    });
    assert.strictEqual(result.success, true, 'send must succeed without network');
  });
});
