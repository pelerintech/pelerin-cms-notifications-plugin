/**
 * Log detail API endpoint.
 *
 * GET /api/plugins/notifications/logs/[id]
 */
import type { APIRoute } from 'astro';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getLog } from '../../../lib/data/logs.ts';

/** Handler: get a single log by id. Receives db directly so it is harness-testable. */
export async function getLogHandler(
  db: LibSQLDatabase,
  id: string
) {
  const log = await getLog(db, id);
  if (!log) {
    return { status: 404, body: { error: 'Log not found' } };
  }
  return { status: 200, body: { data: log } };
}

export const GET: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  await sdk.auth.requireAdmin(context.request);
  const { db } = await import('astro:db');
  const { id } = context.params;
  const result = await getLogHandler(db, id!);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
