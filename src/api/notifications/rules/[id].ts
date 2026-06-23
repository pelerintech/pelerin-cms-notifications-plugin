/**
 * Rule update/delete API endpoint.
 *
 * PUT /api/plugins/notifications/rules/[id]
 * DELETE /api/plugins/notifications/rules/[id]
 */
import type { APIRoute } from 'astro';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { updateRule, deleteRule, getRule, RuleError } from '../../../lib/data/rules.ts';
import { ruleSchema } from '../../../schemas/rule.schema.ts';

/** Handler: update a rule. Receives db directly so it is harness-testable. */
export async function updateRuleHandler(
  db: LibSQLDatabase,
  id: string,
  body: unknown
) {
  // Use partial validation — all fields optional for updates
  const result = ruleSchema.partial().safeParse(body);
  if (!result.success) {
    return {
      status: 400,
      body: { error: 'Validation failed', details: result.error.issues },
    };
  }
  try {
    const updated = await updateRule(db, id, result.data);
    return { status: 200, body: { data: updated } };
  } catch (err: any) {
    if (err instanceof RuleError && err.code === 'not_found') {
      return { status: 404, body: { error: 'Rule not found' } };
    }
    throw err;
  }
}

/** Handler: delete a rule. Receives db directly so it is harness-testable. */
export async function deleteRuleHandler(
  db: LibSQLDatabase,
  id: string
) {
  const existing = await getRule(db, id);
  if (!existing) {
    return { status: 404, body: { error: 'Rule not found' } };
  }
  await deleteRule(db, id);
  return { status: 200, body: { data: { id, deleted: true } } };
}

export const PUT: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  await sdk.auth.requireAdmin(context.request);
  const { db } = await import('astro:db');
  const { id } = context.params;
  const body = await context.request.json();
  const result = await updateRuleHandler(db, id!, body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  await sdk.auth.requireAdmin(context.request);
  const { db } = await import('astro:db');
  const { id } = context.params;
  const result = await deleteRuleHandler(db, id!);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
