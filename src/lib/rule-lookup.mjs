/**
 * Rule lookup — find active rules matching an event, ordered by specificity.
 *
 * Specificity order (most specific first):
 * 1. Exact match (e.g., "shop.order.created")
 * 2. Prefix wildcard (e.g., "shop.*")
 * 3. Global wildcard (e.g., "*")
 */

import { matches } from './matcher.mjs';

/**
 * Compute specificity score for a pattern.
 * Higher score = more specific.
 * @param {string} pattern
 * @returns {number}
 */
function specificity(pattern) {
  if (pattern === '*') return 0;
  if (pattern.endsWith('.*')) return 1;
  return 2; // exact match
}

/**
 * Find all active rules matching a given event, ordered by specificity.
 * @param {Array<Object>} rules - Array of rule objects with event_pattern and active fields
 * @param {string} event - Event name to match against
 * @returns {Array<Object>} Matching rules, most specific first
 */
export function findMatchingRules(rules, event) {
  return rules
    .filter((rule) => rule.active && matches(rule.event_pattern, event))
    .sort((a, b) => specificity(b.event_pattern) - specificity(a.event_pattern));
}
