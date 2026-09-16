/**
 * SMTP notification provider.
 *
 * Uses nodemailer for SMTP sending.
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

/** Shape of the nodemailer transport config object. */
export interface TransportConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
  tls?: { rejectUnauthorized: boolean };
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}

/** Shape of the sendMail options. */
export interface SendMailOptions {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
}

/** Shape returned by a nodemailer transport. */
export interface NodemailerTransport {
  sendMail(opts: SendMailOptions): Promise<{ messageId: string }>;
}

/**
 * Test seam: override nodemailer transport creation.
 * Default: dynamic-import nodemailer and call createTransport.
 * Override via setTransportFactory() in tests to capture transport config.
 */
export let transportFactory: (config: TransportConfig) => Promise<NodemailerTransport> = async (
  config: TransportConfig
) => {
  const nodemailer = await import('nodemailer');
  return nodemailer.createTransport(config);
};

export function setTransportFactory(
  factory: (config: TransportConfig) => Promise<NodemailerTransport>
): void {
  transportFactory = factory;
}

export function resetTransportFactory(): void {
  transportFactory = async (config: TransportConfig) => {
    const nodemailer = await import('nodemailer');
    return nodemailer.createTransport(config);
  };
}

/** System-level connection error codes that indicate a send timeout. */
const CONNECTION_ERROR_CODES = new Set([
  'EDNS',
  'ESOCKET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ENETUNREACH',
  'ECONNRESET',
]);

export const smtpProvider: NotificationProvider = {
  name: 'smtp',
  channels: ['email'],

  getConfigSchema(): ProviderConfigSchema {
    return {
      requiredKeys: ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_email'],
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
        smtp_from_email: {
          type: 'text',
          label: 'From Email',
          description: 'Sender address (must be a verified identity on this provider account)',
        },
        smtp_tls: {
          type: 'boolean',
          label: 'Use TLS',
          description: 'Require TLS (reject unauthorized connections)',
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
      const transporter = await transportFactory({
        host,
        port,
        secure: port === 465,
        requireTLS: useTls || undefined,
        tls: useTls ? { rejectUnauthorized: true } : undefined,
        auth: {
          user: username,
          pass: password,
        },
        connectionTimeout: SEND_TIMEOUT_MS,
        greetingTimeout: SEND_TIMEOUT_MS,
        socketTimeout: SEND_TIMEOUT_MS,
      });

      const smtpFromEmail = params.from ?? (await getSettingDecrypted(db, 'smtp_from_email'));
      if (!smtpFromEmail) {
        return { success: false, error: 'SMTP from email not configured' };
      }

      const info = await transporter.sendMail({
        from: smtpFromEmail,
        to: params.to.join(','),
        cc: params.cc?.join(','),
        bcc: params.bcc?.join(','),
        subject: params.subject,
        text: params.bodyText,
        html: params.bodyHtml,
      });

      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      // Treat any system-level connection error as a send timeout
      if (CONNECTION_ERROR_CODES.has(err.code) || err.message?.toLowerCase().includes('timeout')) {
        return { success: false, error: `SMTP send timed out after ${SEND_TIMEOUT_MS}ms` };
      }
      return { success: false, error: `SMTP request failed: ${err.message}` };
    }
  },
};

registerProvider(smtpProvider);

export { smtpProvider as smtp };
