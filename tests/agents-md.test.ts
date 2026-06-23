import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';

test('AGENTS.md exists and is non-empty', () => {
  assert.ok(existsSync(new URL('../AGENTS.md', import.meta.url)));
  const src = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf-8');
  assert.ok(src.length > 100, 'AGENTS.md should be non-trivial');
});

test('AGENTS.md has the data access layer mandate section', () => {
  const src = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf-8');
  assert.ok(src.includes('Data access layer (`src/lib/data/`) — mandatory pattern'),
    'must have the data access layer mandate section');
  assert.ok(src.includes('db') && src.includes('first param'),
    'must state accessors receive db as first param');
  assert.ok(src.includes('must NOT write queries inline') || src.includes('must not write queries inline'),
    'must state endpoints must not write queries inline');
});

test('AGENTS.md documents the db injection seam', () => {
  const src = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf-8');
  assert.ok(src.includes('import { db } from \'astro:db\''),
    'must document endpoints use import { db } from astro:db');
  assert.ok(src.includes('ctx.db'),
    'must document init.ts uses ctx.db');
});

test('AGENTS.md documents the test harness and parity guard', () => {
  const src = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf-8');
  assert.ok(src.includes('tests/db/harness.ts'), 'must reference the harness');
  assert.ok(src.includes('schema-parity.test.ts'), 'must reference the parity test');
  assert.ok(src.includes('schema.ts') && src.includes('config.ts'),
    'must document the schema.ts/config.ts dual-definition');
});

test('AGENTS.md documents the dispatch flow', () => {
  const src = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf-8');
  assert.ok(src.includes('findActiveRulesMatching'));
  assert.ok(src.includes('getTemplate'));
  assert.ok(src.includes('interpolate'));
  assert.ok(src.includes('resolveRecipients'));
  assert.ok(src.includes('provider.send'));
  assert.ok(src.includes('createLog'));
});

test('AGENTS.md documents known gaps / follow-up for provider settings', () => {
  const src = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf-8');
  assert.ok(src.includes('Known gaps') || src.includes('follow-up'),
    'must have a known gaps / follow-up section');
  assert.ok(src.includes('process.env'), 'must note providers read process.env only');
  assert.ok(src.includes('placeholder') || src.includes('base64'), 'must note placeholder crypto');
  assert.ok(src.includes('settings.ts'), 'must mention the settings accessor');
  assert.ok(src.includes('notifications-provider-settings'),
    'must reference the follow-up request name');
});
