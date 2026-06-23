/**
 * SMTP notification provider.
 *
 * Uses nodemailer for SMTP sending.
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

export const smtpProvider: NotificationProvider = {
  name: 'smtp',
  channels: ['email'],

  getConfigSchema(): ProviderConfigSchema {
    return {
      requiredKeys: ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_tls'],
      fields: {
        smtp_host: {
          type: 'text',
          label: 'SMTP Host',
          description: 'SMTP server hostname (e.g., smtp.example.com)',
        },
        smtp_port: {
          type: 'number',
          label: 'SMTP Port',
          description: 'SMTP server port (e.g., 587 for STARTTLS, 465 for SSL)',
        },
        smtp_username: {
          type: 'text',
          label: 'Username',
          description: 'SMTP authentication username',
        },
        smtp_password: {
          type: 'password',
          label: 'Password',
          description: 'SMTP authentication password',
        },
        smtp_tls: {
          type: 'boolean',
          label: 'Use TLS',
          description: 'Enable TLS encryption for the connection',
        },
      },
    };
  },

  async send(params: SendParams, db: LibSQLDatabase): Promise<SendResult> {
    const host = await getSettingDecrypted(db, 'smtp_host');
    const portRaw = await getSettingDecrypted(db, 'smtp_port');
    const port = parseInt(portRaw || '587', 10);
    const username = await getSettingDecrypted(db, 'smtp_username');
    const password = await getSettingDecrypted(db, 'smtp_password');
    const tlsRaw = await getSettingDecrypted(db, 'smtp_tls');
    const useTls = tlsRaw === 'true';

    if (!host || !username || !password) {
      return { success: false, error: 'SMTP configuration incomplete' };
    }

    try {
      // Dynamic import of nodemailer — only loaded when SMTP is used
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        tls: useTls ? { rejectUnauthorized: true } : undefined,
        auth: {
          user: username,
          pass: password,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL || 'notifications@example.com',
        to: params.to.join(','),
        cc: params.cc?.join(','),
        bcc: params.bcc?.join(','),
        subject: params.subject,
        text: params.bodyText,
        html: params.bodyHtml,
      });

      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      return { success: false, error: `SMTP request failed: ${err.message}` };
    }
  },
};

registerProvider(smtpProvider);

export { smtpProvider as smtp };
