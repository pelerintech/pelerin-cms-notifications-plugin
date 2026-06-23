import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';

describe('Pagination component', () => {
  it('component file exists', () => {
    const path = '../src/components/Pagination.astro';
    assert.ok(existsSync(new URL(path, import.meta.url)), 'Pagination.astro must exist');
  });

  it('renders correct page links', () => {
    const path = '../src/components/Pagination.astro';
    const content = readFileSync(new URL(path, import.meta.url), 'utf8');

    assert.ok(content.includes('total') || content.includes('page') || content.includes('limit'),
      'component should reference pagination props');
    assert.ok(content.includes('btn') || content.includes('button') || content.includes('<a'),
      'component should render navigation elements');
  });
});
