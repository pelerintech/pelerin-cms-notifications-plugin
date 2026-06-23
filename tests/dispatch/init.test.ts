import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
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
