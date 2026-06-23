/**
 * Local notification provider.
 *
 * Logs payloads instead of sending real emails.
 * Used when NOTIFICATIONS_DEV_MODE=true.
 * Auto-registers with the provider registry on import.
 */
import { registerProvider } from './registry.ts';
import type { NotificationProvider, SendParams, SendResult } from './interface.ts';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

export const localProvider: NotificationProvider = {
  name: 'local',
  channels: ['email'],

  getConfigSchema() {
    return { requiredKeys: [] };
  },

  async send(_params: SendParams, _db: LibSQLDatabase): Promise<SendResult> {
    // In dev mode, this provider is used instead of the real one.
    // It returns success without making any external calls.
    return { success: true, messageId: 'local-' + crypto.randomUUID() };
  },
};

registerProvider(localProvider);

export { localProvider as local };
