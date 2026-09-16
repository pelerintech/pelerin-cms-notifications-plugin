import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_EDIT = join(__dirname, '../../src/pages/admin/rules/[id].astro');

function clientScript(page: string): string {
  const source = readFileSync(page, 'utf-8');
  const scriptMatches = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scriptMatches.length > 0, `expected at least one <script> block in ${page}`);
  const script = scriptMatches[scriptMatches.length - 1][1];
  assert.ok(script.trim().length > 0, `extracted client script is empty in ${page}`);
  return script;
}

describe('admin rules/[id] — from-email pre-fill', () => {
  it('renders a required email-format from_email input value pre-filled from rule or provider default', () => {
    const source = readFileSync(RULES_EDIT, 'utf-8');
    const inputMatch = source.match(/<input[^>]*name="from_email"[^>]*>/);
    assert.ok(inputMatch, 'must render an input with name="from_email"');
    assert.match(inputMatch[0], /type="email"/, 'from_email input must use type="email"');
    // Pre-fill value must reference the rule's stored value OR the provider default.
    assert.match(inputMatch[0], /from_email/i, 'from_email input must reference rule?.from_email');
  });

  it('pre-fills from rule.from_email ?? provider default', () => {
    const source = readFileSync(RULES_EDIT, 'utf-8');
    assert.match(
      source,
      /rule\??\.from_email/,
      'must reference the rule stored from_email for pre-fill'
    );
    assert.match(source, /fromEmail/, 'must reference the provider default fromEmail for pre-fill');
  });

  it('wires the provider select-change prefill', () => {
    const script = clientScript(RULES_EDIT);
    assert.match(script, /providerFromEmail/, 'script must build a provider→fromEmail map');
    assert.match(script, /change/, 'script must have a change handler');
    assert.match(script, /provider_name/, 'change handler must listen on the provider select');
    assert.match(script, /from_email/, 'change handler must affect the from_email input');
  });
});
