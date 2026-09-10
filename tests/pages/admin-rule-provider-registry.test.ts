import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Regression guard for the provider registry being empty on the rule pages.
 *
 * The rule pages call `listAvailableProvidersForChannel`, which reads the
 * in-memory provider registry. The registry is only populated by the module
 * side-effect of importing `providers/index.ts` (each provider module calls
 * `registerProvider` on import). Without that import the registry has zero
 * providers and the rule editor's provider dropdown is empty — even when a
 * provider (e.g. Brevo) is fully configured in `notification_settings`.
 */
const RULE_PAGES = [
  ['rules/new.astro', join(__dirname, '../../src/pages/admin/rules/new.astro')],
  ['rules/[id].astro', join(__dirname, '../../src/pages/admin/rules/[id].astro')],
  ['rules/index.astro', join(__dirname, '../../src/pages/admin/rules/index.astro')],
];

describe('rule pages trigger provider auto-registration', () => {
  for (const [name, path] of RULE_PAGES) {
    it(`${name} imports ../../../providers/index.ts so the dropdown populates`, () => {
      const source = readFileSync(path, 'utf-8');
      // Bare side-effect import (no `from`), e.g. `import '../../../providers/index.ts';`.
      assert.match(
        source,
        /import ['"]\.\.\/\.\.\/\.\.\/providers\/index\.ts['"]/,
        `${name} must import ../../../providers/index.ts to trigger provider auto-registration`
      );
    });
  }
});
