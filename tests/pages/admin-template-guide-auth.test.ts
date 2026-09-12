/**
 * Markup test — the template editor pages must document the auth (CMS) and
 * invoice event payload fields so admins can write correct templates.
 *
 * Order/invoice fields (`data.order.*`, `data.items`) are already documented;
 * this asserts the auth fields (`data.user.email`, `data.user.name`, `data.url`)
 * are present on both the create and edit template pages.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_NEW = join(__dirname, '../../src/pages/admin/templates/new.astro');
const TEMPLATES_EDIT = join(__dirname, '../../src/pages/admin/templates/[id].astro');

const AUTH_FIELDS = ['data.user.email', 'data.user.name', 'data.url'];

const ORDER_FIELDS = ['data.order.order_number', 'data.items'];

for (const [label, page] of [
  ['templates/new.astro', TEMPLATES_NEW],
  ['templates/[id].astro', TEMPLATES_EDIT],
] as const) {
  describe(`admin ${label} — auth + invoice payload reference`, () => {
    it('documents the auth event fields (data.user.*, data.url)', () => {
      const source = readFileSync(page, 'utf-8');
      for (const field of AUTH_FIELDS) {
        assert.ok(source.includes(field), `${label} should document auth field "${field}"`);
      }
    });

    it('documents the order/invoice fields (data.order.*, data.items)', () => {
      const source = readFileSync(page, 'utf-8');
      for (const field of ORDER_FIELDS) {
        assert.ok(
          source.includes(field),
          `${label} should document order/invoice field "${field}"`
        );
      }
    });
  });
}
