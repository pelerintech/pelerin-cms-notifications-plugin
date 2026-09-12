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

  ctx.events.subscribe('*', async (event: string, payload: any) => {
    try {
      // The bus delivers the event name as the handler's first argument and the
      // self-contained envelope as the second. Consume it directly — do NOT
      // reverse-engineer the event name from the payload (data.event ?? data.name)
      // or re-wrap the payload (data.payload ?? {}): both were wrong for the
      // ecomm (order/invoice) and pelerin_cms (auth) publishers.
      if (!event) {
        console.warn('[notifications] Received event without name');
        return;
      }
      await dispatchEvent(ctx.db, event, payload ?? {});
    } catch (err) {
      // Never crash the event bus
      console.error('[notifications] Error processing event:', err);
    }
  });

  console.log('[notifications] Event bus subscriber initialized');
}
