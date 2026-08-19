import assert from 'node:assert/strict';
import test from 'node:test';
import { hasStageSourceReference } from '../src/components/StageSourceActions';

test('stage source controls accept either a project-relative path or a file hash', () => {
  assert.equal(hasStageSourceReference({ sourceRelativePath: 'CH01/Initial/file.docx' }), true);
  assert.equal(hasStageSourceReference({ sourceSha256: 'a'.repeat(64) }), true);
  assert.equal(hasStageSourceReference({}), false);
});
