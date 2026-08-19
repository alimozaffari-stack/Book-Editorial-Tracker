import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProjectBackup, chaptersToCsv, timestampedBackupFilename } from '../src/utils/backupExport';

test('builds a versioned project backup with document ids and metadata', () => {
  const backup = buildProjectBackup({
    chapters: [{ id: 'CH01', title: 'A chapter' }],
    users: [{ id: 'editor@example.com', email: 'editor@example.com', role: 'editor' }],
    auditEvents: [{ id: 'event-1', action: 'chapter_saved' }],
    exportedBy: 'owner@example.com',
    exportedAt: '2026-08-11T00:00:00.000Z',
  });

  assert.deepEqual(backup, {
    format: 'editorial-review-tracker-backup',
    version: 2,
    exportedAt: '2026-08-11T00:00:00.000Z',
    exportedBy: 'owner@example.com',
    collections: {
      chapters: [{ id: 'CH01', title: 'A chapter' }],
      users: [{ id: 'editor@example.com', email: 'editor@example.com', role: 'editor' }],
      auditEvents: [{ id: 'event-1', action: 'chapter_saved' }],
    },
  });
});

test('builds a versioned project backup that carries top-level project metadata', () => {
  const backup = buildProjectBackup({
    chapters: [{ id: 'CH01', title: 'A chapter' }],
    users: [],
    auditEvents: [],
    exportedBy: 'owner@example.com',
    exportedAt: '2026-08-11T00:00:00.000Z',
    project: {
      name: 'Project',
      generationId: 'abc-01',
      startedAt: '2026-08-11T00:00:00.000Z',
      startedBy: 'owner@example.com',
      updatedAt: '2026-08-11T00:00:00.000Z',
    },
  });

  assert.deepEqual(backup.project, {
    name: 'Project',
    generationId: 'abc-01',
    startedAt: '2026-08-11T00:00:00.000Z',
    startedBy: 'owner@example.com',
    updatedAt: '2026-08-11T00:00:00.000Z',
  });
});

test('exports chapter data as an Excel-compatible CSV with escaped values', () => {
  const csv = chaptersToCsv([{ id: 'CH01', title: 'A "quoted", chapter', contributorName: 'Ali, M.' }]);

  assert.match(csv, /^id,title,contributorName/m);
  assert.match(csv, /CH01,"A ""quoted"", chapter","Ali, M\."/);
});

test('uses a Windows-safe timestamped backup filename', () => {
  assert.equal(
    timestampedBackupFilename('json', new Date('2026-08-11T12:34:56.789Z')),
    'editorial-review-tracker-backup-2026-08-11T12-34-56-789Z.json',
  );
});
