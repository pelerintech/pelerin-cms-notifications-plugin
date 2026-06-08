/**
 * Brevo notification provider.
 *
 * Uses Brevo (formerly Sendinblue) v3 SMTP API.
 * Auto-registers with the provider registry on import.
 */

import { registerProvider } from './registry.mjs';

/**
 * Resolve provider settings (API key, API URL).
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

const brevoProvider = {
  name: 'brevo',
  channels: ['email'],

  getConfigSchema() {
    return {
      requiredKeys: ['brevo_api_key', 'brevo_api_url'],
      fields: {
        brevo_api_key: {
          type: 'password',
          label: 'API Key',
          description: 'Your Brevo API key from https://account.brevo.com/api-keys',
        },
        brevo_api_url: {
          type: 'text',
          label: 'API URL',
          description: 'Brevo SMTP API endpoint',
          default: 'https://api.brevo.com/v3/smtp/email',
        },
      },
    };
  },

  async send(params) {
    const apiKey = getSetting('brevo_api_key');
    if (!apiKey) {
      return { success: false, error: 'Brevo API key not configured' };
    }

    const apiUrl = getSetting('brevo_api_url');
    if (!apiUrl) {
      return { success: false, error: 'Brevo API URL not configured' };
    }

    const emailData = {
      to: params.to.map((email) => ({ email })),
      from: { email: process.env.BREVO_FROM_EMAIL || 'notifications@example.com' },
      subject: params.subject,
      htmlContent: params.bodyHtml,
      textContent: params.bodyText,
      ...(params.cc?.length && { cc: params.cc.map((email) => ({ email })) }),
      ...(params.bcc?.length && { bcc: params.bcc.map((email) => ({ email })) }),
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `Brevo API error (${response.status}): ${errorBody}` };
      }

      const data = await response.json();
      return { success: true, messageId: data.messageId || data.message_id || undefined };
    } catch (err) {
      return { success: false, error: `Brevo request failed: ${err.message}` };
    }
  },
};

registerProvider(brevoProvider);

export { brevoProvider as brevo };
