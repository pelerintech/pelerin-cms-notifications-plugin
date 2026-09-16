/**
 * SendGrid notification provider.
 *
 * Uses SendGrid v3 Mail Send API.
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

/** Default send timeout (30s). Override via setSendTimeoutForTests(). */
export let SEND_TIMEOUT_MS = 30_000;

/**
 * Test seam: override the send timeout.
 * Call in test setup; restore (e.g. back to 30_000) in teardown.
 */
export function setSendTimeoutForTests(ms: number): void {
  SEND_TIMEOUT_MS = ms;
}

export const sendgridProvider: NotificationProvider = {
  name: 'sendgrid',
  channels: ['email'],

  getConfigSchema(): ProviderConfigSchema {
    return {
      requiredKeys: ['sendgrid_api_key', 'sendgrid_from_email'],
      fields: {
        sendgrid_api_key: {
          type: 'password',
          label: 'API Key',
          description: 'Your SendGrid API key from https://app.sendgrid.com/settings/api_keys',
        },
        sendgrid_from_email: {
          type: 'text',
          label: 'From Email',
          description: 'Sender address (must be a verified identity on this provider account)',
        },
      },
    };
  },

  async send(params: SendParams, db: LibSQLDatabase): Promise<SendResult> {
    const apiKey = await getSettingDecrypted(db, 'sendgrid_api_key');
    if (!apiKey) {
      return { success: false, error: 'SendGrid API key not configured' };
    }

    const fromEmail = params.from ?? (await getSettingDecrypted(db, 'sendgrid_from_email'));
    if (!fromEmail) {
      return { success: false, error: 'SendGrid from email not configured' };
    }

    const emailData = {
      personalizations: [
        {
          to: params.to.map((email: string) => ({ email })),
          ...(params.cc?.length && { cc: params.cc.map((email: string) => ({ email })) }),
          ...(params.bcc?.length && { bcc: params.bcc.map((email: string) => ({ email })) }),
        },
      ],
      from: { email: fromEmail },
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
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(emailData),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `SendGrid API error (${response.status}): ${errorBody}` };
      }

      const messageId = response.headers.get('x-message-id');
      return { success: true, messageId: messageId || undefined };
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return { success: false, error: `SendGrid send timed out after ${SEND_TIMEOUT_MS}ms` };
      }
      return { success: false, error: `SendGrid request failed: ${err.message}` };
    }
  },
};

registerProvider(sendgridProvider);

export { sendgridProvider as sendgrid };
