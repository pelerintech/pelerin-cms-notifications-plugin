/**
 * SendGrid notification provider.
 *
 * Uses SendGrid v3 Mail Send API.
 * Auto-registers with the provider registry on import.
 */

import { registerProvider } from './registry.mjs';

/**
 * Resolve provider settings (API key).
 * In production, this reads from the encrypted settings table.
 * @param {string} key
 * @returns {string|undefined}
 */
function getSetting(key) {
  // TODO: Read from notification_settings table with decryption
  // For now, check environment variable as fallback
  const envKey = key.toUpperCase().replace(/_/g, '_');
  return process.env[envKey];
}

const sendgridProvider = {
  name: 'sendgrid',
  channels: ['email'],

  getConfigSchema() {
    return {
      requiredKeys: ['sendgrid_api_key'],
      fields: {
        sendgrid_api_key: {
          type: 'password',
          label: 'API Key',
          description: 'Your SendGrid API key from https://app.sendgrid.com/settings/api_keys',
        },
      },
    };
  },

  async send(params) {
    const apiKey = getSetting('sendgrid_api_key');
    if (!apiKey) {
      return { success: false, error: 'SendGrid API key not configured' };
    }

    const emailData = {
      personalizations: [
        {
          to: params.to.map((email) => ({ email })),
          ...(params.cc?.length && { cc: params.cc.map((email) => ({ email }) ) }),
          ...(params.bcc?.length && { bcc: params.bcc.map((email) => ({ email }) ) }),
        },
      ],
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'notifications@example.com' },
      subject: params.subject,
      content: [
        ...(params.bodyHtml
          ? [{ type: 'text/html', value: params.bodyHtml }]
          : []),
        ...(params.bodyText
          ? [{ type: 'text/plain', value: params.bodyText }]
          : []),
      ],
    };

    // If no content at all, send empty plain text
    if (emailData.content.length === 0) {
      emailData.content.push({ type: 'text/plain', value: '' });
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `SendGrid API error (${response.status}): ${errorBody}` };
      }

      const messageId = response.headers.get('x-message-id');
      return { success: true, messageId };
    } catch (err) {
      return { success: false, error: `SendGrid request failed: ${err.message}` };
    }
  },
};

registerProvider(sendgridProvider);

export { sendgridProvider as sendgrid };
