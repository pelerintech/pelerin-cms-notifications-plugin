/**
 * Create template API endpoint.
 *
 * POST /api/plugins/notifications/templates
 * Body: { name, subject, body_html?, body_text? }
 */

import { z } from '../rules/zod.mjs';

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body_html: z.string().optional().nullable(),
  body_text: z.string().optional().nullable(),
});

/**
 * POST handler for creating a template.
 * @param {Object} context - Astro API context
 * @returns {Response}
 */
export async function POST(context) {
  try {
    const body = await context.request.json();
    const result = templateSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: result.error.issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { name, subject, body_html, body_text } = result.data;

    const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const template = {
      id,
      name,
      subject,
      body_html,
      body_text,
      created_at: now,
      updated_at: null,
    };

    // In production, insert into notification_templates table via Astro DB
    try {
      const { getTable } = await import('astro:db');
      const db = getTable('notification_templates');
      await db.insert(template);
    } catch {
      // Astro DB not available
    }

    return new Response(
      JSON.stringify({ data: template }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
