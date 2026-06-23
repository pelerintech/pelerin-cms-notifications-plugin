/**
 * Provider registry — Map-based registry for notification providers.
 *
 * Mirrors the shop plugin's payment provider pattern.
 * Each provider module calls registerProvider() on import to auto-register.
 */
import type { NotificationProvider } from './interface.ts';

const providers = new Map<string, NotificationProvider>();

/** Register a notification provider. Throws if a provider with the same name is already registered. */
export function registerProvider(provider: NotificationProvider): void {
  if (!provider || typeof provider.name !== 'string') {
    throw new Error('Provider must have a name property');
  }
  if (providers.has(provider.name)) {
    throw new Error(`Provider "${provider.name}" is already registered`);
  }
  providers.set(provider.name, provider);
}

/** Get a registered provider by name, or null if not found. */
export function getProvider(name: string): NotificationProvider | null {
  return providers.get(name) || null;
}

/** List all registered provider names. */
export function listProviders(): string[] {
  return [...providers.keys()];
}
