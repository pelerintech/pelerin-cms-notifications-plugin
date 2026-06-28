/**
 * Create rule API endpoint.
 *
 * POST /api/plugins/notifications/rules
 * Body: { event_pattern, template_id, provider_name, to, cc?, bcc?, active?, channel? }
 * Unique constraint on (event_pattern, template_id, provider_name, channel).
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam — auth, body
 * parsing, validation, the guardrail, and Response construction all live inside
 * the tested `runPost` function. The thin `POST` wrapper sources `db` from
 * `createPluginContext().db` and delegates.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import type { HandlerDeps } from '../../../lib/handler-types';
import { createRule, RuleError } from '../../../lib/data/rules.ts';
import { isProviderConfigured } from '../../../lib/data/providers.ts';
import '../../../providers/index.ts'; // trigger provider auto-registration for isProviderConfigured
import { ruleSchema } from '../../../schemas/rule.schema.ts';

export const POST: APIRoute = (context) => {
  const sdk = createPluginContext();
  return runPost({ db: sdk.db, sdk, ctx: context });
};

/** Validation-fail Response: 422 with a fields map (matches ecomm's matrix). */
function validationResponse(issues: { path: (string | number)[]; message: string }[]): Response {
  const fields = Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]));
  return new Response(
    JSON.stringify({ success: false, error: 'Validation failed', fields }),
    { status: 422, headers: { 'Content-Type': 'application/json' } },
  );
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function runPost({ db, sdk, ctx }: HandlerDeps): Promise<Response> {
  try {
    await sdk.auth.requireAdmin(ctx.request);
    const body = await ctx.request.json();

    const result = ruleSchema.safeParse(body);
    if (!result.success) {
      return validationResponse(result.error.issues);
    }

    // Mode-aware guardrail: in production, reject a rule whose provider is not
    // fully configured. In dev mode the check is skipped so manual smoke testing
    // works with zero external credentials. `local` is rejected here too because
    // isProviderConfigured('local') returns false.
    if (process.env.NOTIFICATIONS_DEV_MODE !== 'true') {
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
      const rule = await createRule(db, result.data);
      return json({ success: true, data: rule }, 201);
    } catch (err: any) {
      if (err instanceof RuleError && err.code === 'duplicate') {
        return json(
          {
            success: false,
            error:
              'Rule with this event_pattern, template_id, provider_name, and channel already exists',
          },
          409,
        );
      }
      throw err;
    }
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
