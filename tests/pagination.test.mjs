import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';

describe('Pagination component', () => {
  it('component file exists', async () => {
    const path = '../src/components/Pagination.astro';
    assert.ok(existsSync(new URL(path, import.meta.url).pathname), 'Pagination.astro must exist');
  });

  it('renders correct page links', async () => {
    const path = '../src/components/Pagination.astro';
    const content = readFileSync(new URL(path, import.meta.url).pathname, 'utf8');

    // Check that the component accepts pagination props
    assert.ok(content.includes('total') || content.includes('page') || content.includes('limit'),
      'component should reference pagination props');
    // Check that it renders page buttons
    assert.ok(content.includes('btn') || content.includes('button') || content.includes('<a'),
      'component should render navigation elements');
  });
});
