import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Template interpolation', () => {
  let interpolate;

  it('interpolate simple field', async () => {
    const mod = await import('../src/lib/interpolation.mjs');
    interpolate = mod.interpolate;
    assert.strictEqual(
      interpolate('Hi {{ name }}', { name: 'John' }),
      'Hi John',
      'should replace simple field',
    );
  });

  it('interpolate nested field', async () => {
    assert.strictEqual(
      interpolate('Order {{ order.number }}', { order: { number: '123' } }),
      'Order 123',
      'should replace nested field',
    );
  });

  it('interpolate missing field returns empty string', async () => {
    assert.strictEqual(
      interpolate('Hello {{ missing }}', {}),
      'Hello ',
      'should replace missing field with empty string',
    );
  });

  it('interpolate deeply nested field', async () => {
    assert.strictEqual(
      interpolate('{{ a.b.c }}', { a: { b: { c: 'deep' } } }),
      'deep',
      'should resolve deeply nested path',
    );
  });
});
