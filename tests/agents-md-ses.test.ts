import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf-8');

test('AGENTS.md marks the SES send gap closed (implemented via @aws-sdk/client-ses SendEmailCommand)', () => {
  assert.ok(/@aws-sdk\/client-ses/.test(src), 'must mention @aws-sdk/client-ses');
  assert.ok(/SendEmailCommand/.test(src), 'must mention SendEmailCommand');
  // SES send must be described as implemented, not as a placeholder
  assert.ok(/SES `send\(\)` is now implemented/i.test(src),
    'must state SES send() is now implemented');
});

test('AGENTS.md does not list SES as an open/deferred gap', () => {
  // SES send must be described as implemented, not as a pending/remaining placeholder.
  assert.ok(
    !/SES `send\(\)` is still a placeholder/i.test(src),
    'must not describe SES send() as still a placeholder',
  );
  assert.ok(
    !/SES .*send.*still returns.*ses-placeholder/i.test(src),
    'must not describe SES send as still returning the placeholder',
  );
  assert.ok(/SES `send\(\)` is now implemented/i.test(src),
    'must state SES send() is now implemented');
});

test('AGENTS.md documents ses_from_email as a required settings field (the SES Source)', () => {
  assert.ok(/ses_from_email/.test(src), 'must mention ses_from_email');
  assert.ok(/Source/.test(src), 'must reference the SES Source');
  assert.ok(/verif/i.test(src), 'must mention the verification requirement');
});

test('AGENTS.md documents SES sandbox mode and identity verification', () => {
  assert.ok(/sandbox/i.test(src), 'must mention sandbox mode');
  assert.ok(/verif/i.test(src), 'must mention identity verification');
  assert.ok(/DKIM|SPF|email confirmation/i.test(src), 'must mention DKIM/SPF/email confirmation');
  assert.ok(/production access|AWS support/i.test(src), 'must mention production access via AWS support');
});

test('AGENTS.md documents @aws-sdk/client-ses as a runtime dependency, dynamically imported', () => {
  assert.ok(/@aws-sdk\/client-ses/.test(src));
  assert.ok(/dynamic/i.test(src) && /import/.test(src), 'must mention dynamic import');
  assert.ok(/ses\.send|SES.*send|inside send/i.test(src), 'must note it loads inside ses.send');
});

test('AGENTS.md documents the injectable sesClientFactory test seam', () => {
  assert.ok(/sesClientFactory/.test(src), 'must mention sesClientFactory');
  assert.ok(/setSesClientFactory/.test(src), 'must mention setSesClientFactory');
  assert.ok(/resetSesClientFactory/.test(src), 'must mention resetSesClientFactory');
  assert.ok(/mock\.module/.test(src), 'must explain mock.module is unavailable in Node 25');
});
