import { describe, it } from 'node:test';
import assert from 'node:assert';
import { findMatchingRules } from '../src/lib/rule-lookup.ts';

describe('Rule lookup', () => {
  it('finds all matching rules for an event', () => {
    const rules = [
      { id: 'r1', event_pattern: 'shop.*', active: true },
      { id: 'r2', event_pattern: 'shop.order.created', active: true },
      { id: 'r3', event_pattern: '*', active: true },
    ];

    const results = findMatchingRules(rules as any, 'shop.order.created');
    assert.strictEqual(results.length, 3, 'should match all three rules');
    // Most specific first: exact > prefix > global
    assert.strictEqual(results[0].id, 'r2', 'exact match should be first');
    assert.strictEqual(results[1].id, 'r1', 'prefix wildcard should be second');
    assert.strictEqual(results[2].id, 'r3', 'global wildcard should be last');
  });

  it('finds only global wildcard for unknown event', () => {
    const rules = [
      { id: 'r1', event_pattern: 'shop.*', active: true },
      { id: 'r2', event_pattern: 'shop.order.created', active: true },
      { id: 'r3', event_pattern: '*', active: true },
    ];

    const results = findMatchingRules(rules as any, 'unknown.event');
    assert.strictEqual(results.length, 1, 'should match only the global wildcard');
    assert.strictEqual(results[0].id, 'r3');
  });

  it('skips inactive rules', () => {
    const rules = [
      { id: 'r1', event_pattern: '*', active: false },
      { id: 'r2', event_pattern: '*', active: true },
    ];

    const results = findMatchingRules(rules as any, 'any.event');
    assert.strictEqual(results.length, 1, 'should skip inactive rules');
    assert.strictEqual(results[0].id, 'r2');
  });
});
