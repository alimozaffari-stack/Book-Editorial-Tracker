import assert from 'node:assert/strict'; import test from 'node:test';
import { finalizeAppliedProjectImport, markProjectFileInspected, planProjectImport, projectImportPlanCsv, projectImportPlanMarkdown, recalculateProjectImport, updateProjectEntryProposal, updateProjectInspectedRecord } from '../src/domain/projectImportPlan'; import { createChapter } from '../src/utils/chapterImport';
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


