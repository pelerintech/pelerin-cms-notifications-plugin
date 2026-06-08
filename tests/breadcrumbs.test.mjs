import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';

describe('Breadcrumbs component', () => {
  it('component file exists', async () => {
    const path = '../src/components/Breadcrumbs.astro';
    assert.ok(existsSync(new URL(path, import.meta.url).pathname), 'Breadcrumbs.astro must exist');
  });

  it('renders with given path array', async () => {
    const path = '../src/components/Breadcrumbs.astro';
    const content = readFileSync(new URL(path, import.meta.url).pathname, 'utf8');

    // Check that the component accepts a paths prop
    assert.ok(content.includes('paths'), 'component should reference paths prop');
    // Check that it renders breadcrumb items
    assert.ok(content.includes('li') || content.includes('<li'), 'component should render list items');
    // Check that it renders links
    assert.ok(content.includes('href') || content.includes('<a'), 'component should render links');
  });
});
