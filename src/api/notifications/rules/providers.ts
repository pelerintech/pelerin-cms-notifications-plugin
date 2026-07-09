/**
 * Available-providers API endpoint (rule editor dropdown source).
 *
 * GET /api/plugins/notifications/rules/providers?channel=email
 *
 * Returns registry-derived providers filtered by channel (local excluded),
 * with `configured` computed for every entry. In production mode only fully
 * configured providers are returned; in dev mode all real providers for the
 * channel are returned (with `configured` still reported) so manual smoke
 * testing works with zero external credentials.
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam — auth, query
 * parsing, filtering, and Response construction all live inside the tested
 * `runGet`. The thin `GET` wrapper sources `db` from `createPluginContext().db`
 * and delegates.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import type { HandlerDeps } from '../../../lib/handler-types';
import { listProviderObjects } from '../../../providers/registry.ts';
import '../../../providers/index.ts'; // trigger provider auto-registration
import { isProviderConfigured } from '../../../lib/data/providers.ts';

export interface AvailableProviderEntry {
  name: string;
  channels: string[];
  configured: boolean;
}

export const GET: APIRoute = (context) => {
  const sdk = createPluginContext();
  return runGet({ db: sdk.db, sdk, ctx: context });
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function runGet({ db, sdk, ctx }: HandlerDeps): Promise<Response> {
  try {
    await sdk.auth.requireAdmin(ctx.request);
    const url = new URL(ctx.request.url);
    const channel = url.searchParams.get('channel') || 'email';
    const isDev = process.env.NOTIFICATIONS_DEV_MODE === 'true';

    const candidates = listProviderObjects().filter(
      (p) => p.name !== 'local' && p.channels.includes(channel),
    );

    const entries: AvailableProviderEntry[] = [];
    for (const p of candidates) {
      const configured = await isProviderConfigured(db, p.name);
      // In production, drop unconfigured providers from the selectable list.
      // In dev, keep them so manual smoke testing works with zero credentials.
      if (!isDev && !configured) continue;
      entries.push({ name: p.name, channels: p.channels, configured });
    }

    return json({ success: true, data: entries }, 200);
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
