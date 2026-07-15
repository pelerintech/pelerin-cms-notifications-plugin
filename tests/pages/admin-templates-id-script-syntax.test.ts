import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = join(__dirname, '../../src/pages/admin/templates/[id].astro');
// esbuild is a transitive dependency of Vite/Astro (the host provides it). It
// transforms the client `<script>` the same way the astro build strips types,
// so it is the correct tool to validate the script's syntax.
const ESBUILD = join(__dirname, '../../node_modules/esbuild/bin/esbuild');

/**
 * Regression guard: the client `<script>` in the templates/[id].astro page must be
 * syntactically valid. A SyntaxError (duplicate `const`, unbalanced braces,
 * etc.) disables the ENTIRE client script at parse time while any static
 * structure test still passes against the broken file.
 *
 * PARSE-TIME syntax check only — does NOT prove the script works in the
 * browser (runtime behaviour deferred to the Playwright E2E request). This is
 * the "lighter but known" tier for the genuinely-infeasible-until-E2E class.
 */
describe('admin templates/[id].astro page — client <script> syntax', () => {
  it('transforms with esbuild without a syntax/duplicate-declaration error', () => {
    const source = readFileSync(PAGE_PATH, 'utf-8');

    const scriptMatches = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
    assert.ok(
      scriptMatches.length > 0,
      'expected at least one <script> block in templates/[id].astro'
    );

    const clientScript = scriptMatches[scriptMatches.length - 1][1];
    assert.ok(clientScript.trim().length > 0, 'extracted client script is empty');

    const tmpDir = mkdtempSync(join(tmpdir(), 'astro-script-check-'));
    const tmpIn = join(tmpDir, 'client.ts');
    writeFileSync(tmpIn, clientScript, 'utf-8');

    let exitCode = 0;
    let combined = '';
    try {
      const out = execFileSync(ESBUILD, [tmpIn], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
      });
      combined = out;
    } catch (err: any) {
      exitCode = err.status ?? 1;
      combined = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    assert.equal(
      exitCode,
      0,
      `client <script> in templates/[id].astro has a syntax error — the entire client script is disabled at parse time.\nesbuild output:\n${combined}`
    );
  });
});
