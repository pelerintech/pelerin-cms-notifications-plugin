import { describe, it } from 'node:test';
import assert from 'node:assert';
import { interpolate } from '../src/lib/interpolation.ts';

describe('Template interpolation', () => {
  it('interpolate simple field', () => {
    assert.strictEqual(
      interpolate('Hi {{ name }}', { name: 'John' }),
      'Hi John',
      'should replace simple field'
    );
  });

  it('interpolate nested field', () => {
    assert.strictEqual(
      interpolate('Order {{ order.number }}', { order: { number: '123' } }),
      'Order 123',
      'should replace nested field'
    );
  });

  it('interpolate missing field returns empty string', () => {
    assert.strictEqual(
      interpolate('Hello {{ missing }}', {}),
      'Hello ',
      'should replace missing field with empty string'
    );
  });

  it('interpolate deeply nested field', () => {
    assert.strictEqual(
      interpolate('{{ a.b.c }}', { a: { b: { c: 'deep' } } }),
      'deep',
      'should resolve deeply nested path'
    );
  });

  // ─── HTML escaping scenarios ───────────────────────────────────────────

  it('HTML in payload value is escaped', () => {
    assert.strictEqual(
      interpolate('<p>{{ name }}</p>', { name: '<script>alert(1)</script>' }),
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
      'should escape HTML tags'
    );
  });

  it('ampersand in payload value is escaped', () => {
    assert.strictEqual(
      interpolate('{{ company }}', { company: 'Tom & Jerry' }),
      'Tom &amp; Jerry',
      'should escape ampersand'
    );
  });

  it('non-HTML payload values are unaffected', () => {
    assert.strictEqual(
      interpolate('Order {{ order_id }}', { order_id: '123' }),
      'Order 123',
      'should leave plain values unchanged'
    );
  });

  it('nested path values are HTML-escaped', () => {
    assert.strictEqual(
      interpolate('{{ user.name }}', { user: { name: '<b>X</b>' } }),
      '&lt;b&gt;X&lt;/b&gt;',
      'should escape nested values'
    );
  });

  it('missing fields still resolve to empty string', () => {
    assert.strictEqual(
      interpolate('Hello {{ missing }}', {}),
      'Hello ',
      'should replace missing field with empty string'
    );
  });
});
