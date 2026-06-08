import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Event pattern matcher', () => {
  let matches;

  it('exact match', async () => {
    const mod = await import('../src/lib/matcher.mjs');
    matches = mod.matches;
    assert.strictEqual(
      matches('shop.order.created', 'shop.order.created'),
      true,
      'exact match should return true',
    );
  });

  it('prefix wildcard match', async () => {
    assert.strictEqual(
      matches('shop.*', 'shop.order.created'),
      true,
      'prefix wildcard should match',
    );
  });

  it('prefix wildcard no match', async () => {
    assert.strictEqual(
      matches('shop.*', 'pelerin-cms.item.created'),
      false,
      'prefix wildcard should not match different prefix',
    );
  });

  it('global wildcard match', async () => {
    assert.strictEqual(
      matches('*', 'anything'),
      true,
      'global wildcard should match everything',
    );
  });

  it('exact no match', async () => {
    assert.strictEqual(
      matches('shop.order.created', 'shop.cart.added'),
      false,
      'exact match should not match different event',
    );
  });
});
