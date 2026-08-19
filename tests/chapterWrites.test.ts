import assert from 'node:assert/strict';
import test from 'node:test';
import { appendStageRecordWithRevision, deleteChapterWithActivity, deleteChaptersWithActivity, saveChapterWithRevision, updateChapterFields, voidStageRecordWithRevision, WriteResult } from '../src/utils/chapterWrites';
import { Chapter } from '../src/types';
import * as wrapper from '../src/utils/firestoreWrapper';

// Simple in-memory mock store for Firestore documents.
let mockStore: Record<string, any> = {};
let eventSequence = 0;

wrapper.setFirestoreReferenceResolversForTest(
  (_db, chapterId) => ({ id: chapterId } as any),
  () => ({ id: `event-${++eventSequence}` } as any),
);

// Mock runTransaction to simulate Firestore transaction behavior.
// Override the runTransaction implementation for testing using the provided setter.
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
    delete(ref: any) {
      delete mockStore[ref.id];
    },
  };
  return fn(transaction);
});

function resetMockStore() {
  mockStore = {};
  eventSequence = 0;
}

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

test('saveChapterWithRevision creates new chapter when none exists', async () => {
  resetMockStore();
  const incoming = minimalChapter({ id: 'CH01' });
  const result = await saveChapterWithRevision({} as any, incoming, 0, 'tester@example.com');
  assert.equal(result.kind, 'ok');
  assert.equal((result as any).new.dataRevision, 1);
});

test('saveChapterWithRevision updates existing chapter with matching revision', async () => {
  resetMockStore();
  // Prepopulate mock store with a chapter at revision 2.
  mockStore['CH02'] = minimalChapter({ id: 'CH02', dataRevision: 2, title: 'Existing' });
  const incoming = minimalChapter({ id: 'CH02', title: 'Updated Title', dataRevision: 2 });
  const result = await saveChapterWithRevision({} as any, incoming, 2, 'tester@example.com');
  assert.equal(result.kind, 'ok');
  const updated = mockStore['CH02'];
  assert.equal(updated.title, 'Updated Title');
  assert.equal(updated.dataRevision, 3);
});

test('saveChapterWithRevision returns unchanged without revision or activity changes', async () => {
  resetMockStore();
  const original = minimalChapter({ id: 'CH02', dataRevision: 4, title: 'Existing' });
  mockStore.CH02 = original;

  const result = await saveChapterWithRevision({} as any, { ...original }, 4, 'tester@example.com');

  assert.equal(result.kind, 'unchanged');
  assert.equal(mockStore.CH02.dataRevision, 4);
  assert.equal(Object.keys(mockStore).filter(key => key.startsWith('event-')).length, 0);
});

test('saveChapterWithRevision blocks unsafe synced references before writing', async () => {
  resetMockStore();
  await assert.rejects(() => saveChapterWithRevision({} as any, minimalChapter({ id: 'CH08', feedbackLink: 'file:///G:/feedback.docx' }), 0, 'tester@example.com'), /metadata or stage history/i);
  assert.equal(mockStore.CH08, undefined);
});

test('deleteChapterWithActivity refuses a stale chapter revision', async () => {
  resetMockStore();
  const stale = minimalChapter({ id: 'CH09', dataRevision: 2 });
  mockStore.CH09 = minimalChapter({ id: 'CH09', dataRevision: 3, title: 'New collaborator title' });
  const result = await deleteChapterWithActivity({} as any, stale, 'tester@example.com');
  assert.equal(result.kind, 'conflict');
  assert.equal(mockStore.CH09.title, 'New collaborator title');
});

test('batch delete validates every revision before deleting and writes one summary event', async () => {
  resetMockStore();
  const first = minimalChapter({ id: 'CH10', dataRevision: 1 });
  const second = minimalChapter({ id: 'CH11', dataRevision: 2 });
  mockStore.CH10 = first; mockStore.CH11 = second;
  const result = await deleteChaptersWithActivity({} as any, [first, second], 'tester@example.com');
  assert.equal(result.kind, 'ok');
  assert.equal(mockStore.CH10, undefined); assert.equal(mockStore.CH11, undefined);
  assert.equal(Object.keys(mockStore).filter(key => key.startsWith('event-')).length, 1);
});

test('saveChapterWithRevision returns conflict when revision mismatches', async () => {
  resetMockStore();
  mockStore['CH03'] = minimalChapter({ id: 'CH03', dataRevision: 5, title: 'Existing' });
  const incoming = minimalChapter({ id: 'CH03', title: 'Attempted Update', dataRevision: 2 });
  const result = await saveChapterWithRevision({} as any, incoming, 2, 'tester@example.com');
  assert.equal(result.kind, 'conflict');
  assert.equal((result as any).current.dataRevision, 5);
});

test('updateChapterFields updates fields and increments revision', async () => {
  resetMockStore();
  mockStore['CH04'] = minimalChapter({ id: 'CH04', dataRevision: 1, title: 'Old' });
  const result = await updateChapterFields({} as any, 'CH04', { title: 'New Title' }, 'tester@example.com');
  assert.equal(result.kind, 'ok');
  const updated = mockStore['CH04'];
  assert.equal(updated.title, 'New Title');
  assert.equal(updated.dataRevision, 2);
});

test('updateChapterFields returns conflict when chapter missing', async () => {
  resetMockStore();
  const result = await updateChapterFields({} as any, 'NON_EXISTENT', { title: 'X' }, 'tester@example.com');
  assert.equal(result.kind, 'conflict');
});

test('appendStageRecordWithRevision reports an exact active hash as duplicate', async () => {
  resetMockStore();
  const record = { id: 'r1', stage: 'revision' as const, roundNumber: 1, sourceSha256: 'same', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'tester@example.com', state: 'active' as const };
  mockStore.CH10 = minimalChapter({ id: 'CH10', dataRevision: 2, submissions: [record] });
  const result = await appendStageRecordWithRevision({} as any, 'CH10', { ...record, id: 'r2' }, 2, 'tester@example.com');
  assert.equal(result.kind, 'duplicate');
  assert.equal(mockStore.CH10.dataRevision, 2);
});

test('appendStageRecordWithRevision blocks an active record at the same workflow rank without activity', async () => {
  resetMockStore();
  const existing = { id: 'initial-1', stage: 'initial-manuscript' as const, sourceSha256: 'first-hash', effectiveOn: '2026-01-22', recordedAt: '2026-01-22T00:00:00Z', recordedBy: 'tester@example.com', state: 'active' as const };
  const incoming = { id: 'initial-2', stage: 'initial-manuscript' as const, sourceSha256: 'second-hash', effectiveOn: '2026-04-14', recordedAt: '2026-04-14T00:00:00Z', recordedBy: 'tester@example.com', state: 'active' as const };
  const originalRevision = 4;
  mockStore.CH01 = minimalChapter({ id: 'CH01', dataRevision: originalRevision, submissions: [existing] });

  const result = await appendStageRecordWithRevision({} as any, 'CH01', incoming, originalRevision, 'tester@example.com');

  assert.equal(result.kind, 'stage-conflict');
  assert.equal(mockStore.CH01.dataRevision, originalRevision);
  assert.equal(Object.keys(mockStore).filter(key => key.startsWith('event-')).length, 0);
  assert.deepEqual((result as any).conflictingRecords.map((record: any) => record.id), ['initial-1']);
});

test('voidStageRecordWithRevision requires a reason and keeps a voided audit trail', async () => {
  resetMockStore();
  const record = { id: 'r1', stage: 'revision' as const, roundNumber: 1, sourceSha256: 'hash', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'tester@example.com', state: 'active' as const };
  mockStore.CH11 = minimalChapter({ id: 'CH11', dataRevision: 3, revision01Submitted: 'Yes', submissions: [record] });
  await assert.rejects(() => voidStageRecordWithRevision({} as any, 'CH11', 'r1', '   ', 3, 'tester@example.com'), /reason is required/i);
  const result = await voidStageRecordWithRevision({} as any, 'CH11', 'r1', 'Wrong chapter file', 3, 'tester@example.com');
  assert.equal(result.kind, 'ok');
  assert.equal(mockStore.CH11.dataRevision, 4);
  assert.equal(mockStore.CH11.submissions[0].state, 'voided');
  assert.equal(mockStore.CH11.submissions[0].voidReason, 'Wrong chapter file');
  assert.equal(mockStore.CH11.revision01Submitted, 'No');
});
