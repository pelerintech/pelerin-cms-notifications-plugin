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
import { getProvider, listProviderObjects } from '../../providers/registry.ts';
import { getSetting, listSettingsForProvider } from './settings.ts';
import { decryptIfNeeded } from '../crypto.ts';

/** Mask a secret value to `****<last4>` (or `****` if length ≤ 4). */
function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}

/**
 * Get decrypted provider settings with password-type fields masked.
 * Returns a record of full setting keys → values (e.g. `sendgrid_api_key`).
 */
export async function getProviderSettings(
  db: LibSQLDatabase,
  providerName: string
): Promise<Record<string, string>> {
  const provider = getProvider(providerName);
  const fields = provider?.getConfigSchema().fields;
  const prefix = `${providerName}_`;
  const stored = await listSettingsForProvider(db, providerName);
  const data: Record<string, string> = {};
  for (const [strippedKey, rawValue] of Object.entries(stored)) {
    const fullKey = `${prefix}${strippedKey}`;
    const decrypted = decryptIfNeeded(rawValue);
    const fieldType = fields?.[fullKey]?.type;
    data[fullKey] = fieldType === 'password' ? maskValue(decrypted) : decrypted;
  }
  return data;
}

/** Info about an available provider for the rule-editor dropdown. */
export interface AvailableProviderInfo {
  name: string;
  channels: string[];
  configured: boolean;
}

/**
 * List providers for a channel, filtered by dev mode.
 * In production only configured providers are returned.
 * In dev mode all real providers are returned (with `configured` reported).
 * The local provider is always excluded.
 */
export async function listAvailableProvidersForChannel(
  db: LibSQLDatabase,
  channel: string,
  isDev: boolean
): Promise<AvailableProviderInfo[]> {
  const candidates = listProviderObjects().filter(
    (p) => p.name !== 'local' && p.channels.includes(channel)
  );
  const entries: AvailableProviderInfo[] = [];
  for (const p of candidates) {
    const configured = await isProviderConfigured(db, p.name);
    if (!isDev && !configured) continue;
    entries.push({ name: p.name, channels: p.channels, configured });
  }
  return entries;
}

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
