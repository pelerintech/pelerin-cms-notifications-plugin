/**
 * Database schema for pelerin_notifications plugin.
 *
 * Table definitions using Astro DB schema conventions.
 * These exports are used by Astro DB migrations and runtime queries.
 */

/**
 * Notification rules — maps event patterns to templates and providers.
 * Unique constraint on (event_pattern, template_id, provider_name).
 */
export const notification_rules = {
  name: 'notification_rules',
  columns: {
    id: { type: 'text', primaryKey: true },
    event_pattern: { type: 'text' },
    template_id: { type: 'text' },
    provider_name: { type: 'text' },
    to: { type: 'text' },
    cc: { type: 'text', nullable: true },
    bcc: { type: 'text', nullable: true },
    active: { type: 'boolean', default: true },
    created_at: { type: 'date', mode: 'timestamp' },
    updated_at: { type: 'date', mode: 'timestamp', optional: true },
  },
  uniqueConstraints: [
    ['event_pattern', 'template_id', 'provider_name'],
  ],
};

/**
 * Notification templates — subject and body content with {{ }} interpolation.
 */
export const notification_templates = {
  name: 'notification_templates',
  columns: {
    id: { type: 'text', primaryKey: true },
    name: { type: 'text' },
    subject: { type: 'text' },
    body_html: { type: 'text', nullable: true },
    body_text: { type: 'text', nullable: true },
    created_at: { type: 'date', mode: 'timestamp' },
    updated_at: { type: 'date', mode: 'timestamp', optional: true },
  },
};

/**
 * Plugin settings — encrypted key/value pairs for provider credentials.
 */
/**
 * Notification logs — audit trail of every dispatch attempt.
 * Records success/failure with full message content.
 */
export const notification_logs = {
  name: 'notification_logs',
  columns: {
    id: { type: 'text', primaryKey: true },
    event_name: { type: 'text' },
    rule_id: { type: 'text' },
    provider_name: { type: 'text' },
    to: { type: 'text' },
    cc: { type: 'text', nullable: true },
    bcc: { type: 'text', nullable: true },
    subject: { type: 'text' },
    body_html: { type: 'text', nullable: true },
    body_text: { type: 'text', nullable: true },
    success: { type: 'boolean' },
    error: { type: 'text', nullable: true },
    message_id: { type: 'text', nullable: true },
    created_at: { type: 'date', mode: 'timestamp' },
  },
};

export const notification_settings = {
  name: 'notification_settings',
  columns: {
    id: { type: 'text', primaryKey: true },
    key: { type: 'text' },
    value: { type: 'text' },
    created_at: { type: 'date', mode: 'timestamp' },
  },
};
