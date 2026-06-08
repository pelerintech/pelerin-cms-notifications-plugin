/**
 * Local notification provider.
 *
 * Logs payloads instead of sending real emails.
 * Used when NOTIFICATIONS_DEV_MODE=true.
 * Auto-registers with the provider registry on import.
 */

import { registerProvider } from './registry.mjs';

const localProvider = {
  name: 'local',
  channels: ['email'],

  getConfigSchema() {
    return { requiredKeys: [] };
  },

  async send(params) {
    // In dev mode, this provider is used instead of the real one.
    // It returns success without making any external calls.
    return { success: true, messageId: 'local-' + crypto.randomUUID() };
  },
};

registerProvider(localProvider);

export { localProvider };
