import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE = join(__dirname, '../../src/pages/admin/providers/[name].astro');

/**
 * Regression guard: the provider settings page renders its credential fields
 * from a HARDCODED per-provider `fields` array (`providerConfigs`), NOT from
 * `getConfigSchema().fields`. Each provider must therefore also list its
 * `*_from_email` key there, or the from-email won't appear in the admin UI
 * (even though the config schema declares it). This guards against that drift.
 */
const CASES: [string, string][] = [
  ['sendgrid', 'sendgrid_from_email'],
  ['mailgun', 'mailgun_from_email'],
  ['brevo', 'brevo_from_email'],
  ['smtp', 'smtp_from_email'],
  ['ses', 'ses_from_email'],
];

describe('provider settings page exposes the from-email field', () => {
  const source = readFileSync(PAGE, 'utf-8');

  for (const [provider, key] of CASES) {
    it(`${provider} lists ${key} as a text field`, () => {
      // Isolate the provider's `fields` block (from `<provider>: {` up to the
      // closing `},` of that provider's config object).
      const block = extractProviderBlock(source, provider);
      assert.ok(
        block.includes(`key: '${key}'`),
        `${provider} providerConfigs[].fields must include ${key}`
      );
      assert.match(
        block,
        new RegExp(`key: '[^']*${provider}_from_email'[\\s\\S]*?type: 'text'`),
        `${key} must be type 'text' in the ${provider} fields`
      );
    });
  }
});

/** Extract the `{ label, icon, fields: [...] }` block for a given provider key, spanning to its closing `},`. */
function extractProviderBlock(source: string, provider: string): string {
  const start = source.indexOf(`${provider}: {`);
  assert.ok(start >= 0, `${provider} must have a providerConfigs entry`);
  // Find the provider object close: a `  },` at the provider block's indent
  // after the fields array. We scan to the provider block's closing `},`.
  const close = source.indexOf('\n  },', start);
  assert.ok(close > start, `could not find end of ${provider} config block`);
  return source.slice(start, close);
}
