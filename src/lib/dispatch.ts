/**
 * Dispatch logic — the critical path that turns an event into sent notifications.
 *
 * Extracted from init.ts into a testable function that takes the harness `db`
 * directly. `init.ts` is a thin wiring function that subscribes to `*` and calls
 * `dispatchEvent(ctx.db, event, payload)`.
 */
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { z } from 'zod';
import { findActiveRulesMatching } from './data/rules.ts';
import { getTemplate } from './data/templates.ts';
import { createLog } from './data/logs.ts';
import { renderTemplate, renderRecipient } from './render.ts';
import { getProviderForRule } from './provider-selection.ts';
import { isDevMode } from './dev-mode.ts';
import '../providers/index.ts'; // trigger auto-registration

/**
 * The self-contained payload the bus delivers to subscribers.
 *
 * `event` is ALSO passed as the handler's first arg; `timestamp` is stamped by
 * the bus; `data` is the stable home for event-specific info. Validating this
 * shape before rendering makes publisher drift fail loudly (a `success:false`
 * log row with a descriptive `error`) instead of silently rendering empty.
 */
const EventEnvelopeSchema = z.object({
  event: z.string(),
  timestamp: z.string(),
  data: z.record(z.unknown()),
});

/** Event-family prefixes whose `data` carries a meaningful nested object. */
const ORDER_PREFIX = 'shop.order.';
const USER_PREFIX = 'pelerin-cms.user.';

/**
 * Deep-validate the `data` for a known event family. Order events require
 * `data.order`; CMS auth events require `data.user`. Families not in this map
 * are envelope-validated only (deep validation is opt-in per family, so a new
 * event family that isn't deep-validated is never over-rejected).
 */
function validateFamilyData(event: string, data: unknown): string | null {
  if (event.startsWith(ORDER_PREFIX)) {
    if (!data || typeof data !== 'object' || !('order' in (data as Record<string, unknown>))) {
      return `Invalid payload for "${event}": expected data.order`;
    }
  } else if (event.startsWith(USER_PREFIX)) {
    if (!data || typeof data !== 'object' || !('user' in (data as Record<string, unknown>))) {
      return `Invalid payload for "${event}": expected data.user`;
    }
  }
  return null;
}

/** Split an interpolated recipient field by comma, trim, filter empty. */
function resolveRecipients(
  recipientField: string | null | undefined,
  payload: Record<string, unknown>
): string[] {
  if (!recipientField) return [];
  const resolved = renderRecipient(recipientField, payload);
  return resolved
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Log a `success:false` row for each matching rule when the payload is
 * rejected (invalid envelope, or a known family's `data` is malformed).
 */
async function logRejectedPayload(
  db: LibSQLDatabase,
  rules: ReturnType<typeof findActiveRulesMatching> extends Promise<infer T> ? T : never,
  event: string,
  error: string
): Promise<void> {
  for (const rule of rules) {
    await createLog(db, {
      event_name: event,
      rule_id: rule.id,
      provider_name: rule.provider_name,
      to: '',
      subject: '',
      success: false,
      error,
    });
  }
}

/** Dispatch an event: find matching rules, resolve templates, send via provider, log the result. */
export async function dispatchEvent(
  db: LibSQLDatabase,
  event: string,
  payload: unknown
): Promise<void> {
  const rules = await findActiveRulesMatching(db, event);

  // Validate the delivered envelope before rendering. A malformed / unexpected
  // shape fails loudly (a success:false row with a descriptive error) rather
  // than silently rendering empty.
  const envelopeResult = EventEnvelopeSchema.safeParse(payload);
  if (!envelopeResult.success) {
    await logRejectedPayload(
      db,
      rules,
      event,
      `Invalid event envelope for "${event}": ${envelopeResult.error.message}`
    );
    return;
  }

  const envelope = envelopeResult.data;
  const familyError = validateFamilyData(event, envelope.data);
  if (familyError) {
    await logRejectedPayload(db, rules, event, familyError);
    return;
  }

  // Render against the envelope so existing order templates keep using
  // `{{data.order.*}}` — no `data.payload` re-wrapping.
  const context = envelope as unknown as Record<string, unknown>;

  for (const rule of rules) {
    try {
      const template = await getTemplate(db, rule.template_id);
      if (!template) {
        await createLog(db, {
          event_name: event,
          rule_id: rule.id,
          provider_name: rule.provider_name,
          to: '',
          subject: '',
          success: false,
          error: `Template "${rule.template_id}" not found`,
        });
        continue;
      }

      const subject = renderTemplate(template.subject, context);
      const bodyHtml = template.body_html ? renderTemplate(template.body_html, context) : null;
      const bodyText = template.body_text ? renderTemplate(template.body_text, context) : null;
      const to = resolveRecipients(rule.to, context);
      const cc = resolveRecipients(rule.cc, context);
      const bcc = resolveRecipients(rule.bcc, context);

      if (to.length === 0) {
        await createLog(db, {
          event_name: event,
          rule_id: rule.id,
          provider_name: rule.provider_name,
          to: '',
          subject,
          success: false,
          error: 'No recipients resolved',
        });
        continue;
      }

      const isDev = isDevMode();
      const provider = getProviderForRule(rule, isDev);
      if (!provider) {
        await createLog(db, {
          event_name: event,
          rule_id: rule.id,
          provider_name: rule.provider_name,
          to: to.join(','),
          subject,
          success: false,
          error: `Provider "${rule.provider_name}" not found`,
        });
        continue;
      }

      const result = await provider.send(
        {
          to,
          cc,
          bcc,
          subject,
          bodyHtml: bodyHtml ?? undefined,
          bodyText: bodyText ?? undefined,
          // Carry the rule's effective from-address down to the provider. For
          // legacy/null-from rules this is undefined, so the provider falls back
          // to its own settings `*_from_email` default.
          from: rule.from_email ?? undefined,
        },
        db
      );

      await createLog(db, {
        event_name: event,
        rule_id: rule.id,
        provider_name: rule.provider_name,
        to: to.join(','),
        cc: cc.length > 0 ? cc.join(',') : null,
        bcc: bcc.length > 0 ? bcc.join(',') : null,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        success: result.success,
        error: result.success ? null : result.error || null,
        message_id: result.messageId || null,
      });
    } catch (err) {
      // One bad rule doesn't kill the bus subscriber.
      // Log the failure so the audit trail is complete.
      console.error(`[notifications] Error dispatching rule ${rule.id}:`, err);
      try {
        await createLog(db, {
          event_name: event,
          rule_id: rule.id,
          provider_name: rule.provider_name,
          to: '',
          subject: '',
          success: false,
          error: String(err),
        });
      } catch {
        // Don't re-throw if the log write itself fails
      }
    }
  }
}
