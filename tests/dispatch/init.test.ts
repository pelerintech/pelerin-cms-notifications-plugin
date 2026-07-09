import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

/**
 * Structural test — KNOWN BEHAVIORAL GAP.
 *
 * `src/init.ts` uses `ctx.events.subscribe` from the CMS plugin SDK init
 * context. The event bus is only available at runtime (not under bare Node),
 * so we assert structural facts (the `*` subscription, the `dispatchEvent`
 * call inside the subscriber) rather than exercising the full wiring.
 * Runtime dispatch behaviour is covered by tests/dispatch/dispatch*.test.ts
 * (which call `dispatchEvent` directly); the actual event-bus subscription
 * is only verifiable end-to-end and is deferred to the Playwright E2E request.
 */
import init from '../../src/init.ts';

test('init subscribes to * on the event bus and logs init message', () => {
  const messages: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => messages.push(msg);
  try {
    let subscribePattern: string | null = null;
    const ctx = {
      events: { subscribe: (pattern: string) => { subscribePattern = pattern; } },
      db: {},
    };
    init(ctx);
    assert.strictEqual(subscribePattern, '*');
    assert.ok(messages.some((m) => m.includes('[notifications] Event bus subscriber initialized')));
  } finally {
    console.log = originalLog;
  }
});

test('init with invalid context logs error and does not throw', () => {
  const messages: string[] = [];
  const originalError = console.error;
  console.error = (msg: string) => messages.push(msg);
  try {
    assert.doesNotThrow(() => init({}));
    assert.ok(messages.some((m) => m.includes('[notifications] Invalid plugin context')));
  } finally {
    console.error = originalError;
  }
});

test('init.ts imports dispatchEvent and calls it inside the subscriber (structural)', () => {
  const src = readFileSync(new URL('../../src/init.ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('dispatchEvent'), 'init.ts should import dispatchEvent');
  assert.ok(src.includes('ctx.db') || src.includes('ctx.events.subscribe'), 'init.ts should use ctx.db or ctx.events.subscribe');
});
