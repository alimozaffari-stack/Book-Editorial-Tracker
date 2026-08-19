import assert from 'node:assert/strict';
import test from 'node:test';
import { isSafeProjectReference } from '../src/domain/projectReference';

test('accepts HTTPS and project-relative references', () => {
  assert.equal(isSafeProjectReference('https://drive.google.com/folder/abc'), true);
  assert.equal(isSafeProjectReference('C01/01 Initial manuscript'), true);
  assert.equal(isSafeProjectReference(''), true);
});

test('rejects local absolute, UNC, file URL, and traversal references', () => {
  for (const value of ['G:\\Book\\C01', '\\\\server\\share', 'C01\\Revision', 'file:///G:/Book', '/absolute/path', '../outside', 'C01/../../outside']) assert.equal(isSafeProjectReference(value), false, value);
});
