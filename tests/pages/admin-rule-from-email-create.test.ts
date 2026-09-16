import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_NEW = join(__dirname, '../../src/pages/admin/rules/new.astro');

function clientScript(page: string): string {
  const source = readFileSync(page, 'utf-8');
  const scriptMatches = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scriptMatches.length > 0, `expected at least one <script> block in ${page}`);
  const script = scriptMatches[scriptMatches.length - 1][1];
  assert.ok(script.trim().length > 0, `extracted client script is empty in ${page}`);
  return script;
}

describe('admin rules/new — from-email field', () => {
  it('renders a from_email input that is required and email-format', () => {
    const source = readFileSync(RULES_NEW, 'utf-8');
    // Isolate the from_email input's attributes.
    const inputMatch = source.match(/<input[^>]*name="from_email"[^>]*>/);
    assert.ok(inputMatch, 'must render an input with name="from_email"');
    assert.match(inputMatch[0], /\brequired\b/, 'from_email input must be required');
    assert.match(inputMatch[0], /type="email"/, 'from_email input must use type="email"');
  });

  it('builds a provider→fromEmail map from availableProviders in the script', () => {
    const script = clientScript(RULES_NEW);
    assert.match(script, /fromEmail/, 'script must reference provider fromEmail');
    assert.match(script, /availableProviders/, 'script must reference availableProviders');
    assert.match(script, /providerFromEmail/, 'script must build a provider→fromEmail map');
  });

  it('wires a change handler that sets the from_email input from the selected provider default', () => {
    const script = clientScript(RULES_NEW);
    assert.match(script, /change/, 'script must have a change handler');
    assert.match(script, /provider_name/, 'change handler must listen on the provider select');
    assert.match(script, /from_email/, 'change handler must affect the from_email input');
  });
});
