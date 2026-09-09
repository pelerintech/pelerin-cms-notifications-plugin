import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderRecipient, hasBlockSyntax } from '../../src/lib/render.ts';

describe('renderRecipient', () => {
  it('resolves a plain field to an address', () => {
    assert.strictEqual(
      renderRecipient('{{ data.order.customer_email }}', {
        data: { order: { customer_email: 'buyer@example.com' } },
      }),
      'buyer@example.com'
    );
  });

  it('resolves comma-separated plain fields', () => {
    assert.strictEqual(
      renderRecipient('{{ a }},{{ b }}', { a: 'x@y.com', b: 'z@y.com' }),
      'x@y.com,z@y.com'
    );
  });

  it('treats a literal address without {{ }} as-is', () => {
    assert.strictEqual(renderRecipient('admin@example.com', {}), 'admin@example.com');
  });

  it('rejects a recipient containing a block ({{#if}})', () => {
    assert.throws(() =>
      renderRecipient('{{#if data.order.metadata.pickup_location}}a@b.com{{/if}}', {})
    );
  });

  it('rejects a recipient containing {{#each}}', () => {
    assert.throws(() => renderRecipient('{{#each items}}{{email}},{{/each}}', { items: [] }));
  });

  it('rejects a recipient containing a helper call', () => {
    assert.throws(() => renderRecipient('{{ formatMoney x }}', { x: 1 }));
  });
});

describe('hasBlockSyntax', () => {
  it('detects block syntax in a recipient field', () => {
    assert.strictEqual(hasBlockSyntax('{{#if x}}a{{/if}}'), true);
    assert.strictEqual(hasBlockSyntax('{{#each x}}a{{/each}}'), true);
  });

  it('returns false for plain substitution', () => {
    assert.strictEqual(hasBlockSyntax('{{ x }}'), false);
    assert.strictEqual(hasBlockSyntax('literal@example.com'), false);
  });
});
