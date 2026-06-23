/**
 * Create template API endpoint.
 *
 * POST /api/plugins/notifications/templates
 * Body: { name, subject, body_html?, body_text? }
 */
import type { APIRoute } from 'astro';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { createTemplate } from '../../../lib/data/templates.ts';
import { templateSchema } from '../../../schemas/template.schema.ts';

/** Handler: create a template. Receives db directly so it is harness-testable. */
export async function createTemplateHandler(db: LibSQLDatabase, body: unknown) {
  const result = templateSchema.safeParse(body);
  if (!result.success) {
    return {
      status: 400,
      body: { error: 'Validation failed', details: result.error.issues },
    };
  }
  const template = await createTemplate(db, result.data);
  return { status: 201, body: { data: template } };
}

export const POST: APIRoute = async (context) => {
  const { createPluginContext } = await import('pelerin:plugin-sdk');
  const sdk = createPluginContext();
  await sdk.auth.requireAdmin(context.request);
  const { db } = await import('astro:db');
  const body = await context.request.json();
  const result = await createTemplateHandler(db, body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
