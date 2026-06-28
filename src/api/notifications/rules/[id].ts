/**
 * Rule update/delete API endpoint.
 *
 * PUT    /api/plugins/notifications/rules/[id]
 * DELETE /api/plugins/notifications/rules/[id]
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam — auth, body
 * parsing, validation, the guardrail, and Response construction all live inside
 * the tested `runPut`/`runDelete`. The thin wrappers construct deps from the
 * real `astro:db` / `pelerin:plugin-sdk` modules and delegate.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import { db } from 'astro:db';
import type { HandlerDeps } from '../../../lib/handler-types';
import { updateRule, deleteRule, getRule, RuleError } from '../../../lib/data/rules.ts';
import { isProviderConfigured } from '../../../lib/data/providers.ts';
import '../../../providers/index.ts'; // trigger provider auto-registration for isProviderConfigured
import { ruleSchema } from '../../../schemas/rule.schema.ts';

export const PUT: APIRoute = (context) =>
  runPut({ db, sdk: createPluginContext(), ctx: context });

export const DELETE: APIRoute = (context) =>
  runDelete({ db, sdk: createPluginContext(), ctx: context });

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function runPut({ db, sdk, ctx }: HandlerDeps): Promise<Response> {
  try {
    await sdk.auth.requireAdmin(ctx.request);
    const body = await ctx.request.json();
    const id = ctx.params.id!;

    // Use partial validation — all fields optional for updates
    const result = ruleSchema.partial().safeParse(body);
    if (!result.success) {
      const fields = Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
      return json({ success: false, error: 'Validation failed', fields }, 422);
    }

    // Mode-aware guardrail: in production, reject changing the provider to one
    // that is not fully configured. Skipped in dev mode and when provider_name
    // is not being changed. `local` is rejected because isProviderConfigured('local')
    // returns false.
    if (
      result.data.provider_name !== undefined &&
      process.env.NOTIFICATIONS_DEV_MODE !== 'true'
    ) {
      const configured = await isProviderConfigured(db, result.data.provider_name);
      if (!configured) {
        return json(
          {
            success: false,
            error: `Provider "${result.data.provider_name}" is not configured. Configure it on the Providers page first.`,
          },
          400,
        );
      }
    }

    try {
      const updated = await updateRule(db, id, result.data);
      return json({ success: true, data: updated }, 200);
    } catch (err: any) {
      if (err instanceof RuleError && err.code === 'not_found') {
        return json({ success: false, error: 'Rule not found' }, 404);
      }
      throw err;
    }
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}

export async function runDelete({ db, sdk, ctx }: HandlerDeps): Promise<Response> {
  try {
    await sdk.auth.requireAdmin(ctx.request);
    const id = ctx.params.id!;

    const existing = await getRule(db, id);
    if (!existing) {
      return json({ success: false, error: 'Rule not found' }, 404);
    }
    await deleteRule(db, id);
    return json({ success: true, data: { id, deleted: true } }, 200);
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
