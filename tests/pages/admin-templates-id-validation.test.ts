import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_EDIT = join(__dirname, '../../src/pages/admin/templates/[id].astro');

function clientScript(page: string): string {
  const source = readFileSync(page, 'utf-8');
  const scriptMatches = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scriptMatches.length > 0, `expected at least one <script> block in ${page}`);
  const script = scriptMatches[scriptMatches.length - 1][1];
  assert.ok(script.trim().length > 0, `extracted client script is empty in ${page}`);
  return script;
}

describe('admin templates/[id] — edit form surfaces validation fields', () => {
  it('builds a fieldErrors list from the returned fields map', () => {
    const script = clientScript(TEMPLATES_EDIT);
    assert.match(script, /\.fields/, 'script must read the returned fields map');
    assert.match(script, /Object\.entries\(.*fields\)/, 'script must render fields into a message');
  });

  it('appends fieldErrors to the alert message (not dropped)', () => {
    const script = clientScript(TEMPLATES_EDIT);
    assert.match(
      script,
      /\)\s*\+\s*fieldErrors/,
      'fieldErrors must be appended after the parenthesized error expression'
    );
    assert.doesNotMatch(
      script,
      /\|\|\s*['"][^'"]*['"]\s*\+\s*fieldErrors/,
      'the fallback string must not swallow fieldErrors via operator precedence'
    );
  });
});
