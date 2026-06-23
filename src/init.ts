/**
 * Event bus subscriber — plugin initialization.
 *
 * Thin wiring function that subscribes to all CMS events (*).
 * The dispatch logic lives in `src/lib/dispatch.ts` (testable with the harness db).
 */
import { dispatchEvent } from './lib/dispatch.ts';

/** Plugin initialization — called by the CMS plugin SDK. */
export default function init(ctx: any): void {
  if (!ctx || !ctx.events || typeof ctx.events.subscribe !== 'function') {
    console.error('[notifications] Invalid plugin context — events.subscribe not available');
    return;
  }

  ctx.events.subscribe('*', async (data: any) => {
    try {
      const event = data.event || data.name;
      if (!event) {
        console.warn('[notifications] Received event without name');
        return;
      }
      const payload = data.payload || data;
      await dispatchEvent(ctx.db, event, payload);
    } catch (err) {
      // Never crash the event bus
      console.error('[notifications] Error processing event:', err);
    }
  });

  console.log('[notifications] Event bus subscriber initialized');
}
