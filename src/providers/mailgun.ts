/**
 * Mailgun notification provider.
 *
 * Uses Mailgun v3 API (POST /messages).
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

export const mailgunProvider: NotificationProvider = {
  name: 'mailgun',
  channels: ['email'],

  getConfigSchema(): ProviderConfigSchema {
    return {
      requiredKeys: ['mailgun_url', 'mailgun_api_key'],
      fields: {
        mailgun_url: {
          type: 'text',
          label: 'API URL',
          description: 'Mailgun API base URL (e.g., https://api.mailgun.net/v3/your-domain.com)',
        },
        mailgun_api_key: {
          type: 'password',
          label: 'API Key',
          description: 'Your Mailgun private API key',
        },
      },
    };
  },

  async send(params: SendParams, db: LibSQLDatabase): Promise<SendResult> {
    const apiUrl = await getSettingDecrypted(db, 'mailgun_url');
    const apiKey = await getSettingDecrypted(db, 'mailgun_api_key');

    if (!apiKey) {
      return { success: false, error: 'Mailgun API key not configured' };
    }
    if (!apiUrl) {
      return { success: false, error: 'Mailgun API URL not configured' };
    }

    const formData = new URLSearchParams();
    formData.append('from', process.env.MAILGUN_FROM_EMAIL || 'notifications@example.com');
    formData.append('to', params.to.join(','));
    formData.append('subject', params.subject);
    if (params.cc?.length) {
      formData.append('cc', params.cc.join(','));
    }
    if (params.bcc?.length) {
      formData.append('bcc', params.bcc.join(','));
    }
    if (params.bodyHtml) {
      formData.append('html', params.bodyHtml);
    }
    if (params.bodyText) {
      formData.append('text', params.bodyText);
    }

    try {
      const response = await fetch(`${apiUrl}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `Mailgun API error (${response.status}): ${errorBody}` };
      }

      const data = (await response.json()) as { id?: string };
      const messageId = data.id;
      return { success: true, messageId };
    } catch (err: any) {
      return { success: false, error: `Mailgun request failed: ${err.message}` };
    }
  },
};

registerProvider(mailgunProvider);

export { mailgunProvider as mailgun };
