/**
 * Provider registry — Map-based registry for notification providers.
 *
 * Mirrors the shop plugin's payment provider pattern.
 * Each provider module calls registerProvider() on import to auto-register.
 */

const providers = new Map();

/**
 * Register a notification provider.
 * @param {Object} provider - Provider implementing NotificationProvider interface
 * @throws {Error} If a provider with the same name is already registered
 */
export function registerProvider(provider) {
  if (!provider || typeof provider.name !== 'string') {
    throw new Error('Provider must have a name property');
  }
  if (providers.has(provider.name)) {
    throw new Error(`Provider "${provider.name}" is already registered`);
  }
  providers.set(provider.name, provider);
}

/**
 * Get a registered provider by name.
 * @param {string} name - Provider name (e.g., "sendgrid")
 * @returns {Object|null} Provider instance or null if not found
 */
export function getProvider(name) {
  return providers.get(name) || null;
}

/**
 * List all registered provider names.
 * @returns {string[]} Array of provider names
 */
export function listProviders() {
  return [...providers.keys()];
}
