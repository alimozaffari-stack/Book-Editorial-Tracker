import assert from 'node:assert/strict'; import test from 'node:test';
import { applyProjectImport, finalizeAppliedProjectImport, markProjectFileInspected, planProjectImport, projectImportPlanCsv, projectImportPlanMarkdown, recalculateProjectImport, updateProjectEntryProposal, updateProjectInspectedRecord } from '../src/domain/projectImportPlan'; import { createChapter } from '../src/utils/chapterImport';
import * as wrapper from '../src/utils/firestoreWrapper';
wrapper.setFirestoreReferenceResolversForTest((_db, id) => ({ id } as any), () => ({ id: 'event' } as any));
test('plans only matching DOCX candidates as ready', () => { const plan = planProjectImport({ displayLabel:'A/B', chapterFolders:[{name:'C01 Test',stageFolders:[{name:'06_FINAL MANUSCRUPT SUBMISSION',files:[{relativePath:'C01/a.docx',extension:'.docx',sizeBytes:1,filesystemModifiedAt:'2026-01-01'}]},{name:'Notes',files:[{relativePath:'C01/n.md',extension:'.md',sizeBytes:1,filesystemModifiedAt:'2026-01-01'}]}]}] }, [createChapter({id:'CH01',title:'T',contributorName:'A'})]); assert.equal(plan.entries[0].disposition,'Ready'); assert.equal(plan.entries[1].disposition,'Unsupported'); });

test('matches stored chapter IDs case-insensitively', () => {
  const chapter = createChapter({ id: 'ch01', title: 'T', contributorName: 'A' });
  const scan = { displayLabel: 'A/B', chapterFolders: [{ name: 'C01 Test', stageFolders: [{ name: 'Revision 01', files: [{ relativePath: 'C01/a.docx', extension: '.docx', sizeBytes: 1, filesystemModifiedAt: '2026-01-01' }] }] }] };
  assert.equal(planProjectImport(scan, [chapter]).entries[0].chapterId, 'ch01');
  assert.equal(planProjectImport(scan, [chapter]).entries[0].disposition, 'Ready');
});

test('recalculates unmatched rows after chapter-list import without refreshing existing baselines', () => {
  const scan = { displayLabel: 'A/B', chapterFolders: [{ name: 'C02 Test', stageFolders: [{ name: 'Revision 01', files: [{ relativePath: 'C02/a.docx', extension: '.docx', sizeBytes: 1, filesystemModifiedAt: '2026-01-01' }] }] }] };
  const existing = createChapter({ id: 'CH01', title: 'One', contributorName: 'A' }); existing.dataRevision = 4;
  const before = planProjectImport(scan, [existing]);
  const added = createChapter({ id: 'CH02', title: 'Two', contributorName: 'B' }); added.dataRevision = 1;
  const after = recalculateProjectImport(before, scan, [{ ...existing, dataRevision: 5 }, added]);
  assert.equal(after.entries[0].disposition, 'Ready');
  assert.equal(after.expectedRevisions.CH01, 4);
  assert.equal(after.expectedRevisions.CH02, 1);
});

test('equal chapter-stage candidates require review instead of silent selection', () => {
  const chapter = createChapter({ id: 'CH01', title: 'T', contributorName: 'A' });
  const file = (name: string) => ({ relativePath: `C01/Revision/${name}`, extension: '.docx', sizeBytes: 1, filesystemModifiedAt: '2026-01-01T00:00:00Z' });
  const plan = planProjectImport({ displayLabel: 'A/B', chapterFolders: [{ name: 'C01 Test', stageFolders: [{ name: 'Revision 02', files: [file('a.docx'), file('b.docx')] }] }] }, [chapter]);
  assert.deepEqual(plan.entries.map(entry => entry.disposition), ['Needs review', 'Needs review']);
  assert.deepEqual(plan.entries.map(entry => entry.selected), [false, false]);
});

test('inspection marks an existing active hash as already recorded', () => {
  const chapter = createChapter({ id: 'CH01', title: 'T', contributorName: 'A' });
  chapter.submissions = [{ id: 'old', stage: 'revision', roundNumber: 2, sourceSha256: 'same-hash', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'a', state: 'active' }];
  const plan = planProjectImport({ displayLabel: 'A/B', chapterFolders: [{ name: 'C01 Test', stageFolders: [{ name: 'Revision 02', files: [{ relativePath: 'C01/Revision/file.docx', extension: '.docx', sizeBytes: 20, filesystemModifiedAt: '2026-02-01T00:00:00Z' }] }] }] }, [chapter]);
  const inspected = markProjectFileInspected(plan, 'C01/Revision/file.docx', { fileName: 'file.docx', sizeBytes: 20, sha256: 'same-hash', filesystemModifiedAt: '2026-02-01T00:00:00Z' }, { valid: true, errors: [], hash: 'same-hash', size: 20, xmlSizes: {}, calculatedWordCount: 1000, wordCountSource: 'calculated' }, [chapter], 'editor@example.com');
  assert.equal(inspected.entries[0].disposition, 'Already recorded');
  assert.equal(inspected.entries[0].selected, false);
  assert.equal(inspected.entries[0].record, undefined);
});

test('finalizes only selected records actually added in this import', () => {
  const plan = { entries: [
    { chapterId: 'CH01', file: { relativePath: 'CH01/a.docx', extension: '.docx', sizeBytes: 1, filesystemModifiedAt: '2026-01-01' }, disposition: 'Ready', message: 'Ready', selected: true, inspected: true, record: { id: 'a', stage: 'initial-manuscript', sourceSha256: 'applied', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'a', state: 'active' } },
    { chapterId: 'CH02', file: { relativePath: 'CH02/b.docx', extension: '.docx', sizeBytes: 1, filesystemModifiedAt: '2026-01-01' }, disposition: 'Unsupported', message: 'Unsupported', selected: false, inspected: false },
  ], expectedRevisions: {} } as any;
  const changed = createChapter({ id: 'CH01', title: 'T', contributorName: 'A' }); changed.submissions = [{ id: 'a', stage: 'initial-manuscript', sourceSha256: 'applied', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'a', state: 'active' }];
  const finalized = finalizeAppliedProjectImport(plan, { chaptersChanged: 1, stageRecordsAdded: 1, alreadyRecorded: 0, excluded: 0, unsupported: 1, failed: 0, changedChapters: [changed] });
  assert.equal(finalized.entries[0].disposition, 'Already recorded'); assert.equal(finalized.entries[0].message, 'Added in this import.'); assert.equal(finalized.entries[0].selected, false); assert.equal(finalized.entries[0].record, undefined);
  assert.equal(finalized.entries[1].disposition, 'Unsupported');
});

test('applies several inspected stages to one chapter with one revision increment and one summary event', async () => {
  const chapter = createChapter({ id: 'CH01', title: 'T', contributorName: 'A' });
  chapter.dataRevision = 4;
  const store: Record<string, any> = { CH01: chapter };
  const writes: Array<{ id: string; data: any }> = [];
  wrapper.setRunTransaction(async (_db: any, callback: (transaction: any) => Promise<any>) => callback({
    get: async (ref: any) => ({ exists: () => store[ref.id] !== undefined, data: () => store[ref.id] }),
    set: (ref: any, data: any) => { writes.push({ id: ref.id, data }); if (ref.id === 'CH01') store.CH01 = data; },
  }));
  try {
    const entries = ['initial-manuscript', 'revision'].map((stage, index) => ({
      chapterId: 'CH01',
      file: { relativePath: `CH01/stage-${index}/file-${index}.docx`, extension: '.docx', sizeBytes: 10, filesystemModifiedAt: '2026-01-01T00:00:00Z' },
      proposal: { stage, ...(stage === 'revision' ? { roundNumber: 1 } : {}) },
      disposition: 'Ready' as const,
      message: 'Ready', selected: true, inspected: true,
      record: { id: `record-${index}`, stage, ...(stage === 'revision' ? { roundNumber: 1 } : {}), sourceRelativePath: `CH01/stage-${index}/file-${index}.docx`, sourceSha256: `hash-${index}`, effectiveOn: `2026-01-0${index + 1}`, recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'editor@example.com', state: 'active' as const },
    }));
    const result = await applyProjectImport({} as any, { entries: entries as any, expectedRevisions: { CH01: 4 } }, 'editor@example.com');
    assert.equal(result.chaptersChanged, 1);
    assert.equal(result.stageRecordsAdded, 2);
    assert.equal(store.CH01.dataRevision, 5);
    assert.equal(store.CH01.submissions.length, 2);
    assert.equal(writes.length, 2, 'one chapter write and one activity event');
  } finally {
    wrapper.setRunTransaction(null);
  }
});

test('rejects a chapter revision that changed after the project preview baseline', async () => {
  const chapter = createChapter({ id: 'CH01', title: 'T', contributorName: 'A' }); chapter.dataRevision = 5;
  let writes = 0;
  wrapper.setRunTransaction(async (_db: any, callback: (transaction: any) => Promise<any>) => callback({
    get: async () => ({ exists: () => true, data: () => chapter }),
    set: () => { writes += 1; },
  }));
  const entry = { chapterId: 'CH01', file: { relativePath: 'CH01/Revision/file.docx', extension: '.docx', sizeBytes: 10, filesystemModifiedAt: '2026-01-01' }, proposal: { stage: 'revision', roundNumber: 2 }, disposition: 'Ready', message: 'Ready', selected: true, inspected: true, record: { id: 'r', stage: 'revision', roundNumber: 2, sourceRelativePath: 'CH01/Revision/file.docx', sourceSha256: 'hash', wordCount: 1000, effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'editor@example.com', state: 'active' } };
  try {
    await assert.rejects(() => applyProjectImport({} as any, { entries: [entry], expectedRevisions: { CH01: 4 } } as any, 'editor@example.com'), /changed after the preview/i);
    assert.equal(writes, 0);
  } finally { wrapper.setRunTransaction(null); }
});

test('allows an unmatched stage-folder name to be classified explicitly before inspection', () => {
  const chapter = createChapter({ id: 'CH01', title: 'T', contributorName: 'A' });
  const plan = planProjectImport({ displayLabel: 'A/B', chapterFolders: [{ name: 'C01 Test', stageFolders: [{ name: 'Other', files: [{ relativePath: 'C01/Other/file.docx', extension: '.docx', sizeBytes: 1, filesystemModifiedAt: '2026-01-01' }] }] }] }, [chapter]);
  const classified = updateProjectEntryProposal(plan, 'C01/Other/file.docx', { stage: 'feedback-sent', roundNumber: 2 });
  assert.deepEqual(classified.entries[0].proposal, { stage: 'feedback-sent', roundNumber: 2 });
  assert.equal(classified.entries[0].disposition, 'Needs review');
});

test('exports scan reports with escaped relative references and no absolute root', () => {
  const plan = { entries: [{ chapterId: 'CH01', file: { relativePath: 'CH01/Stage/a,"b".docx', extension: '.docx', sizeBytes: 1, filesystemModifiedAt: '2026-01-01' }, proposal: { stage: 'revision', roundNumber: 1 }, disposition: 'Ready', message: 'Ready', selected: true, inspected: false }] } as any;
  assert.match(projectImportPlanCsv(plan), /"CH01\/Stage\/a,""b""\.docx"/);
  assert.match(projectImportPlanMarkdown(plan, 'Project / Chapters'), /project-relative references only/i);
  assert.doesNotMatch(projectImportPlanMarkdown(plan, 'Project / Chapters'), /[A-Z]:\\/);
});

test('allows reviewed date and word-count correction without changing file provenance', () => {
  const record = { id: 'r', stage: 'revision', roundNumber: 1, sourceSha256: 'hash', sourceRelativePath: 'CH01/Revision/a.docx', calculatedWordCount: 1000, wordCount: 1000, wordCountSource: 'calculated', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'a', state: 'active' };
  const plan = { entries: [{ chapterId: 'CH01', file: { relativePath: record.sourceRelativePath, extension: '.docx', sizeBytes: 1, filesystemModifiedAt: '2026-01-01' }, proposal: { stage: 'revision', roundNumber: 1 }, disposition: 'Ready', message: 'Ready', selected: true, inspected: true, record }] } as any;
  const changed = updateProjectInspectedRecord(plan, record.sourceRelativePath, { roundNumber: 2, effectiveOn: '2026-02-01', wordCount: 950 });
  assert.equal(changed.entries[0].record.roundNumber, 2); assert.equal(changed.entries[0].record.wordCountSource, 'manual'); assert.equal(changed.entries[0].record.sourceSha256, 'hash');
});

test('supports a synthetic 30-chapter reviewed import near 200,000 current words', async () => {
  const chapters = Array.from({ length: 30 }, (_, index) => createChapter({ id: `CH${String(index + 1).padStart(2, '0')}`, title: `Chapter ${index + 1}`, contributorName: `Author ${index + 1}` }));
  const store = Object.fromEntries(chapters.map(chapter => [chapter.id, { ...chapter, dataRevision: 0 }]));
  wrapper.setRunTransaction(async (_db: any, callback: (transaction: any) => Promise<any>) => callback({ get: async (ref: any) => ({ exists: () => store[ref.id] !== undefined, data: () => store[ref.id] }), set: (ref: any, data: any) => { if (store[ref.id]) store[ref.id] = data; } }));
  try {
    const entries = chapters.map((chapter, index) => ({ chapterId: chapter.id, file: { relativePath: `${chapter.id}/Revision/file.docx`, extension: '.docx', sizeBytes: 10, filesystemModifiedAt: '2026-01-01' }, proposal: { stage: 'revision', roundNumber: 1 }, disposition: 'Ready', message: 'Ready', selected: true, inspected: true, record: { id: `r-${index}`, stage: 'revision', roundNumber: 1, sourceRelativePath: `${chapter.id}/Revision/file.docx`, sourceSha256: `hash-${index}`, wordCount: 6500, effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'editor@example.com', state: 'active' } }));
    const result = await applyProjectImport({} as any, { entries, expectedRevisions: Object.fromEntries(chapters.map(chapter => [chapter.id, 0])) } as any, 'editor@example.com');
    assert.equal(result.chaptersChanged, 30); assert.equal(result.stageRecordsAdded, 30);
    assert.equal(Object.values(store).reduce((sum: number, chapter: any) => sum + Number(chapter.submittedWordCount), 0), 195000);
  } finally { wrapper.setRunTransaction(null); }
});
