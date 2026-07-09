import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

/**
 * Structural test: `seedMinimal` in the harness explicitly sets `channel` on
 * each seeded rule row, rather than silently relying on drizzle's
 * default-injection at INSERT time. This mirrors the existing convention where
 * `active: true` is set explicitly despite a config.ts default.
 *
 * The assertion is on the harness SOURCE so it can actually fail before the
 * ACTION (a behavior-level "rules have channel === email" check passes today
 * regardless, because drizzle injects the column default).
 */
const source = readFileSync(new URL('../db/harness.ts', import.meta.url), 'utf-8');

test('seedMinimal sets channel: "email" on seeded rule rows', () => {
  // Both seeded rule rows live inside a single db.insert(...).values([ {...}, {...} ])
  // call in seedMinimal. Assert the rules-insert block contains channel.
  const rulesBlock = source.slice(
    source.indexOf('await db.insert(notification_rules).values(['),
  );
  assert.ok(rulesBlock.length > 0, 'seedMinimal must insert notification_rules rows');
  assert.ok(
    /channel:\s*'email'/.test(rulesBlock),
    "seedMinimal's notification_rules insert must explicitly set channel: 'email'",
  );
});
