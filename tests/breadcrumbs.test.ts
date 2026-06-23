import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';

describe('Breadcrumbs component', () => {
  it('component file exists', () => {
    const path = '../src/components/Breadcrumbs.astro';
    assert.ok(existsSync(new URL(path, import.meta.url)), 'Breadcrumbs.astro must exist');
  });

  it('renders with given path array', () => {
    const path = '../src/components/Breadcrumbs.astro';
    const content = readFileSync(new URL(path, import.meta.url), 'utf8');

    assert.ok(content.includes('paths'), 'component should reference paths prop');
    assert.ok(content.includes('li') || content.includes('<li'), 'component should render list items');
    assert.ok(content.includes('href') || content.includes('<a'), 'component should render links');
  });
});
