/**
 * Template update/delete API endpoint.
 *
 * PUT    /api/plugins/notifications/templates/[id]
 * DELETE /api/plugins/notifications/templates/[id]
 *
 * Uses the unified `runMethod({ db, sdk, ctx })` injection seam — auth, body
 * parsing, validation, and Response construction all live inside the tested
 * `runPut`/`runDelete`. The thin wrappers construct deps from the real
 * `astro:db` / `pelerin:plugin-sdk` modules and delegate.
 */
import type { APIRoute } from 'astro';
import { createPluginContext } from 'pelerin:plugin-sdk';
import { db } from 'astro:db';
import type { HandlerDeps } from '../../../lib/handler-types';
import { updateTemplate, deleteTemplate, getTemplate, TemplateError } from '../../../lib/data/templates.ts';
import { templateSchema } from '../../../schemas/template.schema.ts';

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

    const result = templateSchema.partial().safeParse(body);
    if (!result.success) {
      const fields = Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
      return json({ success: false, error: 'Validation failed', fields }, 422);
    }

    try {
      const updated = await updateTemplate(db, id, result.data);
      return json({ success: true, data: updated }, 200);
    } catch (err: any) {
      if (err instanceof TemplateError && err.code === 'not_found') {
        return json({ success: false, error: 'Template not found' }, 404);
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

    const existing = await getTemplate(db, id);
    if (!existing) {
      return json({ success: false, error: 'Template not found' }, 404);
    }
    await deleteTemplate(db, id);
    return json({ success: true, data: { id, deleted: true } }, 200);
  } catch (err: any) {
    const status = err.status ?? 500;
    return json({ success: false, error: err.message || 'Server Error' }, status);
  }
}
