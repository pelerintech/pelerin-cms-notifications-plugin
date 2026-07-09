import { test } from 'node:test';
import assert from 'node:assert';

/**
 * Dependency smoke check — NOT a behaviour test.
 *
 * Verifies that `@aws-sdk/client-ses` is installed and exports `SESClient` +
 * `SendEmailCommand`. This catches a missing npm install, but it exercises no
 * SES send logic. Real SES send behaviour is covered by
 * `tests/providers/ses-send.test.ts` (via the `sesClientFactory` test seam)
 * and `tests/dispatch/dispatch-ses.test.ts`. Kept because the SDK is the
 * plugin's only AWS dependency and a missing install would otherwise surface
 * only at dispatch time.
 */
test('@aws-sdk/client-ses is installed and exports SESClient + SendEmailCommand', async () => {
  const mod = await import('@aws-sdk/client-ses');
  assert.ok(mod.SESClient, 'SESClient must be exported');
  assert.ok(mod.SendEmailCommand, 'SendEmailCommand must be exported');
  assert.strictEqual(typeof mod.SESClient, 'function');
  assert.strictEqual(typeof mod.SendEmailCommand, 'function');
});
