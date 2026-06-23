import { describe, it } from 'node:test';
import assert from 'node:assert';
import { matches } from '../src/lib/matcher.ts';

describe('Event pattern matcher', () => {
  it('exact match', () => {
    assert.strictEqual(
      matches('shop.order.created', 'shop.order.created'),
      true,
      'exact match should return true',
    );
  });

  it('prefix wildcard match', () => {
    assert.strictEqual(
      matches('shop.*', 'shop.order.created'),
      true,
      'prefix wildcard should match',
    );
  });

  it('prefix wildcard no match', () => {
    assert.strictEqual(
      matches('shop.*', 'pelerin-cms.item.created'),
      false,
      'prefix wildcard should not match different prefix',
    );
  });

  it('global wildcard match', () => {
    assert.strictEqual(
      matches('*', 'anything'),
      true,
      'global wildcard should match everything',
    );
  });

  it('exact no match', () => {
    assert.strictEqual(
      matches('shop.order.created', 'shop.cart.added'),
      false,
      'exact match should not match different event',
    );
  });
});
