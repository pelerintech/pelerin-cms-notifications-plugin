/**
 * Logs list API endpoint.
 *
 * GET /api/plugins/notifications/logs
 * Query params: page, pageSize, provider, status, rule, from, to
 * Returns a paginated list of notification logs.
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam — auth, query
 * parsing, and Response construction all live inside the tested `runGet`. The
 * thin `GET` wrapper sources `db` from `createPluginContext().db` and delegates.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import type { HandlerDeps } from '../../../lib/handler-types';
import { listLogs } from '../../../lib/data/logs.ts';

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
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const provider = url.searchParams.get('provider') || undefined;
    const statusParam = url.searchParams.get('status');
    const status = (statusParam === 'success' || statusParam === 'failure') ? statusParam : undefined;
    const rule = url.searchParams.get('rule') || undefined;
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;

    const result = await listLogs(db, {
      page,
      pageSize,
      provider,
      status,
      rule,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return json(
      { success: true, data: result.data, total: result.total, page, pageSize },
      200,
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
