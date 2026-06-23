import { test } from 'node:test';
import assert from 'node:assert';

test('@aws-sdk/client-ses is installed and exports SESClient + SendEmailCommand', async () => {
  const mod = await import('@aws-sdk/client-ses');
  assert.ok(mod.SESClient, 'SESClient must be exported');
  assert.ok(mod.SendEmailCommand, 'SendEmailCommand must be exported');
  assert.strictEqual(typeof mod.SESClient, 'function');
  assert.strictEqual(typeof mod.SendEmailCommand, 'function');
});
