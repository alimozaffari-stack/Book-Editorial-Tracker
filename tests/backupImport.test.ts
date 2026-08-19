import assert from 'node:assert/strict';
import test from 'node:test';
import { backupCollectionCounts, chaptersFromBackup } from '../src/domain/backupImport';
import { createChapter } from '../src/utils/chapterImport';

test('chaptersFromBackup accepts and normalizes only the chapter collection', () => {
  const chapters = chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author' }], users: [{ id: 'u' }] } });
  assert.deepEqual(chapters, [createChapter({ id: 'CH01', title: 'One', contributorName: 'Author' })]);

  const v2Chapters = chaptersFromBackup({
    format: 'editorial-review-tracker-backup',
    version: 2,
    project: {
      name: 'Project',
      generationId: 'g1',
      startedAt: '2026-08-11T00:00:00.000Z',
      startedBy: 'owner@example.com',
      updatedAt: '2026-08-12T00:00:00.000Z',
    },
    collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author' }], users: [{ id: 'u' }] },
  });
  assert.deepEqual(v2Chapters, [createChapter({ id: 'CH01', title: 'One', contributorName: 'Author' })]);
});

test('chaptersFromBackup accepts version 2 backup without top-level project metadata', () => {
  assert.deepEqual(chaptersFromBackup({
    format: 'editorial-review-tracker-backup',
    version: 2,
    collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author' }] },
  }), [createChapter({ id: 'CH01', title: 'One', contributorName: 'Author' })]);
});

test('chaptersFromBackup rejects invalid top-level project metadata when provided', () => {
  assert.throws(() => chaptersFromBackup({
    format: 'editorial-review-tracker-backup',
    version: 2,
    project: { name: '', generationId: 'g1', startedAt: '2026-08-11T00:00:00.000Z', startedBy: 'owner@example.com', updatedAt: '2026-08-12T00:00:00.000Z' },
    collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author' }] },
  }), /project/i);
});

test('chaptersFromBackup rejects malformed backups', () => {
  assert.throws(() => chaptersFromBackup({ format: 'other', version: 1, collections: { chapters: [] } }));
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 3, collections: { chapters: [] } }), /format/i);
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{}] } }));
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author', folderUrl: 'G:\\Book\\C01' }] } }), /reference/i);
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author', feedbackLink: 'file:///G:/Book/feedback.docx' }] } }), /reference/i);
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author', feedbackSent: 42 }] } }), /invalid chapter/i);
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author', submissions: [{ id: 'x', stage: 'wrong' }] }] } }), /stage history/i);
  const invalidRecord = (changes: Record<string, unknown>) => ({ id: 'x', stage: 'revision', roundNumber: 1, effectiveOn: '2026-08-13', recordedAt: '2026-08-13T00:00:00Z', recordedBy: 'editor@example.com', state: 'active', ...changes });
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author', submissions: [invalidRecord({ effectiveOn: 'not-a-date' })] }] } }), /stage history/i);
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author', submissions: [invalidRecord({ roundNumber: 1.5 })] }] } }), /stage history/i);
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author', submissions: [invalidRecord({ roundNumber: undefined })] }] } }), /stage history/i);
  assert.throws(() => chaptersFromBackup({ format: 'editorial-review-tracker-backup', version: 1, collections: { chapters: [{ id: 'CH01', title: 'One', contributorName: 'Author', submissions: [invalidRecord({ sourceFileName: 'C:\\secret.docx' })] }] } }), /stage history/i);
});

test('backupCollectionCounts reports users and activity as informational only', () => {
  assert.deepEqual(backupCollectionCounts({ collections: { chapters: [1], users: [1, 2], auditEvents: [1, 2, 3] } }), { chapters: 1, users: 2, auditEvents: 3 });
});
