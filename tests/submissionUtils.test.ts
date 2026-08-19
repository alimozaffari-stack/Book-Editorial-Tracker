import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionRecord, CreateSubmissionParams } from '../src/utils/submissionUtils';

test('createSubmissionRecord generates correct fields', () => {
  const params: CreateSubmissionParams = {
    stage: 'revision',
    revisionNumber: 2,
    sourceFileName: 'test.docx',
    sourceSizeBytes: 12345,
    sourceSha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    filesystemCreatedAt: '2023-01-01T00:00:00.000Z',
    filesystemModifiedAt: '2023-01-02T00:00:00.000Z',
    documentCreatedAt: undefined,
    documentModifiedAt: undefined,
    documentTitle: undefined,
    documentCreator: undefined,
    calculatedWordCount: 1000,
    wordCount: 950,
    wordCountSource: 'manual',
    submittedOn: '2023-01-03',
    recordedBy: 'tester@example.com',
  };
  const record = createSubmissionRecord(params);
  assert.equal(record.id, `revision:2:${params.sourceSha256}`);
  assert.equal(record.stage, 'revision');
  assert.equal(record.roundNumber, 2);
  assert.equal(record.sourceFileName, 'test.docx');
  assert.equal(record.wordCount, 950);
  assert.equal(record.wordCountSource, 'manual');
  assert.equal(record.recordedBy, 'tester@example.com');
  assert.equal(record.state, 'active');
});

test('createSubmissionRecord omits optional metadata that is unavailable', () => {
  const record = createSubmissionRecord({
    stage: 'initial-manuscript',
    sourceFileName: 'chapter.docx',
    sourceSizeBytes: 12345,
    sourceSha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    filesystemModifiedAt: '2023-01-02T00:00:00.000Z',
    calculatedWordCount: 1000,
    wordCount: 1000,
    wordCountSource: 'calculated',
    submittedOn: '2023-01-03',
    recordedBy: 'tester@example.com',
  });

  assert.ok(
    Object.values(record).every(value => value !== undefined),
    'Firestore-bound records must not contain undefined values',
  );
  assert.ok(!('roundNumber' in record));
  assert.ok(!('sourceRelativePath' in record));
  assert.ok(!('documentTitle' in record));
});
