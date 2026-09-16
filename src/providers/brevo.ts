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

/** Default send timeout (30s). Override via setSendTimeoutForTests(). */
export let SEND_TIMEOUT_MS = 30_000;

/**
 * Test seam: override the send timeout.
 * Call in test setup; restore (e.g. back to 30_000) in teardown.
 */
export function setSendTimeoutForTests(ms: number): void {
  SEND_TIMEOUT_MS = ms;
}

export const brevoProvider: NotificationProvider = {
  name: 'brevo',
  channels: ['email'],

  getConfigSchema(): ProviderConfigSchema {
    return {
      requiredKeys: ['brevo_api_key', 'brevo_api_url', 'brevo_from_email'],
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
        brevo_from_email: {
          type: 'text',
          label: 'From Email',
          description: 'Sender address (must be a verified identity on this provider account)',
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

    const fromEmail = params.from ?? (await getSettingDecrypted(db, 'brevo_from_email'));
    if (!fromEmail) {
      return { success: false, error: 'Brevo from email not configured' };
    }

    const emailData = {
      to: params.to.map((email: string) => ({ email })),
      sender: { email: fromEmail },
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
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `Brevo API error (${response.status}): ${errorBody}` };
      }

      const data = (await response.json()) as { messageId?: string; message_id?: string };
      return { success: true, messageId: data.messageId || data.message_id || undefined };
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return { success: false, error: `Brevo send timed out after ${SEND_TIMEOUT_MS}ms` };
      }
      return { success: false, error: `Brevo request failed: ${err.message}` };
    }
  },
};

registerProvider(brevoProvider);

export { brevoProvider as brevo };
