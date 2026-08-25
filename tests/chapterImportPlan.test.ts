import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChapterImportPlan } from '../src/domain/chapterImportPlan';
import { createChapter, parseChapterCsv } from '../src/utils/chapterImport';
import { Chapter } from '../src/types';

/** Helper to generate a minimal Chapter object for existing data */
function makeChapter(id: string): Chapter {
  return createChapter({ id, title: `Title ${id}`, contributorName: `Contributor ${id}` });
}

test('buildChapterImportPlan classifies new and already-present rows correctly', () => {
  // Existing chapters CH00-CH12
  const existing: Chapter[] = [];
  for (let i = 0; i <= 12; i++) {
    const id = `CH${i.toString().padStart(2, '0')}`;
    existing.push(makeChapter(id));
  }

  const csv = [
    'chapter_id,title,contributor_name,contributor_email,institutional_affiliation,lead_editor,folder_url,word_count,abstract,bio',
    // Duplicate rows (existing IDs)
    ...Array.from({ length: 13 }, (_, i) => {
      const id = `CH${i.toString().padStart(2, '0')}`;
      return `${id},Title ${id},Contributor ${id},email${i}@example.com,Aff${i},Lead${i},url${i},0,,`;
    }),
    // New row with abstract and bio (should set defaults)
    'CH13,Title CH13,Contributor CH13,email13@example.com,Aff13,Lead13,url13,0,Abstract text,Bio text',
  ].join('\n');

  const plan = buildChapterImportPlan(csv, existing);
  const newEntries = plan.entries.filter(e => e.disposition === 'new');
  const existingEntries = plan.entries.filter(e => e.disposition === 'already-present');

  assert.equal(newEntries.length, 1, 'should have exactly one new entry');
  assert.equal(existingEntries.length, 13, 'should have thirteen already-present entries');

  const newEntry = newEntries[0];
  assert.ok(newEntry.incoming, 'new entry should have incoming chapter');
  assert.equal(newEntry.incoming?.initialAbstractSubmitted, 'Yes', 'new entry with abstract should set initialAbstractSubmitted to Yes');
  assert.equal(newEntry.incoming?.biographicalStatement, 'Yes', 'new entry with bio should set biographicalStatement to Yes');
});

test('buildChapterImportPlan treats case‑insensitive ID collisions as duplicates', () => {
  const existing: Chapter[] = [makeChapter('CH01')];
  const csv = [
    'chapter_id,title,contributor_name',
    'ch01,Title ch01,Contributor ch01',
  ].join('\n');
  const plan = buildChapterImportPlan(csv, existing);
  assert.equal(plan.entries[0].disposition, 'already-present');
});

test('buildChapterImportPlan marks duplicate IDs within CSV as ambiguous', () => {
  const existing: Chapter[] = [];
  const csv = [
    'chapter_id,title,contributor_name',
    'CH14,Title A,Contributor A',
    'CH14,Title B,Contributor B',
  ].join('\n');
  const plan = buildChapterImportPlan(csv, existing);
  const ambiguous = plan.entries.filter(e => e.disposition === 'ambiguous');
  assert.equal(ambiguous.length, 2, 'both rows with same ID should be ambiguous');
});

test('buildChapterImportPlan flags rows missing required fields as invalid', () => {
  const existing: Chapter[] = [];
  const csv = [
    'chapter_id,title,contributor_name',
    'CH15,,', // missing title and contributor_name
  ].join('\n');
  const plan = buildChapterImportPlan(csv, existing);
  assert.equal(plan.entries[0].disposition, 'invalid');
});

test('buildChapterImportPlan rejects a path-like ID before preview', () => {
  const plan = buildChapterImportPlan('chapter_id,title,contributor_name\nCH/01,Title,Author', []);
  assert.equal(plan.entries[0].disposition, 'invalid');
});

test('buildChapterImportPlan sets initialChapterSubmission and implies initialAbstractSubmitted when initial_chapter_submission is Yes', () => {
  const csv = [
    'chapter_id,title,contributor_name,initial_chapter_submission,initial_chapter_date',
    'CH20,Title CH20,Contributor CH20,Yes,2026-05-01',
  ].join('\n');
  const plan = buildChapterImportPlan(csv, []);
  const entry = plan.entries[0];
  assert.equal(entry.disposition, 'new');
  assert.equal(entry.incoming?.initialChapterSubmission, 'Yes');
  assert.equal(entry.incoming?.initialAbstractSubmitted, 'Yes');
  assert.equal(entry.incoming?.initialChapterDate, '2026-05-01');
});
