import { describe, it } from 'node:test';
import assert from 'node:assert';
import { interpolate } from '../src/lib/interpolation.ts';

describe('Template interpolation', () => {
  it('interpolate simple field', () => {
    assert.strictEqual(
      interpolate('Hi {{ name }}', { name: 'John' }),
      'Hi John',
      'should replace simple field',
    );
  });

  it('interpolate nested field', () => {
    assert.strictEqual(
      interpolate('Order {{ order.number }}', { order: { number: '123' } }),
      'Order 123',
      'should replace nested field',
    );
  });

  it('interpolate missing field returns empty string', () => {
    assert.strictEqual(
      interpolate('Hello {{ missing }}', {}),
      'Hello ',
      'should replace missing field with empty string',
    );
  });

  it('interpolate deeply nested field', () => {
    assert.strictEqual(
      interpolate('{{ a.b.c }}', { a: { b: { c: 'deep' } } }),
      'deep',
      'should resolve deeply nested path',
    );
  });
});
