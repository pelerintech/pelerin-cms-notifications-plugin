/**
 * Provider settings API endpoint.
 *
 * POST /api/plugins/notifications/providers/[name]/settings — save encrypted credentials
 * GET  /api/plugins/notifications/providers/[name]/settings — retrieve (masked) values
 *
 * Uses real AES-256-GCM crypto (`src/lib/crypto.ts`) and the tested
 * `src/lib/data/settings.ts` accessor with injected `db`. Both GET and POST
 * are gated behind `requireAdmin` (now INSIDE the tested `runGet`/`runPost`).
 * Password-type fields (per the provider's `getConfigSchema`) are masked in
 * GET responses; POST skips empty values and unchanged mask patterns (`****...`)
 * so pre-filled secrets are not overwritten.
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam. The thin
 * wrappers construct deps from the real `astro:db` / `pelerin:plugin-sdk`
 * modules and delegate.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import { db } from 'astro:db';
import type { HandlerDeps } from '../../../../lib/handler-types';
import { encrypt, decryptIfNeeded } from '../../../../lib/crypto.ts';
import { getSetting, setSetting, listSettingsForProvider } from '../../../../lib/data/settings.ts';
import { getProvider } from '../../../../providers/registry.ts';
import '../../../../providers/index.ts'; // trigger provider auto-registration

export const GET: APIRoute = (context) =>
  runGet({ db, sdk: createPluginContext(), ctx: context });

export const POST: APIRoute = (context) =>
  runPost({ db, sdk: createPluginContext(), ctx: context });

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Mask a secret value to `****<last4>` (or `****` if length ≤ 4). */
function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}

export async function runGet({ db, sdk, ctx }: HandlerDeps): Promise<Response> {
  try {
    await sdk.auth.requireAdmin(ctx.request);
    const name = ctx.params.name;
    if (!name) {
      return json({ success: false, error: 'Provider name is required' }, 400);
    }

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

    return json({ success: true, data, provider: name }, 200);
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}

export async function runPost({ db, sdk, ctx }: HandlerDeps): Promise<Response> {
  try {
    await sdk.auth.requireAdmin(ctx.request);
    const name = ctx.params.name;
    if (!name) {
      return json({ success: false, error: 'Provider name is required' }, 400);
    }

    const body = await ctx.request.json();
    const saved: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!value) continue; // skip empty
      if (typeof value === 'string' && /^\*{4}/.test(value)) continue; // unchanged mask
      const encrypted = encrypt(String(value));
      await setSetting(db, key, encrypted);
      saved[key] = true;
    }

    return json(
      { success: true, data: { provider: name, saved }, message: 'Settings saved successfully' },
      200,
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
