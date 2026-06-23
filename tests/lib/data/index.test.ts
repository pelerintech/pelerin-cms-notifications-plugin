import { test } from 'node:test';
import assert from 'node:assert';
import * as data from '../../../src/lib/data/index.ts';

test('data barrel exports all rule accessors', () => {
  assert.strictEqual(typeof data.listRules, 'function');
  assert.strictEqual(typeof data.getRule, 'function');
  assert.strictEqual(typeof data.createRule, 'function');
  assert.strictEqual(typeof data.updateRule, 'function');
  assert.strictEqual(typeof data.deleteRule, 'function');
  assert.strictEqual(typeof data.findActiveRulesMatching, 'function');
});

test('data barrel exports all template accessors', () => {
  assert.strictEqual(typeof data.listTemplates, 'function');
  assert.strictEqual(typeof data.getTemplate, 'function');
  assert.strictEqual(typeof data.createTemplate, 'function');
  assert.strictEqual(typeof data.updateTemplate, 'function');
  assert.strictEqual(typeof data.deleteTemplate, 'function');
});

test('data barrel exports all log accessors', () => {
  assert.strictEqual(typeof data.listLogs, 'function');
  assert.strictEqual(typeof data.getLog, 'function');
  assert.strictEqual(typeof data.createLog, 'function');
});

test('data barrel exports all settings accessors', () => {
  assert.strictEqual(typeof data.getSetting, 'function');
  assert.strictEqual(typeof data.setSetting, 'function');
  assert.strictEqual(typeof data.listSettingsForProvider, 'function');
});
