/**
 * Brevo notification provider.
 *
 * Uses Brevo (formerly Sendinblue) v3 SMTP API.
 * Auto-registers with the provider registry on import.
 */
import { registerProvider } from './registry.ts';
import type {
  NotificationProvider,
  SendParams,
  SendResult,
  ProviderConfigSchema,
} from './interface.ts';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getSetting } from '../lib/data/settings.ts';
import { decryptIfNeeded } from '../lib/crypto.ts';

/** Resolve a provider setting from the settings table, decrypting if needed. */
async function getSettingDecrypted(db: LibSQLDatabase, key: string): Promise<string | undefined> {
  const raw = await getSetting(db, key);
  return raw ? decryptIfNeeded(raw) : undefined;
}

export const brevoProvider: NotificationProvider = {
  name: 'brevo',
  channels: ['email'],

  getConfigSchema(): ProviderConfigSchema {
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

  async send(params: SendParams, db: LibSQLDatabase): Promise<SendResult> {
    const apiKey = await getSettingDecrypted(db, 'brevo_api_key');
    if (!apiKey) {
      return { success: false, error: 'Brevo API key not configured' };
    }

    const apiUrl = await getSettingDecrypted(db, 'brevo_api_url');
    if (!apiUrl) {
      return { success: false, error: 'Brevo API URL not configured' };
    }

    const emailData = {
      to: params.to.map((email: string) => ({ email })),
      from: { email: process.env.BREVO_FROM_EMAIL || 'notifications@example.com' },
      subject: params.subject,
      htmlContent: params.bodyHtml,
      textContent: params.bodyText,
      ...(params.cc?.length && { cc: params.cc.map((email: string) => ({ email })) }),
      ...(params.bcc?.length && { bcc: params.bcc.map((email: string) => ({ email })) }),
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

      const data = (await response.json()) as { messageId?: string; message_id?: string };
      return { success: true, messageId: data.messageId || data.message_id || undefined };
    } catch (err: any) {
      return { success: false, error: `Brevo request failed: ${err.message}` };
    }
  },
};

registerProvider(brevoProvider);

export { brevoProvider as brevo };
