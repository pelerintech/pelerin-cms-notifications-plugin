/**
 * Pure Drizzle schema for the pelerin_notifications plugin.
 *
 * This module is the forward-looking schema definition. It mirrors `./config.ts`
 * (which uses astro:db's defineTable for the CMS build) column-for-column.
 * Data accessors in `src/lib/data/` import table objects FROM THIS FILE, not from
 * `astro:db`, so they are importable and executable in the real-SQLite test harness
 * outside the Astro build.
 *
 * A parity test (`tests/db/schema-parity.test.ts`) guards drift between this file
 * and `config.ts`. When the future @astrojs/db → pure-Drizzle CMS migration lands,
 * `config.ts` is deleted and this file becomes the sole schema definition.
 *
 * Type mapping (astro:db → drizzle-orm/sqlite-core):
 *   column.text()                    → text().notNull()
 *   column.text({ optional: true })  → text()
 *   column.number()                  → integer().notNull()
 *   column.number({ optional })      → integer()
 *   column.boolean()                 → integer({ mode: 'boolean' }).notNull()
 *   column.boolean({ optional })     → integer({ mode: 'boolean' })
 *   column.date(...)                 → dateType()[.notNull()]  (TEXT ISO, matches astro:db)
 */
import { sqliteTable, text, integer, customType } from 'drizzle-orm/sqlite-core';

/**
 * Date column type mirroring astro:db's date customType exactly:
 * stored as TEXT (ISO 8601 string), converted to/from Date via toISOString / new Date.
 * This must match astro:db's `dateType` so that accessors using these table objects
 * read/write the same representation in the prod (astro:db-merged) database and in
 * the test harness.
 */
const dateType = customType<{
  data: Date;
  driverData: string;
}>({
  dataType() {
    return 'text';
  },
  toDriver(value: Date) {
    return value.toISOString();
  },
  fromDriver(value: string): Date {
    if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(value)) {
      value += 'Z';
    }
    return new Date(value);
  },
});

/**
 * Notification rules — maps event patterns to templates and providers.
 * Unique constraint on (event_pattern, template_id, provider_name).
 */
export const notification_rules = sqliteTable('notification_rules', {
  id: text('id').primaryKey(),
  event_pattern: text('event_pattern').notNull(),
  template_id: text('template_id').notNull(),
  provider_name: text('provider_name').notNull(),
  channel: text('channel').notNull().default('email'),
  to: text('to').notNull(),
  cc: text('cc'),
  bcc: text('bcc'),
  active: integer('active', { mode: 'boolean' }).notNull(),
  created_at: dateType('created_at').notNull(),
  updated_at: dateType('updated_at'),
});

/**
 * Notification templates — subject and body content with {{ }} interpolation.
 */
export const notification_templates = sqliteTable('notification_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  body_html: text('body_html'),
  body_text: text('body_text'),
  created_at: dateType('created_at').notNull(),
  updated_at: dateType('updated_at'),
});

/**
 * Notification logs — audit trail of every dispatch attempt.
 * Records success/failure with full message content.
 */
export const notification_logs = sqliteTable('notification_logs', {
  id: text('id').primaryKey(),
  event_name: text('event_name').notNull(),
  rule_id: text('rule_id').notNull(),
  provider_name: text('provider_name').notNull(),
  to: text('to').notNull(),
  cc: text('cc'),
  bcc: text('bcc'),
  subject: text('subject').notNull(),
  body_html: text('body_html'),
  body_text: text('body_text'),
  success: integer('success', { mode: 'boolean' }).notNull(),
  error: text('error'),
  message_id: text('message_id'),
  created_at: dateType('created_at').notNull(),
});

/**
 * Plugin settings — encrypted key/value pairs for provider credentials.
 */
export const notification_settings = sqliteTable('notification_settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  created_at: dateType('created_at').notNull(),
});

// All tables are exported via their `export const` declarations above.
