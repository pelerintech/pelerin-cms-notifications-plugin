import { defineDb, defineTable, column } from 'astro:db';

/**
 * Notification rules — maps event patterns to templates and providers.
 * Unique constraint on (event_pattern, template_id, provider_name).
 */
const notification_rules = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    event_pattern: column.text(),
    template_id: column.text(),
    provider_name: column.text(),
    to: column.text(),
    cc: column.text({ optional: true }),
    bcc: column.text({ optional: true }),
    active: column.boolean({ default: true }),
    created_at: column.date({ mode: 'timestamp' }),
    updated_at: column.date({ mode: 'timestamp', optional: true }),
  },
  uniqueConstraints: [
    { name: 'unique_rule', columns: ['event_pattern', 'template_id', 'provider_name'] },
  ],
});

/**
 * Notification templates — subject and body content with {{ }} interpolation.
 */
const notification_templates = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    subject: column.text(),
    body_html: column.text({ optional: true }),
    body_text: column.text({ optional: true }),
    created_at: column.date({ mode: 'timestamp' }),
    updated_at: column.date({ mode: 'timestamp', optional: true }),
  },
});

/**
 * Notification logs — audit trail of every dispatch attempt.
 * Records success/failure with full message content.
 */
const notification_logs = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    event_name: column.text(),
    rule_id: column.text(),
    provider_name: column.text(),
    to: column.text(),
    cc: column.text({ optional: true }),
    bcc: column.text({ optional: true }),
    subject: column.text(),
    body_html: column.text({ optional: true }),
    body_text: column.text({ optional: true }),
    success: column.boolean(),
    error: column.text({ optional: true }),
    message_id: column.text({ optional: true }),
    created_at: column.date({ mode: 'timestamp' }),
  },
});

/**
 * Plugin settings — encrypted key/value pairs for provider credentials.
 */
const notification_settings = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    key: column.text(),
    value: column.text(),
    created_at: column.date({ mode: 'timestamp' }),
  },
});

export {
  notification_rules,
  notification_templates,
  notification_logs,
  notification_settings,
};

export default defineDb({
  tables: {
    notification_rules,
    notification_templates,
    notification_logs,
    notification_settings,
  },
});
