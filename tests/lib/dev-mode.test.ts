/**
 * Dev-mode detection helper behavioral test.
 *
 * `isDevMode()` reads `NOTIFICATIONS_DEV_MODE` preferring `import.meta.env`
 * (where the CMS loads `.env`) and falling back to `process.env`. Under bare
 * Node (`node --test`) we cannot set `import.meta.env`, so the precedence is
 * verified by injecting an explicit `EnvSource`. This mirrors the provider
 * factory seams (SES/SMTP) used elsewhere in the plugin.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { isDevMode } from '../../src/lib/dev-mode.ts';

test('isDevMode: import.meta.env takes precedence over process.env', () => {
  assert.strictEqual(
    isDevMode({
      importMeta: { NOTIFICATIONS_DEV_MODE: 'true' },
      process: { NOTIFICATIONS_DEV_MODE: 'false' },
    }),
    true
  );
});

test('isDevMode: falls back to process.env when import.meta.env is absent', () => {
  assert.strictEqual(
    isDevMode({
      importMeta: {},
      process: { NOTIFICATIONS_DEV_MODE: 'true' },
    }),
    true
  );
});

test('isDevMode: a non-"true" string is not dev mode', () => {
  assert.strictEqual(
    isDevMode({
      importMeta: {},
      process: { NOTIFICATIONS_DEV_MODE: 'TRUE' },
    }),
    false
  );
  assert.strictEqual(
    isDevMode({
      importMeta: {},
      process: {},
    }),
    false
  );
});

test('isDevMode: no-arg call reads the real process.env', () => {
  const original = process.env.NOTIFICATIONS_DEV_MODE;
  try {
    process.env.NOTIFICATIONS_DEV_MODE = 'true';
    assert.strictEqual(isDevMode(), true);
    delete process.env.NOTIFICATIONS_DEV_MODE;
    assert.strictEqual(isDevMode(), false);
  } finally {
    if (original === undefined) delete process.env.NOTIFICATIONS_DEV_MODE;
    else process.env.NOTIFICATIONS_DEV_MODE = original;
  }
});
