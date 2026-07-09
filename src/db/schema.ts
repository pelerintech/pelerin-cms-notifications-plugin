/**
 * Pure Drizzle schema for the pelerin_notifications plugin.
 *
 * This is the sole schema definition. The CMS loads it via the manifest's
 * `dbConfig` and merges the `sqliteTable` exports at build time.
 * Data accessors in `src/lib/data/` import table objects from this file,
 * so they are importable and executable in the real-SQLite test harness
 * outside the Astro build.
 */
import { sqliteTable, text, integer, customType } from 'drizzle-orm/sqlite-core';

/**
 * Date column type: stored as TEXT (ISO 8601 string), converted to/from
 * Date via toISOString / new Date. Used for all timestamp columns in the
 * notification plugin tables.
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
