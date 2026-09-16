import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_EDIT = join(__dirname, '../../src/pages/admin/templates/[id].astro');

describe('admin templates/[id] — edit form loads the template', () => {
  it('frontmatter calls getTemplate to load the template', () => {
    const source = readFileSync(TEMPLATES_EDIT, 'utf-8');
    assert.match(
      source,
      /getTemplate\s*\(/,
      'frontmatter must call getTemplate to load the template'
    );
  });

  it('pre-fills the name input from the loaded template', () => {
    const source = readFileSync(TEMPLATES_EDIT, 'utf-8');
    assert.match(source, /template\??\.name/, 'name input must be pre-filled from template.name');
    assert.match(source, /name="name"/, 'must render a name input');
  });

  it('pre-fills subject, body_html, and body_text from the loaded template', () => {
    const source = readFileSync(TEMPLATES_EDIT, 'utf-8');
    assert.match(
      source,
      /template\??\.subject/,
      'subject must be pre-filled from template.subject'
    );
    assert.match(
      source,
      /template\??\.body_html/,
      'body_html must be pre-filled from template.body_html'
    );
    assert.match(
      source,
      /template\??\.body_text/,
      'body_text must be pre-filled from template.body_text'
    );
  });

  it('handles the missing-template case gracefully (does not render a blank editable form)', () => {
    const source = readFileSync(TEMPLATES_EDIT, 'utf-8');
    // A guard on the not-found case must reference `template` truthiness somewhere.
    assert.match(
      source,
      /template\s*&&|if\s*\(!?\s*template|template\?\?/,
      'must guard the missing-template case'
    );
  });
});
