/**
 * AWS SES notification provider.
 *
 * Sends real email via AWS SES using `@aws-sdk/client-ses` (`SendEmailCommand`).
 * The SDK is dynamically imported inside `send()` (lazy load) so it only loads
 * when SES actually dispatches — all 6 providers are auto-imported at plugin
 * startup, so a top-level import would load AWS for every start.
 *
 * The `SESClient` (the only thing that does I/O) is obtained via a module-level
 * factory (`sesClientFactory`). The default factory constructs a real
 * `SESClient`; tests substitute a fake via `setSesClientFactory()` because
 * `node:test` has no `mock.module` in Node 25. Auto-registers on import.
 *
 * Operational note: new SES accounts are in sandbox mode (send only to verified
 * addresses), and sender identities (the `ses_from_email` Source) must be
 * verified via DKIM/SPF or email confirmation. Production access requires an
 * AWS support request. These surface as SDK errors reported via
 * `{ success: false, error }`.
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

/** Minimal SES client shape — only `send` is used. */
interface SesClient {
  send(cmd: unknown): Promise<{ MessageId?: string }>;
}

/** Factory config — the decrypted SES credentials. */
interface SesClientConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** A factory that returns an SES client. The test seam. */
type SesClientFactory = (cfg: SesClientConfig) => Promise<SesClient> | SesClient;

/**
 * Default factory: dynamically imports `@aws-sdk/client-ses` and constructs a
 * real `SESClient` configured with the decrypted credentials. The SDK handles
 * SigV4 signing, region routing, retries, and response parsing internally.
 */
async function defaultFactory(cfg: SesClientConfig): Promise<SesClient> {
  const { SESClient } = await import('@aws-sdk/client-ses');
  return new SESClient({
    region: cfg.region,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

/** Module-level factory — replaceable in tests via `setSesClientFactory`. */
let sesClientFactory: SesClientFactory = defaultFactory;

/** Test seam: substitute the SES client. Call `resetSesClientFactory()` in teardown. */
export function setSesClientFactory(fn: SesClientFactory): void {
  sesClientFactory = fn;
}

/** Test seam: restore the default (real) SES client factory. */
export function resetSesClientFactory(): void {
  sesClientFactory = defaultFactory;
}

export const sesProvider: NotificationProvider = {
  name: 'ses',
  channels: ['email'],

  getConfigSchema(): ProviderConfigSchema {
    return {
      requiredKeys: ['ses_region', 'ses_access_key', 'ses_secret_key', 'ses_from_email'],
      fields: {
        ses_region: {
          type: 'text',
          label: 'AWS Region',
          description: 'AWS region (e.g., us-east-1, eu-west-1)',
        },
        ses_access_key: {
          type: 'password',
          label: 'Access Key',
          description: 'AWS access key ID with SES permissions',
        },
        ses_secret_key: {
          type: 'password',
          label: 'Secret Key',
          description: 'AWS secret access key',
        },
        ses_from_email: {
          type: 'text',
          label: 'From Email',
          description:
            'SES-verified sender email address (the Source). Must be a verified identity in your AWS SES account.',
          placeholder: 'verified@yourdomain.com',
        },
      },
    };
  },

  async send(params: SendParams, db: LibSQLDatabase): Promise<SendResult> {
    const region = await getSettingDecrypted(db, 'ses_region');
    const accessKey = await getSettingDecrypted(db, 'ses_access_key');
    const secretKey = await getSettingDecrypted(db, 'ses_secret_key');
    const fromEmail = await getSettingDecrypted(db, 'ses_from_email');

    if (!accessKey || !secretKey) {
      return { success: false, error: 'AWS SES credentials not configured' };
    }
    if (!region) {
      return { success: false, error: 'AWS SES region not configured' };
    }
    if (!fromEmail) {
      return { success: false, error: 'AWS SES from email not configured' };
    }

    try {
      const client = await sesClientFactory({
        region,
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      });
      const { SendEmailCommand } = await import('@aws-sdk/client-ses');
      const cmd = new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: params.to,
          ...(params.cc && params.cc.length > 0 && { CcAddresses: params.cc }),
          ...(params.bcc && params.bcc.length > 0 && { BccAddresses: params.bcc }),
        },
        Message: {
          Subject: { Data: params.subject },
          Body: {
            ...(params.bodyHtml && { Html: { Data: params.bodyHtml } }),
            ...(params.bodyText && { Text: { Data: params.bodyText } }),
          },
        },
      });
      const result = await client.send(cmd);
      return { success: true, messageId: result.MessageId };
    } catch (err: any) {
      return { success: false, error: `SES send failed: ${err.message}` };
    }
  },
};

registerProvider(sesProvider);

export { sesProvider as ses };
