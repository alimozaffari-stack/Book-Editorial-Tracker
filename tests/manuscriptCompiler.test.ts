import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCompileManuscriptRequest, latestCompilerSource } from '../src/domain/manuscriptCompiler';
import type { Chapter, ChapterStageRecord } from '../src/types';

const chapter = (id: string, submissions: ChapterStageRecord[]): Chapter => ({
  id, submissions, title: `Title ${id}`, contributorId: id, contributorName: 'Writer', contributorEmail: 'writer@example.test',
  folderUrl: '', leadEditor: '', initialAbstractSubmitted: '', updatedAbstractSubmitted: '', initialChapterSubmission: '',
  initialChapterDate: '', submittedWordCount: '', followUpForInitialSubmission: '', followUpDate: '', feedbackSent: '',
  dateFeedbackSent: '', feedbackLink: '', revision01Submitted: '', dateRevision01Submitted: '', followUpContacted: '',
  dateFollowUpContacted: '', decisionToProceed: '', reasonIfNo: '', imageListSubmitted: '', imagesMeetQc: '',
  indexingTermsSubmitted: '', abstractText: `Abstract ${id}`,
});

const record = (id: string, stage: ChapterStageRecord['stage'], effectiveOn: string, state: ChapterStageRecord['state'] = 'active'): ChapterStageRecord => ({
  id, stage, effectiveOn, state, recordedAt: `${effectiveOn}T12:00:00.000Z`, recordedBy: 'editor',
  sourceRelativePath: `${id}.docx`,
});

test('selects the highest latest active source within the selected stages', () => {
  const item = chapter('CH01', [
    record('initial', 'initial-manuscript', '2026-01-01'),
    record('revision-old', 'revision', '2026-02-01'),
    record('revision-new', 'revision', '2026-03-01'),
    record('final-void', 'final-manuscript', '2026-04-01', 'voided'),
  ]);
  assert.equal(latestCompilerSource(item, new Set(['initial-manuscript', 'revision']))?.id, 'revision-new');
  assert.equal(latestCompilerSource(item, new Set(['initial-manuscript']))?.id, 'initial');
});

test('builds a naturally ordered request and omits chapters without matching sources', () => {
  const request = buildCompileManuscriptRequest([
    chapter('CH10', [record('ten', 'revision', '2026-01-01')]),
    chapter('CH02', [record('two', 'initial-manuscript', '2026-01-01')]),
    chapter('CH01', []),
  ], 'Book', 'docx', new Set(['initial-manuscript', 'revision']), true, false);
  assert.deepEqual(request.chapters.map(item => item.id), ['CH02', 'CH10']);
  assert.equal(request.chapters[0].abstractText, 'Abstract CH02');
  assert.equal(request.chapters[0].contributorName, undefined);

test('enforces compilation limits', () => {
  const lotsOfChapters = Array.from({ length: 101 }, (_, i) => chapter(`CH${i}`, [record('s', 'revision', '2026-01-01')]));
  assert.throws(() => buildCompileManuscriptRequest(lotsOfChapters, 'Book', 'docx', new Set(['revision']), true, false), /Maximum compiler limit is 100 chapters/);

  const bigAbstractChapters = [
    chapter('CH01', [record('s', 'revision', '2026-01-01')]),
  ];
  bigAbstractChapters[0].abstractText = 'a'.repeat(500001);
  assert.throws(() => buildCompileManuscriptRequest(bigAbstractChapters, 'Book', 'docx', new Set(['revision']), true, false), /Aggregate abstract length exceeds 500,000 characters limit/);
});

});
