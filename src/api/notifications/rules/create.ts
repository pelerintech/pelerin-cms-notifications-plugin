/**
 * Create rule API endpoint.
 *
 * POST /api/plugins/notifications/rules
 * Body: { event_pattern, template_id, provider_name, to, cc?, bcc?, active? }
 * Unique constraint on (event_pattern, template_id, provider_name).
 */
import type { APIRoute } from 'astro';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { createRule, RuleError } from '../../../lib/data/rules.ts';
import { ruleSchema } from '../../../schemas/rule.schema.ts';

/** Handler: create a rule. Receives db directly so it is harness-testable. */
export async function createRuleHandler(db: LibSQLDatabase, body: unknown) {
  const result = ruleSchema.safeParse(body);
  if (!result.success) {
    return {
      status: 400,
      body: { error: 'Validation failed', details: result.error.issues },
    };
  }
  try {
    const rule = await createRule(db, result.data);
    return { status: 201, body: { data: rule } };
  } catch (err: any) {
    if (err instanceof RuleError && err.code === 'duplicate') {
      return {
        status: 409,
        body: { error: 'Rule with this event_pattern, template_id, and provider_name already exists' },
      };
    }
    throw err;
  }
}

export const POST: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  await sdk.auth.requireAdmin(context.request);
  const { db } = await import('astro:db');
  const body = await context.request.json();
  const result = await createRuleHandler(db, body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
