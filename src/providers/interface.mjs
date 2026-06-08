/**
 * Notification provider interface.
 *
 * Every provider must implement these methods and properties.
 * See design.md for the full provider registry pattern.
 */

/**
 * @typedef {Object} SendParams
 * @property {string[]} to
 * @property {string[]} [cc]
 * @property {string[]} [bcc]
 * @property {string} subject
 * @property {string} [bodyHtml]
 * @property {string} [bodyText]
 */

/**
 * @typedef {Object} SendResult
 * @property {boolean} success
 * @property {string} [messageId]
 * @property {string} [error]
 */

/**
 * @typedef {Object} ProviderConfigSchema
 * @property {string[]} requiredKeys
 * @property {Object<string, {type: string, label: string, description: string}>} [fields]
 */

/**
 * @typedef {Object} NotificationProvider
 * @property {string} name - Unique provider identifier (e.g., "sendgrid")
 * @property {string[]} channels - Supported channels (e.g., ["email"])
 * @property {function(): ProviderConfigSchema} getConfigSchema - Return required config keys
 * @property {function(SendParams): Promise<SendResult>} send - Send a notification
 */
