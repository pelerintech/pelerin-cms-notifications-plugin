import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { ses, setSesClientFactory, resetSesClientFactory } from '../../src/providers/ses.ts';

const sesSrcPath = new URL('../../src/providers/ses.ts', import.meta.url);

describe('SES provider', () => {
  it('provider name is "ses"', () => {
    assert.strictEqual(ses.name, 'ses');
  });

  it('channels include "email"', () => {
    assert.ok(ses.channels.includes('email'), 'channels must include "email"');
  });

  it('getConfigSchema requires all 4 keys (region, access, secret, from_email)', () => {
    const schema = ses.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('ses_region'), 'must require ses_region');
    assert.ok(schema.requiredKeys.includes('ses_access_key'), 'must require ses_access_key');
    assert.ok(schema.requiredKeys.includes('ses_secret_key'), 'must require ses_secret_key');
    assert.ok(schema.requiredKeys.includes('ses_from_email'), 'must require ses_from_email');
  });

  it('exports the client-factory test seam (setSesClientFactory / resetSesClientFactory)', () => {
    assert.strictEqual(typeof setSesClientFactory, 'function');
    assert.strictEqual(typeof resetSesClientFactory, 'function');
  });

  it('source does not contain the ses-placeholder string', () => {
    const src = readFileSync(sesSrcPath, 'utf8');
    assert.ok(!src.includes('ses-placeholder'), 'placeholder return must be gone');
  });

  it('source dynamically imports @aws-sdk/client-ses and uses SendEmailCommand', () => {
    const src = readFileSync(sesSrcPath, 'utf8');
    assert.ok(src.includes("await import('@aws-sdk/client-ses')"), 'must dynamically import the SDK');
    assert.ok(src.includes('SendEmailCommand'), 'must use SendEmailCommand');
  });
});
