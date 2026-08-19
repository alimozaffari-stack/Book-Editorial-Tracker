import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVENTORY_CREATION_ERROR_BATCH_LIMIT,
  INVENTORY_CREATION_ERROR_EXISTING,
  INVENTORY_CREATION_ERROR_INVALID,
  INVENTORY_CREATION_ERROR_UNKNOWN,
  mapInventoryCreateErrorMessage,
} from '../src/components/BackupIntakeView';
import type { Chapter } from '../src/types';
import {
  buildChapterInventoryRows,
  canCreateFromInventoryRows,
  ChapterInventoryRow,
  chapterInventoryRowsToChapters,
  planProjectImport,
  recalculateProjectImport,
  validateChapterInventoryRows,
} from '../src/domain/projectImportPlan';
import { createChapter } from '../src/utils/chapterImport';

test('buildChapterInventoryRows groups unmatched files and keeps only safe metadata', () => {
  const scan = {
    displayLabel: 'Scan root',
    chapterFolders: [
      {
        name: 'C01 Draft',
        stageFolders: [
          { name: 'Revision 01', files: [
            { relativePath: 'C01/Revision/file-1.docx', extension: '.docx', sizeBytes: 120, filesystemModifiedAt: '2026-01-01T00:00:00Z' },
            { relativePath: 'C01/Revision/file-2.docx', extension: '.docx', sizeBytes: 121, filesystemModifiedAt: '2026-01-01T00:00:00Z' },
          ] },
        ],
      },
      {
        name: 'C02 Existing',
        stageFolders: [
          { name: 'Revision 01', files: [{ relativePath: 'C02/Revision/file.docx', extension: '.docx', sizeBytes: 10, filesystemModifiedAt: '2026-01-01T00:00:00Z' }] },
        ],
      },
      {
        name: 'C03 Badpath',
        stageFolders: [
          { name: 'Revision 01', files: [{ relativePath: 'C03/../bad/path/file.docx', extension: '.docx', sizeBytes: 4, filesystemModifiedAt: '2026-01-01T00:00:00Z' }] },
        ],
      },
    ],
  };
  const before = planProjectImport(scan, [createChapter({ id: 'CH02', title: 'Existing', contributorName: 'Owner' })]);
  const rows = buildChapterInventoryRows(before);
  assert.equal(rows.length, 2);

  const ch01 = rows.find((row) => row.chapterId === 'CH01');
  assert.equal(ch01?.discoveredFileCount, 2);
  assert.equal(ch01?.title, '');
  assert.equal(ch01?.contributorName, '');
  assert.equal(ch01?.submissionReference, 'C01/Revision');

  const ch03 = rows.find((row) => row.chapterId === 'CH03');
  assert.equal(ch03?.submissionReference, '');
  assert.equal(ch03?.title, '');
  assert.equal(ch03?.contributorName, '');
});

test('inventory rows reject duplicate, existing, missing metadata, and unsafe references', () => {
  const existing = [createChapter({ id: 'CH01', title: 'Existing', contributorName: 'Owner' })];
  const rows: ChapterInventoryRow[] = [
    {
      chapterId: 'CH01',
      title: 'Alpha',
      contributorName: 'One',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
    {
      chapterId: 'CH02',
      title: 'Beta',
      contributorName: 'Two',
      submissionReference: 'unsafe/../ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
    {
      chapterId: 'CH03',
      title: 'Gamma',
      contributorName: '',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
    {
      chapterId: 'CH04',
      title: 'Delta',
      contributorName: 'Four',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
    {
      chapterId: 'ch04',
      title: 'Delta v2',
      contributorName: 'Four',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
  ];

  const validated = validateChapterInventoryRows(rows, existing);
  assert.equal(validated[0].validationError, 'This chapter ID already exists in the tracker.');
  assert.equal(validated[1].validationError, 'Submission reference must be a safe project reference.');
  assert.equal(validated[2].validationError, 'Contributor name is required.');
  assert.equal(validated[3].validationError, 'Chapter IDs in the proposal must be unique.');
  assert.equal(validated[4].validationError, 'Chapter IDs in the proposal must be unique.');
});

test('unchecked duplicate inventory IDs do not block checked valid rows', () => {
  const existing: Chapter[] = [];
  const rows: ChapterInventoryRow[] = [
    {
      chapterId: 'CH-01',
      title: 'First',
      contributorName: 'Alpha',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: false,
      validationError: '',
    },
    {
      chapterId: 'CH-01',
      title: 'Second',
      contributorName: 'Beta',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
    {
      chapterId: 'CH-02',
      title: 'Third',
      contributorName: 'Gamma',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
  ];

  const validated = validateChapterInventoryRows(rows, existing);
  assert.equal(validated[0].validationError, '');
  assert.equal(validated[1].validationError, '');
  assert.equal(validated[2].validationError, '');
  assert.equal(canCreateFromInventoryRows(validated), true);
  assert.equal(chapterInventoryRowsToChapters(validated).length, 2);
});

test('inventory creation is blocked when more than 50 rows are selected', () => {
  const rows = Array.from({ length: 51 }, (_, index) => ({
    chapterId: `CH-${String(index + 1).padStart(2, '0')}`,
    title: 'Title',
    contributorName: 'Contrib',
    submissionReference: 'safe/ref',
    discoveredFileCount: 1,
    selected: true,
    validationError: '',
  }));
  const validated = validateChapterInventoryRows(rows, []);
  assert.equal(canCreateFromInventoryRows(validated), false);
});

test('inventory create error mapping uses stable messages', () => {
  assert.equal(
    mapInventoryCreateErrorMessage(new Error('Nothing was created. A selected chapter already exists; reload the scan and review the inventory again.')),
    INVENTORY_CREATION_ERROR_EXISTING,
  );
  assert.equal(
    mapInventoryCreateErrorMessage(new Error('The selected ID is already recorded')),
    INVENTORY_CREATION_ERROR_EXISTING,
  );
  assert.equal(
    mapInventoryCreateErrorMessage(new Error('unsafe payload detected')),
    INVENTORY_CREATION_ERROR_UNKNOWN,
  );
  assert.equal(mapInventoryCreateErrorMessage(new Error('validation')), INVENTORY_CREATION_ERROR_UNKNOWN);
  assert.equal(mapInventoryCreateErrorMessage('not-an-error'), INVENTORY_CREATION_ERROR_UNKNOWN);
});

test('inventory batch-limit message includes exact row maximum', () => {
  assert.equal(INVENTORY_CREATION_ERROR_BATCH_LIMIT.includes('50'), true);
  assert.equal(INVENTORY_CREATION_ERROR_INVALID.includes('highlighted inventory fields'), true);
  assert.equal(INVENTORY_CREATION_ERROR_UNKNOWN.includes('Check the project file or connection'), true);
});

test('only selected valid inventory rows become new chapters and preserve unselected inventory state', () => {
  const rows: ChapterInventoryRow[] = [
    {
      chapterId: 'CH01',
      title: 'Alpha',
      contributorName: 'One',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
    {
      chapterId: 'CH02',
      title: '',
      contributorName: 'Two',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: true,
      validationError: '',
    },
    {
      chapterId: 'CH03',
      title: 'Gamma',
      contributorName: 'Three',
      submissionReference: 'safe/ref',
      discoveredFileCount: 1,
      selected: false,
      validationError: '',
    },
  ];
  const validated = validateChapterInventoryRows(rows, []);
  const created = chapterInventoryRowsToChapters(validated);
  assert.equal(canCreateFromInventoryRows(validated), false);
  assert.equal(created.length, 1);
  assert.equal(created[0].id, 'CH01');
  assert.equal(validated[2].chapterId, 'CH03');
  assert.equal(validated[2].selected, false);
});

test('recalculates unmatched row state after chapter creation so affected rows are unselected', () => {
  const scan = {
    displayLabel: 'Scan root',
    chapterFolders: [
      {
        name: 'C01 Draft',
        stageFolders: [{ name: 'Revision 01', files: [{ relativePath: 'C01/Revision/file.docx', extension: '.docx', sizeBytes: 10, filesystemModifiedAt: '2026-01-01T00:00:00Z' }] }],
      },
    ],
  };
  const before = planProjectImport(scan, []);
  const after = recalculateProjectImport(before, scan, [createChapter({ id: 'CH01', title: 'First', contributorName: 'Owner' })]);
  assert.equal(after.entries[0].disposition, 'Ready');
  assert.equal(after.entries[0].selected, false);
});
