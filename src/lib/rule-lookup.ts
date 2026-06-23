/**
 * Rule lookup — find active rules matching an event, ordered by specificity.
 *
 * Specificity order (most specific first):
 * 1. Exact match (e.g., "shop.order.created")
 * 2. Prefix wildcard (e.g., "shop.*")
 * 3. Global wildcard (e.g., "*")
 */

import { matches } from './matcher.ts';

/** Compute specificity score for a pattern. Higher score = more specific. */
function specificity(pattern: string): number {
  if (pattern === '*') return 0;
  if (pattern.endsWith('.*')) return 1;
  return 2; // exact match
}

export interface RuleLike {
  id: string;
  event_pattern: string;
  active: boolean;
  [key: string]: unknown;
}

/** Find all active rules matching a given event, ordered by specificity. */
export function findMatchingRules<T extends RuleLike>(rules: T[], event: string): T[] {
  return rules
    .filter((rule) => rule.active && matches(rule.event_pattern, event))
    .sort((a, b) => specificity(b.event_pattern) - specificity(a.event_pattern));
}
