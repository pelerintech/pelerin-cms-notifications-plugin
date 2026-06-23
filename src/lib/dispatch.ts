/**
 * Dispatch logic — the critical path that turns an event into sent notifications.
 *
 * Extracted from init.ts into a testable function that takes the harness `db`
 * directly. `init.ts` is a thin wiring function that subscribes to `*` and calls
 * `dispatchEvent(ctx.db, event, payload)`.
 */
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { findActiveRulesMatching } from './data/rules.ts';
import { getTemplate } from './data/templates.ts';
import { createLog } from './data/logs.ts';
import { interpolate } from './interpolation.ts';
import { getProviderForRule } from './provider-selection.ts';
import '../providers/index.ts'; // trigger auto-registration
import type { RuleRow } from './data/rules.ts';

/** Split an interpolated recipient field by comma, trim, filter empty. */
function resolveRecipients(
  recipientField: string | null | undefined,
  payload: Record<string, unknown>
): string[] {
  if (!recipientField) return [];
  const resolved = interpolate(recipientField, payload);
  return resolved.split(',').map(s => s.trim()).filter(Boolean);
}

/** Dispatch an event: find matching rules, resolve templates, send via provider, log the result. */
export async function dispatchEvent(
  db: LibSQLDatabase,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const rules = await findActiveRulesMatching(db, event);

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

      const subject = interpolate(template.subject, payload);
      const bodyHtml = template.body_html ? interpolate(template.body_html, payload) : null;
      const bodyText = template.body_text ? interpolate(template.body_text, payload) : null;
      const to = resolveRecipients(rule.to, payload);
      const cc = resolveRecipients(rule.cc, payload);
      const bcc = resolveRecipients(rule.bcc, payload);

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

      const isDev = process.env.NOTIFICATIONS_DEV_MODE === 'true';
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

      const result = await provider.send({
        to,
        cc,
        bcc,
        subject,
        bodyHtml: bodyHtml ?? undefined,
        bodyText: bodyText ?? undefined,
      }, db);

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
        error: result.success ? null : (result.error || null),
        message_id: result.messageId || null,
      });
    } catch (err) {
      // One bad rule doesn't kill the bus subscriber
      console.error(`[notifications] Error dispatching rule ${rule.id}:`, err);
    }
  }
}
