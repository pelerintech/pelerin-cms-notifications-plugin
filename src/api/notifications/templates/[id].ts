/**
 * Template update/delete API endpoint.
 *
 * PUT /api/plugins/notifications/templates/[id]
 * DELETE /api/plugins/notifications/templates/[id]
 */
import type { APIRoute } from 'astro';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { updateTemplate, deleteTemplate, getTemplate, TemplateError } from '../../../lib/data/templates.ts';
import { templateSchema } from '../../../schemas/template.schema.ts';

/** Handler: update a template. Receives db directly so it is harness-testable. */
export async function updateTemplateHandler(
  db: LibSQLDatabase,
  id: string,
  body: unknown
) {
  const result = templateSchema.partial().safeParse(body);
  if (!result.success) {
    return {
      status: 400,
      body: { error: 'Validation failed', details: result.error.issues },
    };
  }
  try {
    const updated = await updateTemplate(db, id, result.data);
    return { status: 200, body: { data: updated } };
  } catch (err: any) {
    if (err instanceof TemplateError && err.code === 'not_found') {
      return { status: 404, body: { error: 'Template not found' } };
    }
    throw err;
  }
}

/** Handler: delete a template. Receives db directly so it is harness-testable. */
export async function deleteTemplateHandler(
  db: LibSQLDatabase,
  id: string
) {
  const existing = await getTemplate(db, id);
  if (!existing) {
    return { status: 404, body: { error: 'Template not found' } };
  }
  await deleteTemplate(db, id);
  return { status: 200, body: { data: { id, deleted: true } } };
}

export const PUT: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  await sdk.auth.requireAdmin(context.request);
  const { db } = await import('astro:db');
  const { id } = context.params;
  const body = await context.request.json();
  const result = await updateTemplateHandler(db, id!, body);
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
  const result = await deleteTemplateHandler(db, id!);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
