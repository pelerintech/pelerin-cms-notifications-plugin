import { test } from 'node:test';
import assert from 'node:assert';
import { matrix } from '../api/handlers/_matrix.ts';

test('matrix exports the four shared helpers as functions', () => {
  assert.equal(typeof matrix.adminAuthFail, 'function', 'adminAuthFail must be a function');
  assert.equal(typeof matrix.validationFail, 'function', 'validationFail must be a function');
  assert.equal(typeof matrix.happyPath, 'function', 'happyPath must be a function');
  assert.equal(typeof matrix.errorWrap, 'function', 'errorWrap must be a function');
});
