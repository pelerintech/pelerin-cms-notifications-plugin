/**
 * Logs list API endpoint.
 *
 * GET /api/plugins/notifications/logs
 * Query params: page, pageSize, provider, status, rule, from, to
 * Returns paginated list of notification logs.
 */
import type { APIRoute } from 'astro';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { listLogs } from '../../../lib/data/logs.ts';

export interface ListLogsHandlerQuery {
  page: number;
  pageSize: number;
  provider?: string;
  status?: 'success' | 'failure';
  rule?: string;
  from?: string;
  to?: string;
}

/** Handler: list logs with filters and pagination. Receives db directly. */
export async function listLogsHandler(
  db: LibSQLDatabase,
  query: ListLogsHandlerQuery
) {
  const result = await listLogs(db, {
    page: query.page,
    pageSize: query.pageSize,
    provider: query.provider,
    status: query.status,
    rule: query.rule,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  });
  return {
    status: 200,
    body: {
      data: result.data,
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
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
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const provider = url.searchParams.get('provider') || undefined;
  const statusParam = url.searchParams.get('status');
  const status = (statusParam === 'success' || statusParam === 'failure') ? statusParam : undefined;
  const rule = url.searchParams.get('rule') || undefined;
  const from = url.searchParams.get('from') || undefined;
  const to = url.searchParams.get('to') || undefined;
  const result = await listLogsHandler(db, { page, pageSize, provider, status, rule, from, to });
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
