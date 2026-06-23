/**
 * SendGrid notification provider.
 *
 * Uses SendGrid v3 Mail Send API.
 * Auto-registers with the provider registry on import.
 */
import { registerProvider } from './registry.ts';
import type { NotificationProvider, SendParams, SendResult, ProviderConfigSchema } from './interface.ts';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getSetting } from '../lib/data/settings.ts';
import { decryptIfNeeded } from '../lib/crypto.ts';

/** Resolve a provider setting from the settings table, decrypting if needed. */
async function getSettingDecrypted(db: LibSQLDatabase, key: string): Promise<string | undefined> {
  const raw = await getSetting(db, key);
  return raw ? decryptIfNeeded(raw) : undefined;
}

export const sendgridProvider: NotificationProvider = {
  name: 'sendgrid',
  channels: ['email'],

  getConfigSchema(): ProviderConfigSchema {
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

  async send(params: SendParams, db: LibSQLDatabase): Promise<SendResult> {
    const apiKey = await getSettingDecrypted(db, 'sendgrid_api_key');
    if (!apiKey) {
      return { success: false, error: 'SendGrid API key not configured' };
    }

    const emailData = {
      personalizations: [
        {
          to: params.to.map((email: string) => ({ email })),
          ...(params.cc?.length && { cc: params.cc.map((email: string) => ({ email })) }),
          ...(params.bcc?.length && { bcc: params.bcc.map((email: string) => ({ email })) }),
        },
      ],
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'notifications@example.com' },
      subject: params.subject,
      content: [
        ...(params.bodyHtml ? [{ type: 'text/html', value: params.bodyHtml }] : []),
        ...(params.bodyText ? [{ type: 'text/plain', value: params.bodyText }] : []),
      ],
    };

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
      return { success: true, messageId: messageId || undefined };
    } catch (err: any) {
      return { success: false, error: `SendGrid request failed: ${err.message}` };
    }
  },
};

registerProvider(sendgridProvider);

export { sendgridProvider as sendgrid };
