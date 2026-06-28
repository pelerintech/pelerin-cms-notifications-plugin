/**
 * Templates list API endpoint.
 *
 * GET /api/plugins/notifications/templates
 * Query params: page, limit, search
 * Returns a paginated list of notification templates.
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam — auth, query
 * parsing, and Response construction all live inside the tested `runGet`. The
 * thin `GET` wrapper constructs deps from the real `astro:db` /
 * `pelerin:plugin-sdk` modules and delegates.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import { db } from 'astro:db';
import type { HandlerDeps } from '../../../lib/handler-types';
import { listTemplates } from '../../../lib/data/templates.ts';

export const GET: APIRoute = (context) =>
  runGet({ db, sdk: createPluginContext(), ctx: context });

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
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search') || undefined;

    const result = await listTemplates(db, { page, limit, search });
    const totalPages = Math.max(1, Math.ceil(result.total / limit));
    return json(
      {
        success: true,
        data: result.data,
        pagination: { page, limit, total: result.total, totalPages },
      },
      200,
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
