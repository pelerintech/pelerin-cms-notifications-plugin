/**
 * Log detail API endpoint.
 *
 * GET /api/plugins/notifications/logs/[id]
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam — auth and
 * Response construction all live inside the tested `runGet`. The thin `GET`
 * wrapper sources `db` from `createPluginContext().db` and delegates.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import type { HandlerDeps } from '../../../lib/handler-types';
import { getLog } from '../../../lib/data/logs.ts';

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
    const id = ctx.params.id!;

    const log = await getLog(db, id);
    if (!log) {
      return json({ success: false, error: 'Log not found' }, 404);
    }
    return json({ success: true, data: log }, 200);
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
