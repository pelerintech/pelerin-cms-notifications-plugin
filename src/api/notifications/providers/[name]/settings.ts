/**
 * Provider settings API endpoint.
 *
 * POST /api/plugins/notifications/providers/[name]/settings — save encrypted credentials
 * GET  /api/plugins/notifications/providers/[name]/settings — retrieve (masked) values
 *
 * Uses real AES-256-GCM crypto (`src/lib/crypto.ts`) and the tested
 * `src/lib/data/settings.ts` accessor with injected `db`. Both GET and POST
 * are gated behind `requireAdmin`. Password-type fields (per the provider's
 * `getConfigSchema`) are masked in GET responses; POST skips empty values and
 * unchanged mask patterns (`****...`) so pre-filled secrets are not overwritten.
 *
 * Testable handler functions (`getSettingsHandler` / `saveSettingsHandler`)
 * receive `db` directly. The Astro wrappers dynamically import `astro:db` and
 * `pelerin:plugin-sdk` to keep the module importable in the Node test runner.
 */
import type { APIRoute } from 'astro';
import { encrypt, decryptIfNeeded } from '../../../../lib/crypto.ts';
import { getSetting, setSetting, listSettingsForProvider } from '../../../../lib/data/settings.ts';
import { getProvider } from '../../../../providers/registry.ts';
import '../../../../providers/index.ts'; // trigger provider auto-registration
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

/** Mask a secret value to `****<last4>` (or `****` if length ≤ 4). */
function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}

/**
 * GET handler — returns decrypted text fields and masked password fields for a
 * provider. Keys are the full setting keys (e.g. `sendgrid_api_key`).
 */
export async function getSettingsHandler(
  db: LibSQLDatabase,
  name: string,
): Promise<{ status: number; body: { data: Record<string, string>; provider: string } }> {
  const provider = getProvider(name);
  const fields = provider?.getConfigSchema().fields;

  // listSettingsForProvider strips the `${name}_` prefix; re-add it so the
  // response uses full setting keys (matching getConfigSchema field keys and
  // the admin UI form field names).
  const prefix = `${name}_`;
  const stored = await listSettingsForProvider(db, name);

  const data: Record<string, string> = {};
  for (const [strippedKey, rawValue] of Object.entries(stored)) {
    const fullKey = `${prefix}${strippedKey}`;
    const decrypted = decryptIfNeeded(rawValue);
    const fieldType = fields?.[fullKey]?.type;
    data[fullKey] = fieldType === 'password' ? maskValue(decrypted) : decrypted;
  }

  return { status: 200, body: { data, provider: name } };
}

/**
 * POST handler — encrypts and upserts each submitted value. Skips empty values
 * and unchanged mask patterns (`****...`) so pre-filled password fields don't
 * overwrite the stored secret. Values are stored at their full setting key.
 */
export async function saveSettingsHandler(
  db: LibSQLDatabase,
  name: string,
  body: Record<string, unknown>,
): Promise<{
  status: number;
  body: { data: { provider: string; saved: Record<string, boolean> }; message: string };
}> {
  const saved: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!value) continue; // skip empty
    if (typeof value === 'string' && /^\*{4}/.test(value)) continue; // unchanged mask
    const encrypted = encrypt(String(value));
    await setSetting(db, key, encrypted);
    saved[key] = true;
  }

  return {
    status: 200,
    body: {
      data: { provider: name, saved },
      message: 'Settings saved successfully',
    },
  };
}

export const GET: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  try {
    await sdk.auth.requireAdmin(context.request);
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = context.params.name;
  if (!name) {
    return new Response(JSON.stringify({ error: 'Provider name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { db } = await import('astro:db');
    const result = await getSettingsHandler(db, name);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  try {
    await sdk.auth.requireAdmin(context.request);
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = context.params.name;
  if (!name) {
    return new Response(JSON.stringify({ error: 'Provider name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await context.request.json();
    const { db } = await import('astro:db');
    const result = await saveSettingsHandler(db, name, body);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
