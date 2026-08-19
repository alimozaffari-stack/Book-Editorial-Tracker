import assert from 'node:assert/strict';
import test from 'node:test';
import { appendStageRecordWithRevision, saveChapterWithRevision, WriteResult } from '../src/utils/chapterWrites';
import { createSubmissionRecord, CreateSubmissionParams } from '../src/utils/submissionUtils';
import { Chapter } from '../src/types';
import * as wrapper from '../src/utils/firestoreWrapper';

/**
 * In-memory mock store for Firestore documents used by the mocked runTransaction.
 */
let mockStore: Record<string, any> = {};

wrapper.setFirestoreReferenceResolversForTest(
  (_db, id) => ({ id } as any),
  () => ({ id: 'event' } as any),
);

// Mock runTransaction to simulate Firestore transaction behavior.
wrapper.setRunTransaction(async (db: any, fn: (tx: any) => Promise<any>) => {
  const transaction = {
    async get(ref: any) {
      const id = ref.id;
      const data = mockStore[id];
      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    },
    set(ref: any, data: any) {
      mockStore[ref.id] = data;
    },
  };
  return fn(transaction);
});

function resetMockStore() {
  mockStore = {};
}

/** Helper to create a minimal Chapter object for tests. */
function minimalChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'CHXX',
    contributorId: 'CXX',
    contributorName: 'Test',
    contributorEmail: 'test@example.com',
    title: 'Test',
    folderUrl: '',
    leadEditor: '',
    initialAbstractSubmitted: 'No',
    updatedAbstractSubmitted: 'No',
    initialChapterSubmission: 'No',
    initialChapterDate: '',
    submittedWordCount: '0',
    followUpForInitialSubmission: 'No',
    followUpDate: '',
    feedbackSent: 'No',
    dateFeedbackSent: '',
    feedbackLink: '',
    revision01Submitted: 'No',
    dateRevision01Submitted: '',
    // Additional required fields from the extended Chapter type
    followUpContacted: 'No',
    dateFollowUpContacted: '',
    decisionToProceed: 'Yes',
    reasonIfNo: '',
    imageListSubmitted: 'No',
    imagesMeetQc: 'No',
    indexingTermsSubmitted: 'No',
    // Optional concurrency fields default to undefined
    dataRevision: undefined,
    updatedAt: undefined,
    updatedBy: undefined,
    submissions: undefined,
    ...overrides,
  } as Chapter;
}

/** Sample parameters for creating a SubmissionRecord. */
const sampleParams: CreateSubmissionParams = {
  stage: 'revision',
  revisionNumber: 1,
  sourceFileName: 'sample.docx',
  sourceSizeBytes: 1234,
  sourceSha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
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

test('integration: appends a manual stage record to a new chapter', async () => {
  resetMockStore();
  const chapter = minimalChapter({ id: 'CH01' });
  const submission = createSubmissionRecord(sampleParams);
  mockStore['CH01'] = chapter;
  const result: WriteResult = await appendStageRecordWithRevision({} as any, 'CH01', submission, 0, 'tester@example.com');
  assert.equal(result.kind, 'ok');
  const saved = mockStore['CH01'];
  assert.ok(Array.isArray(saved.submissions), 'submissions array should exist');
  assert.equal(saved.submissions?.length, 1, 'should contain one submission');
  assert.equal(saved.submissions?.[0].id, submission.id, 'submission id should match');
});

test('integration: general save preserves server-current stage history', async () => {
  resetMockStore();
  const persisted = createSubmissionRecord(sampleParams);
  mockStore['CH03'] = minimalChapter({ id: 'CH03', dataRevision: 1, submissions: [persisted] });
  const incoming = minimalChapter({ id: 'CH03', dataRevision: 1, title: 'Edited title' });

  const result = await saveChapterWithRevision({} as any, incoming, 1, 'tester@example.com');

  assert.equal(result.kind, 'ok');
  assert.deepEqual(mockStore['CH03'].submissions, [persisted]);
});

test('integration: conflict when adding submission with stale revision', async () => {
  resetMockStore();
  // First, save a chapter with a submission (revision 1).
  const chapter = minimalChapter({ id: 'CH02' });
  const submission = createSubmissionRecord(sampleParams);
  const updatedChapter: Chapter = { ...chapter, submissions: [submission] };
  const firstResult: WriteResult = await saveChapterWithRevision({} as any, updatedChapter, 0, 'tester@example.com');
  assert.equal(firstResult.kind, 'ok');
  // Now attempt to add another submission but use an outdated expectedRevision (0).
  const secondSubmission = createSubmissionRecord({ ...sampleParams, revisionNumber: 2, sourceSha256: 'cafebabe' + sampleParams.sourceSha256.slice(8) });
  const staleChapter: Chapter = { ...chapter, submissions: [submission, secondSubmission] };
  const conflictResult: WriteResult = await saveChapterWithRevision({} as any, staleChapter, 0, 'tester@example.com');
  assert.equal(conflictResult.kind, 'conflict');
  // The current document should have dataRevision 1 (incremented by the first save).
  assert.equal((conflictResult as any).current.dataRevision, 1);
});
