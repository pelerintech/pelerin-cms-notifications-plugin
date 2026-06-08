/**
 * Create rule API endpoint.
 *
 * POST /api/plugins/notifications/rules
 * Body: { event_pattern, template_id, provider_name, to, cc?, bcc? }
 * Unique constraint on (event_pattern, template_id, provider_name).
 */

import { z } from './zod.mjs';

// In-memory store for unique constraint enforcement (replaced by DB in production)
const _rulesStore = new Map();

const ruleSchema = z.object({
  event_pattern: z.string().min(1),
  template_id: z.string().min(1),
  provider_name: z.string().min(1),
  to: z.string().min(1),
  cc: z.string().optional().nullable(),
  bcc: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

/**
 * Generate a unique key for the (event_pattern, template_id, provider_name) constraint.
 */
function uniqueKey(eventPattern, templateId, providerName) {
  return `${eventPattern}::${templateId}::${providerName}`;
}

/**
 * POST handler for creating a rule.
 * @param {Object} context - Astro API context
 * @returns {Response}
 */
export async function POST(context) {
  try {
    const body = await context.request.json();
    const result = ruleSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: result.error.issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { event_pattern, template_id, provider_name, to, cc, bcc, active } = result.data;

    // Check unique constraint
    const key = uniqueKey(event_pattern, template_id, provider_name);
    if (_rulesStore.has(key)) {
      return new Response(
        JSON.stringify({ error: 'Rule with this event_pattern, template_id, and provider_name already exists' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const rule = {
      id,
      event_pattern,
      template_id,
      provider_name,
      to,
      cc,
      bcc,
      active: active !== undefined ? active : true,
      created_at: now,
      updated_at: null,
    };

    _rulesStore.set(key, rule);

    // In production, insert into notification_rules table via Astro DB
    try {
      const { getTable } = await import('astro:db');
      const db = getTable('notification_rules');
      await db.insert(rule);
    } catch {
      // Astro DB not available — in-memory store used
    }

    return new Response(
      JSON.stringify({ data: rule }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
