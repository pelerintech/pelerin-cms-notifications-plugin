import { describe, test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { ses } from '../../src/providers/ses.ts';

const adminFormPath = new URL('../../src/pages/admin/providers/[name].astro', import.meta.url);

/** Parse the providerConfigs object's fields arrays out of the admin form source. */
function extractProviderFields(src: string, provider: string): string[] {
  // Find the provider block, then capture its `fields: [ ... ]` array.
  const blockRe = new RegExp(`${provider}:\\s*\\{[\\s\\S]*?fields:\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const m = src.match(blockRe);
  if (!m) throw new Error(`could not find ${provider} fields block`);
  // Pull out each `key: '...'` occurrence.
  const keys = [...m[1].matchAll(/key:\s*'([^']+)'/g)].map(x => x[1]);
  return keys;
}

describe('SES ses_from_email field', () => {
  test('getConfigSchema requiredKeys includes ses_from_email (plus the original 3)', () => {
    const schema = ses.getConfigSchema();
    assert.ok(schema.requiredKeys.includes('ses_region'));
    assert.ok(schema.requiredKeys.includes('ses_access_key'));
    assert.ok(schema.requiredKeys.includes('ses_secret_key'));
    assert.ok(schema.requiredKeys.includes('ses_from_email'), 'must require ses_from_email');
  });

  test('getConfigSchema fields.ses_from_email exists with type text', () => {
    const schema = ses.getConfigSchema();
    const field = schema.fields?.ses_from_email;
    assert.ok(field, 'ses_from_email field must exist');
    assert.strictEqual(field.type, 'text');
    assert.ok(field.label, 'must have a label');
    assert.ok(field.description, 'must have a description');
  });

  test('admin form SES section includes a ses_from_email field', () => {
    const src = readFileSync(adminFormPath, 'utf8');
    const keys = extractProviderFields(src, 'ses');
    assert.ok(keys.includes('ses_from_email'), 'SES admin form must include ses_from_email');
  });

  test('admin form SES section has exactly 4 fields', () => {
    const src = readFileSync(adminFormPath, 'utf8');
    const keys = extractProviderFields(src, 'ses');
    assert.strictEqual(keys.length, 4);
    assert.deepStrictEqual(keys, ['ses_region', 'ses_access_key', 'ses_secret_key', 'ses_from_email']);
  });

  test('other providers admin forms are unchanged', () => {
    const src = readFileSync(adminFormPath, 'utf8');
    assert.deepStrictEqual(extractProviderFields(src, 'sendgrid'), ['sendgrid_api_key']);
    assert.deepStrictEqual(extractProviderFields(src, 'mailgun'), ['mailgun_url', 'mailgun_api_key']);
    assert.deepStrictEqual(extractProviderFields(src, 'smtp'), [
      'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_tls',
    ]);
    assert.deepStrictEqual(extractProviderFields(src, 'brevo'), ['brevo_api_key', 'brevo_api_url']);
  });
});
