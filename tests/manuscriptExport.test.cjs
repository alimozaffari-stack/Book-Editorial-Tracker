const assert = require('node:assert/strict');
const test = require('node:test');
const JSZip = require('jszip');
const {
  buildDocx,
  buildSourceArchive,
  extractDocxText,
  markdownForSections,
} = require('../electron/manuscript-compiler.cjs');

const section = {
  id: 'CH01', title: 'A chapter', contributorName: 'A. Writer', contributorEmail: 'writer@example.test',
  institutionalAffiliation: 'University', stageLabel: 'Revision 02', effectiveOn: '2026-08-01',
  abstractText: 'A short abstract.', paragraphs: ['First paragraph.', 'Second & final paragraph.'],
};

test('generates readable Markdown and a valid minimal DOCX', async () => {
  const markdown = markdownForSections('Test Book', [section], { includeMetadata: true, includeAbstracts: true });
  assert.match(markdown, /# Test Book/);
  assert.match(markdown, /Second & final paragraph\./);

  const docx = await buildDocx('Test Book', [section], { includeMetadata: true, includeAbstracts: true });
  const zip = await JSZip.loadAsync(docx);
  assert.ok(zip.file('[Content_Types].xml'));
  assert.ok(zip.file('word/document.xml'));
  const extracted = await extractDocxText(docx);
  assert.deepEqual(extracted.slice(-2), ['First paragraph.', 'Second & final paragraph.']);
});

test('builds a source archive with safe chapter paths and optional companion files', async () => {
  const archive = await buildSourceArchive('Test Book', [{
    section,
    sourceFileName: '../unsafe.docx',
    bytes: Buffer.from('source'),
  }], { includeMetadata: true, includeAbstracts: true });
  const zip = await JSZip.loadAsync(archive);
  assert.ok(zip.file('CH01/unsafe.docx'));
  assert.ok(zip.file('manuscript-metadata.json'));
  assert.ok(zip.file('chapter-abstracts.md'));
});
