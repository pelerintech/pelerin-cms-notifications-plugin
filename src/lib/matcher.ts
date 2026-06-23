/**
 * Event pattern matcher.
 *
 * Supports:
 * - Exact match: "shop.order.created" matches "shop.order.created"
 * - Prefix wildcard: "shop.*" matches "shop.order.created", "shop.cart.added"
 * - Global wildcard: "*" matches everything
 */

/**
 * Check if an event name matches a pattern.
 */
export function matches(pattern: string, event: string): boolean {
  if (pattern === '*') {
    return true;
  }
  if (pattern === event) {
    return true;
  }
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2); // Remove .*
    return event.startsWith(prefix + '.');
  }
  return false;
}
