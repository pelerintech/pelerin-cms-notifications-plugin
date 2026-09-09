import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderTemplate, setCompileFn, resetCompileFn } from '../../src/lib/render.ts';

describe('renderTemplate', () => {
  it('interpolate simple field', () => {
    assert.strictEqual(renderTemplate('Hi {{ name }}', { name: 'John' }), 'Hi John');
  });

  it('interpolate nested field', () => {
    assert.strictEqual(
      renderTemplate('Order {{ order.number }}', { order: { number: '123' } }),
      'Order 123'
    );
  });

  it('interpolate deeply nested field', () => {
    assert.strictEqual(renderTemplate('{{ a.b.c }}', { a: { b: { c: 'deep' } } }), 'deep');
  });

  it('missing field resolves to empty string', () => {
    assert.strictEqual(renderTemplate('Hello {{ missing }}', {}), 'Hello ');
  });

  it('iterates over an array with each', () => {
    assert.strictEqual(
      renderTemplate('{{#each items}}{{product_name}}{{/each}}', {
        items: [{ product_name: 'A' }, { product_name: 'B' }],
      }),
      'AB'
    );
  });

  it('empty array renders nothing in the loop', () => {
    assert.strictEqual(renderTemplate('{{#each items}}X{{/each}}', { items: [] }), '');
  });

  it('resolves dot-path inside each against the item', () => {
    assert.strictEqual(
      renderTemplate('{{#each items}}{{sku}}:{{price_gross}}{{/each}}', {
        items: [{ sku: 'SKU1', price_gross: 100 }],
      }),
      'SKU1:100'
    );
  });

  it('renders true branch when pickup_location present', () => {
    assert.strictEqual(
      renderTemplate('{{#if data.order.metadata.pickup_location}}pickup{{else}}ship{{/if}}', {
        data: { order: { metadata: { pickup_location: { name: 'Store' } } } },
      }),
      'pickup'
    );
  });

  it('renders false branch when pickup_location absent', () => {
    assert.strictEqual(
      renderTemplate('{{#if data.order.metadata.pickup_location}}pickup{{else}}ship{{/if}}', {
        data: { order: { metadata: null } },
      }),
      'ship'
    );
  });

  it('nests access into pickup_location', () => {
    assert.strictEqual(
      renderTemplate('Pick up at {{ data.order.metadata.pickup_location.name }}', {
        data: { order: { metadata: { pickup_location: { name: 'Sediu' } } } },
      }),
      'Pick up at Sediu'
    );
  });

  it('escapes HTML in interpolated values', () => {
    const out = renderTemplate('{{ name }}', { name: '<script>alert(1)</script>' });
    assert.match(out, /&lt;script&gt;/);
    assert.ok(!out.includes('<script>'));
  });

  it('escapes ampersand in interpolated values', () => {
    assert.ok(
      renderTemplate('{{ company }}', { company: 'Tom & Jerry' }).includes('Tom &amp; Jerry')
    );
  });

  it('emits raw HTML with triple-stash', () => {
    assert.strictEqual(renderTemplate('{{{ html }}}', { html: '<b>bold</b>' }), '<b>bold</b>');
  });

  it('passes static HTML in template through', () => {
    assert.strictEqual(
      renderTemplate('<table><tr><td>{{ v }}</td></tr></table>', { v: 'x' }),
      '<table><tr><td>x</td></tr></table>'
    );
  });

  describe('formatMoney', () => {
    it('formats a number with currency code by default', () => {
      assert.strictEqual(
        renderTemplate('{{ formatMoney total currency }}', { total: 1250, currency: 'RON' }),
        '1.250,00 RON'
      );
    });

    it('formats with symbol for a known glyph', () => {
      assert.strictEqual(
        renderTemplate("{{ formatMoney total currency 'symbol' }}", {
          total: 1250,
          currency: 'EUR',
        }),
        '1.250,00 €'
      );
    });

    it('keeps 3-letter code when no distinct glyph (RON)', () => {
      assert.strictEqual(
        renderTemplate("{{ formatMoney total currency 'symbol' }}", {
          total: 1250,
          currency: 'RON',
        }),
        '1.250,00 RON'
      );
    });

    it('omits the currency with none', () => {
      assert.strictEqual(
        renderTemplate("{{ formatMoney total currency 'none' }}", { total: 1250, currency: 'RON' }),
        '1.250,00'
      );
    });
  });

  describe('compilation caching', () => {
    it('compiles a template once and reuses it', () => {
      let compiles = 0;
      setCompileFn(() => {
        compiles += 1;
        return () => 'rendered';
      });
      assert.strictEqual(renderTemplate('same', {}), 'rendered');
      assert.strictEqual(renderTemplate('same', {}), 'rendered');
      assert.strictEqual(compiles, 1, 'should compile the same template only once');
      resetCompileFn();
    });

    it('compiles distinct templates separately', () => {
      let compiles = 0;
      setCompileFn(() => {
        compiles += 1;
        return () => 'rendered';
      });
      renderTemplate('a', {});
      renderTemplate('b', {});
      assert.strictEqual(compiles, 2);
      resetCompileFn();
    });
  });

  it('blocks prototype-chain access (constructor)', () => {
    const out = renderTemplate('{{ constructor.name }}', {});
    assert.ok(!out.includes('Object'));
  });

  it('blocks prototype-chain access (__proto__)', () => {
    const out = renderTemplate('{{ __proto__ }}', {});
    assert.strictEqual(out, '');
  });

  it('unknown helper is a no-op (does not throw)', () => {
    assert.strictEqual(renderTemplate('{{ noSuchHelper x }}', { x: 'a' }), '');
  });

  it('unknown helper does not break the rest of the template', () => {
    assert.strictEqual(
      renderTemplate('Hello {{ noSuchHelper x }} world', { x: 'a' }),
      'Hello  world'
    );
  });

  describe('formatDate', () => {
    it('formats an ISO timestamp with a default format', () => {
      assert.strictEqual(
        renderTemplate('{{ formatDate created_at }}', { created_at: '2026-07-24T10:00:00.000Z' }),
        '24/07/2026'
      );
    });

    it('accepts a format parameter dd/MM/yy', () => {
      assert.strictEqual(
        renderTemplate("{{ formatDate created_at 'dd/MM/yy' }}", {
          created_at: '2026-07-24T10:00:00.000Z',
        }),
        '24/07/26'
      );
    });

    it('accepts a format parameter yyyy-MM-dd', () => {
      assert.strictEqual(
        renderTemplate("{{ formatDate created_at 'yyyy-MM-dd' }}", {
          created_at: '2026-07-24T10:00:00.000Z',
        }),
        '2026-07-24'
      );
    });
  });
});
