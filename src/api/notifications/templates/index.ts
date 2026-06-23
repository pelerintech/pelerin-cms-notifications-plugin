/**
 * Templates list API endpoint.
 *
 * GET /api/plugins/notifications/templates
 * Query params: page, limit, search
 * Returns paginated list of notification templates.
 */
import type { APIRoute } from 'astro';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { listTemplates } from '../../../lib/data/templates.ts';

/** Handler: list templates with pagination and search. Receives db directly. */
export async function listTemplatesHandler(
  db: LibSQLDatabase,
  query: { page: number; limit: number; search?: string }
) {
  const result = await listTemplates(db, query);
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
  const result = await listTemplatesHandler(db, { page, limit, search });
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
