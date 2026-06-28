/**
 * Create template API endpoint.
 *
 * POST /api/plugins/notifications/templates
 * Body: { name, subject, body_html?, body_text? }
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam — auth, body
 * parsing, validation, and Response construction all live inside the tested
 * `runPost`. The thin `POST` wrapper constructs deps from the real `astro:db` /
 * `pelerin:plugin-sdk` modules and delegates.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import { db } from 'astro:db';
import type { HandlerDeps } from '../../../lib/handler-types';
import { createTemplate } from '../../../lib/data/templates.ts';
import { templateSchema } from '../../../schemas/template.schema.ts';

export const POST: APIRoute = (context) =>
  runPost({ db, sdk: createPluginContext(), ctx: context });

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

    const result = templateSchema.safeParse(body);
    if (!result.success) {
      const fields = Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
      return json({ success: false, error: 'Validation failed', fields }, 422);
    }

    const template = await createTemplate(db, result.data);
    return json({ success: true, data: template }, 201);
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
