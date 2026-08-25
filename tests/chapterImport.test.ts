import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChapterCsv } from '../src/utils/chapterImport';

test('parses a chapter intake CSV and supplies safe workflow defaults', () => {
  const result = parseChapterCsv([
    'chapter_id,title,contributor_name,contributor_email,institutional_affiliation,lead_editor,folder_url,word_count,abstract,bio',
    'CH14,"A chapter, with punctuation",Jane Doe,jane@example.com,University A,Ali Mozaffari,https://example.com/ch14,4200,"Abstract text","Short biography"',
  ].join('\n'));

  assert.equal(result.errors.length, 0);
  assert.equal(result.chapters.length, 1);
  assert.equal(result.chapters[0].id, 'CH14');
  assert.equal(result.chapters[0].title, 'A chapter, with punctuation');
  assert.equal(result.chapters[0].contributorName, 'Jane Doe');
  assert.equal(result.chapters[0].initialChapterSubmission, 'No');
  assert.equal(result.chapters[0].abstractText, 'Abstract text');
});

test('reports rows that do not have a chapter id, title, or contributor name', () => {
  const result = parseChapterCsv('chapter_id,title,contributor_name\nCH15,,');

  assert.equal(result.chapters.length, 0);
  assert.match(result.errors[0], /row 2/i);
});

test('sets initialChapterSubmission and implies initialAbstractSubmitted when initial_chapter_submission is Yes', () => {
  const result = parseChapterCsv([
    'chapter_id,title,contributor_name,contributor_email,institutional_affiliation,lead_editor,folder_url,word_count,abstract,bio,initial_chapter_submission,initial_chapter_date',
    'CH14,Chapter Title,Jane Doe,jane@example.com,University A,Ali Mozaffari,https://example.com/ch14,7500,Abstract text,Short biography,Yes,2026-03-15',
  ].join('\n'));

  assert.equal(result.errors.length, 0);
  assert.equal(result.chapters[0].initialChapterSubmission, 'Yes');
  assert.equal(result.chapters[0].initialChapterDate, '2026-03-15');
  assert.equal(result.chapters[0].initialAbstractSubmitted, 'Yes');
});
