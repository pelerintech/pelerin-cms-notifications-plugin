import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_NEW = join(__dirname, '../../src/pages/admin/rules/new.astro');
const TEMPLATES_NEW = join(__dirname, '../../src/pages/admin/templates/new.astro');
const TEMPLATES_EDIT = join(__dirname, '../../src/pages/admin/templates/[id].astro');

function clientScript(page: string): string {
  const source = readFileSync(page, 'utf-8');
  const scriptMatches = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scriptMatches.length > 0, `expected at least one <script> block in ${page}`);
  const script = scriptMatches[scriptMatches.length - 1][1];
  assert.ok(script.trim().length > 0, `extracted client script is empty in ${page}`);
  return script;
}

function formHasNativeAction(page: string): boolean {
  const source = readFileSync(page, 'utf-8');
  const formMatches = [...source.matchAll(/<form[\s\S]*?>/gi)];
  for (const m of formMatches) {
    if (/\baction\s*=/.test(m[0])) return true;
  }
  return false;
}

describe('admin rules/new — recipient field guidance', () => {
  it('the to field documents {{ field }} and plain-substitution-only', () => {
    const source = readFileSync(RULES_NEW, 'utf-8');
    // Helper text is HTML-encoded (&#123;&#123;) and the placeholder uses literal {{ customer_email }}.
    assert.match(source, /&#123;&#123; field &#125;&#125;/, 'to field should hint at {{ field }}');
    assert.match(source, /plain substitution only/i, 'to field should mention plain substitution');
  });

  it('the cc and bcc fields carry a hint', () => {
    const source = readFileSync(RULES_NEW, 'utf-8');
    assert.match(source, /name="cc"/);
    assert.match(source, /name="bcc"/);
    const mentions = (source.match(/&#123;&#123; field &#125;&#125;/g) || []).length;
    assert.ok(mentions >= 3, `expected field hint on to/cc/bcc (got ${mentions})`);
  });
});

describe('admin rules/new — create form saves JSON and redirects', () => {
  it('has a client script using preventDefault + fetch to /rules/create', () => {
    const script = clientScript(RULES_NEW);
    assert.ok(/preventDefault/.test(script), 'script must call preventDefault');
    assert.ok(/fetch\s*\(/.test(script), 'script must use fetch');
    assert.ok(
      /\/api\/plugins\/notifications\/rules\/create/.test(script),
      'script must POST to /rules/create'
    );
    assert.match(script, /JSON\.stringify/, 'script must stringify a JSON body');
    assert.ok(
      /Content-Type['"]?\s*:\s*['"]application\/json/.test(script),
      'must send JSON content type'
    );
    assert.ok(/window\.location\.href/.test(script), 'script must redirect on success');
  });

  it('does not rely on a native form action navigation to the API route', () => {
    assert.equal(
      formHasNativeAction(RULES_NEW),
      false,
      'rules/new form must not use a native action attribute (it would navigate to the API URL)'
    );
  });

  it('coerces the active checkbox to a boolean', () => {
    const script = clientScript(RULES_NEW);
    assert.ok(/active/.test(script), 'script should handle the active field');
  });

  it('surfaces the validation fields map on error', () => {
    const script = clientScript(RULES_NEW);
    assert.match(script, /\.fields/, 'script must surface the returned fields map');
    assert.match(
      script,
      /Object\.entries\(.*fields\)|JSON\.stringify\(.*fields\)/,
      'script must render fields into the surfaced error message'
    );
  });

  it('does not swallow the fields map via operator precedence', () => {
    const script = clientScript(RULES_NEW);
    // fieldErrors must be appended to a parenthesized error expression, not to the
    // `|| 'Fallback' + fieldErrors` string — the `+`-binds-tighter-than-`||` bug
    // evaluates that as `'Fallback' + fieldErrors` and discards the field list
    // whenever `err.error` is truthy.
    assert.match(
      script,
      /\)\s*\+\s*fieldErrors/,
      'fieldErrors must be appended after a closing parenthesized error expression'
    );
    assert.doesNotMatch(
      script,
      /\|\|\s*['"][^'"]*['"]\s*\+\s*fieldErrors/,
      'the fallback string must not swallow fieldErrors via operator precedence'
    );
  });
});

describe('admin template editor — syntax + available-variables reference', () => {
  it('documents the syntax ({{ }}, {{{ }}}, #if, #each, helpers) on both new and edit pages', () => {
    const fields = [TEMPLATES_NEW, TEMPLATES_EDIT];
    for (const page of fields) {
      const source = readFileSync(page, 'utf-8');
      assert.match(source, /&#123;&#123;&#123;/, 'should document raw {{ }} triple-stash');
      assert.match(source, /#if/i, 'should document #if conditional');
      assert.match(source, /#each/i, 'should document #each loop');
      assert.match(source, /formatMoney/i, 'should document the formatMoney helper');
      assert.match(source, /formatDate/i, 'should document the formatDate helper');
    }
  });

  it('lists available variables for order events on both new and edit pages', () => {
    for (const page of [TEMPLATES_NEW, TEMPLATES_EDIT]) {
      const source = readFileSync(page, 'utf-8');
      assert.match(source, /data\.order\.order_number/, 'should list data.order.order_number');
      assert.match(source, /data\.shipping_address/, 'should list data.shipping_address');
      assert.match(source, /data\.items/, 'should list data.items');
      assert.match(source, /pickup_location/, 'should list pickup_location');
    }
  });
});

describe('admin templates/new — create form saves JSON and redirects', () => {
  it('has a client script using preventDefault + fetch to /templates/create', () => {
    const script = clientScript(TEMPLATES_NEW);
    assert.ok(/preventDefault/.test(script), 'script must call preventDefault');
    assert.ok(/fetch\s*\(/.test(script), 'script must use fetch');
    assert.ok(
      /\/api\/plugins\/notifications\/templates\/create/.test(script),
      'script must POST to /templates/create'
    );
    assert.match(script, /JSON\.stringify/, 'script must stringify a JSON body');
    assert.ok(/window\.location\.href/.test(script), 'script must redirect on success');
  });

  it('does not rely on a native form action navigation to the API route', () => {
    assert.equal(
      formHasNativeAction(TEMPLATES_NEW),
      false,
      'templates/new form must not use a native action attribute'
    );
  });

  it('surfaces the validation fields map on error', () => {
    const script = clientScript(TEMPLATES_NEW);
    assert.match(script, /\.fields/, 'script must surface the returned fields map');
    assert.match(
      script,
      /Object\.entries\(.*fields\)|JSON\.stringify\(.*fields\)/,
      'script must render fields into the surfaced error message'
    );
  });

  it('does not swallow the fields map via operator precedence', () => {
    const script = clientScript(TEMPLATES_NEW);
    assert.match(
      script,
      /\)\s*\+\s*fieldErrors/,
      'fieldErrors must be appended after a closing parenthesized error expression'
    );
    assert.doesNotMatch(
      script,
      /\|\|\s*['"][^'"]*['"]\s*\+\s*fieldErrors/,
      'the fallback string must not swallow fieldErrors via operator precedence'
    );
  });
});
