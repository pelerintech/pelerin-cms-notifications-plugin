/**
 * Event bus subscriber — plugin initialization.
 *
 * Subscribes to all CMS events (*), resolves matching rules,
 * renders templates, resolves dynamic recipients, and dispatches
 * to the appropriate provider. Errors are caught and logged without crashing.
 */

import { findMatchingRules } from './lib/rule-lookup.mjs';
import { interpolate } from './lib/interpolation.mjs';
import { getProviderForRule } from './lib/provider-selection.mjs';

// Ensure providers are loaded
import './providers/index.mjs';

/**
 * Resolve a recipient field that may contain {{ }} interpolation.
 * @param {string} recipientField - Static email or {{ field }} expression
 * @param {Record<string, unknown>} payload - Event payload data
 * @returns {string[]} Array of resolved email addresses
 */
function resolveRecipients(recipientField, payload) {
  if (!recipientField) return [];
  const resolved = interpolate(recipientField, payload);
  // Support comma-separated lists
  return resolved.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Dispatch a single notification for a rule.
 * @param {Object} rule - Matching rule
 * @param {Record<string, unknown>} payload - Event payload
 * @param {string} eventName - The event name that triggered this dispatch
 */
async function dispatchNotification(rule, payload, eventName) {
  try {
    // Get the provider (local in dev mode, real provider otherwise)
    const isDev = process.env.NOTIFICATIONS_DEV_MODE === 'true';
    const provider = getProviderForRule(rule, isDev);
    if (!provider) {
      console.warn(`[notifications] Provider "${rule.provider_name}" not found for rule ${rule.id}`);
      return;
    }

    // Load template from DB
    let template = null;
    try {
      const { getTable } = await import('astro:db');
      const db = getTable('notification_templates');
      template = await db.findFirst({ where: { id: '=', value: rule.template_id } });
    } catch {
      // Astro DB not available
    }

    if (!template) {
      console.warn(`[notifications] Template "${rule.template_id}" not found for rule ${rule.id}`);
      return;
    }

    // Render template with event payload
    const subject = interpolate(template.subject, payload);
    const bodyHtml = template.body_html ? interpolate(template.body_html, payload) : null;
    const bodyText = template.body_text ? interpolate(template.body_text, payload) : null;

    // Resolve recipients
    const to = resolveRecipients(rule.to, payload);
    const cc = resolveRecipients(rule.cc, payload);
    const bcc = resolveRecipients(rule.bcc, payload);

    if (to.length === 0) {
      console.warn(`[notifications] No recipients resolved for rule ${rule.id}`);
      return;
    }

    // Send via provider
    const result = await provider.send({ to, cc, bcc, subject, bodyHtml, bodyText });

    // Write log entry for every dispatch attempt
    try {
      const { getTable } = await import('astro:db');
      const logsDb = getTable('notification_logs');
      await logsDb.insert({
        id: crypto.randomUUID(),
        event_name: eventName,
        rule_id: rule.id,
        provider_name: rule.provider_name,
        to: to.join(','),
        cc: cc.length > 0 ? cc.join(',') : null,
        bcc: bcc.length > 0 ? bcc.join(',') : null,
        subject: subject,
        body_html: bodyHtml,
        body_text: bodyText,
        success: result.success,
        error: result.success ? null : (result.error || null),
        message_id: result.messageId || null,
        created_at: new Date(),
      });
    } catch {
      // Astro DB not available — skip logging
    }

    if (result.success) {
      console.log(`[notifications] Sent via ${rule.provider_name} (rule: ${rule.id}, msg: ${result.messageId})`);
    } else {
      console.error(`[notifications] Send failed via ${rule.provider_name}: ${result.error}`);
    }
  } catch (err) {
    console.error(`[notifications] Error dispatching rule ${rule.id}:`, err.message);
  }
}

/**
 * Plugin initialization — called by the CMS plugin SDK.
 * @param {Object} ctx - Plugin context with events.subscribe
 */
export default function init(ctx) {
  if (!ctx || !ctx.events || typeof ctx.events.subscribe !== 'function') {
    console.error('[notifications] Invalid plugin context — events.subscribe not available');
    return;
  }

  ctx.events.subscribe('*', async (data) => {
    try {
      const event = data.event || data.name;
      const payload = data.payload || data;

      if (!event) {
        console.warn('[notifications] Received event without name');
        return;
      }

      // Load matching rules from DB
      let rules = [];
      try {
        const { getTable } = await import('astro:db');
        const db = getTable('notification_rules');
        const allRules = await db.where('active', '=', true).run();
        rules = findMatchingRules(allRules, event);
      } catch {
        // Astro DB not available — no rules to match
      }

      if (rules.length === 0) {
        return;
      }

      // Dispatch each matching rule
      for (const rule of rules) {
        await dispatchNotification(rule, payload, event);
      }
    } catch (err) {
      // Never crash the event bus
      console.error('[notifications] Error processing event:', err.message);
    }
  });

  console.log('[notifications] Event bus subscriber initialized');
}
