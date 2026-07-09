/**
 * Provider-configuration data accessor.
 *
 * Bridges the data-access layer (`settings.ts`) and the provider layer
 * (`providers/registry.ts`). Kept in a separate file from `settings.ts`
 * because `settings.ts` is a pure key-value accessor with no knowledge of the
 * provider registry; `isProviderConfigured` imports the registry, which is a
 * different concern.
 *
 * "Configured" means **ready to actually send** — ALL keys in the provider's
 * `getConfigSchema().requiredKeys` are present AND non-empty after
 * `decryptIfNeeded`. This is the shared definition reused by the rule-editor
 * dropdown, the create/update guardrail, the rules-list warning badge, and the
 * providers-page card badges.
 */
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getProvider } from '../../providers/registry.ts';
import { getSetting } from './settings.ts';
import { decryptIfNeeded } from '../crypto.ts';

/**
 * Returns true only when the named provider is registered, is not `local`, has
 * at least one required key, and every required key is present in the settings
 * table with a non-empty (decrypted, trimmed) value.
 *
 * `local` returns false by design (dev-mode-only, never a selectable provider
 * target); the explicit check documents intent and is defensive against a
 * future `local` config-schema change.
 */
export async function isProviderConfigured(
  db: LibSQLDatabase,
  providerName: string
): Promise<boolean> {
  const provider = getProvider(providerName);
  if (!provider) return false;
  if (provider.name === 'local') return false;

  const required = provider.getConfigSchema().requiredKeys;
  if (required.length === 0) return false;

  for (const key of required) {
    const raw = await getSetting(db, key);
    if (!raw) return false;
    const val = decryptIfNeeded(raw);
    if (!val || val.trim() === '') return false;
  }
  return true;
}
