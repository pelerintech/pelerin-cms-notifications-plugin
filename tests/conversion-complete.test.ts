import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url).pathname;

test('no .mjs files remain under src/', () => {
  const result = execSync(`find ${ROOT}src -name '*.mjs'`, { encoding: 'utf-8' }).trim();
  assert.strictEqual(result, '', `expected no .mjs files under src/, found:\n${result}`);
});

test('no .mjs files remain under tests/', () => {
  const result = execSync(`find ${ROOT}tests -name '*.mjs'`, { encoding: 'utf-8' }).trim();
  assert.strictEqual(result, '', `expected no .mjs files under tests/, found:\n${result}`);
});

test('every apiEndpoints entrypoint ends in .ts and the file exists', () => {
  const manifest = JSON.parse(readFileSync(new URL('../pelerin.manifest.json', import.meta.url), 'utf-8'));
  for (const ep of manifest.apiEndpoints) {
    assert.ok(ep.entrypoint.endsWith('.ts'), `entrypoint ${ep.entrypoint} should end in .ts`);
    assert.ok(existsSync(new URL('../' + ep.entrypoint.replace('./', ''), import.meta.url)),
      `entrypoint file ${ep.entrypoint} should exist`);
  }
});

test('no getTable string appears anywhere under src/', () => {
  const result = execSync(`grep -rl 'getTable' ${ROOT}src 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
  assert.strictEqual(result, '', `getTable should not appear under src/, found in:\n${result}`);
});

test('no _rulesStore or _settingsStore in-memory Map remains under src/ (except settings endpoint fallback)', () => {
  // The settings endpoint keeps its in-memory Map fallback (deferred to follow-up request).
  // No other file should have _rulesStore or _settingsStore.
  const result = execSync(`grep -rl '_rulesStore\\|_settingsStore' ${ROOT}src 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
  const files = result ? result.split('\n').filter(Boolean) : [];
  const nonSettingsFiles = files.filter(f => !f.includes('settings.ts'));
  assert.deepStrictEqual(nonSettingsFiles, [], `_rulesStore/_settingsStore should only be in settings.ts, found in: ${nonSettingsFiles.join(', ')}`);
});
