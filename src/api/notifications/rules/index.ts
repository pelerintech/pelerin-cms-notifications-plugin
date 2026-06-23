/**
 * Rules list API endpoint.
 *
 * GET /api/plugins/notifications/rules
 * Query params: page, limit, search, active
 * Returns paginated list of notification rules.
 */
import type { APIRoute } from 'astro';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { listRules } from '../../../lib/data/rules.ts';

/** Handler: list rules with pagination and filters. Receives db directly. */
export async function listRulesHandler(
  db: LibSQLDatabase,
  query: { page: number; limit: number; search?: string; active?: boolean }
) {
  const result = await listRules(db, query);
  const totalPages = Math.max(1, Math.ceil(result.total / query.limit));
  return {
    status: 200,
    body: {
      data: result.data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages,
      },
    },
  };
}

export const GET: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  await sdk.auth.requireAdmin(context.request);
  const { db } = await import('astro:db');
  const url = new URL(context.request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const search = url.searchParams.get('search') || undefined;
  const activeParam = url.searchParams.get('active');
  const active = activeParam !== null && activeParam !== '' ? activeParam === 'true' : undefined;
  const result = await listRulesHandler(db, { page, limit, search, active });
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
