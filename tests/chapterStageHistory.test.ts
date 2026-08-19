import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveCurrentStage, projectLegacyStageFields } from '../src/domain/chapterStageHistory';

test('derives the latest active stage and ignores voided history', () => {
  const result = deriveCurrentStage([
    { id: 'initial', stage: 'initial-manuscript', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', recordedBy: 'editor@example.com', state: 'active' },
    { id: 'voided-final', stage: 'final-manuscript', effectiveOn: '2026-02-01', recordedAt: '2026-02-01T00:00:00.000Z', recordedBy: 'editor@example.com', state: 'voided' },
    { id: 'revision', stage: 'revision', roundNumber: 2, effectiveOn: '2026-03-01', recordedAt: '2026-03-01T00:00:00.000Z', recordedBy: 'editor@example.com', state: 'active', wordCount: 4100 },
  ]);

  assert.equal(result?.id, 'revision');
  assert.deepEqual(projectLegacyStageFields(result), {
    revision01Submitted: 'Yes',
    dateRevision01Submitted: '2026-03-01',
    submittedWordCount: '4100',
  });
});

test('keeps repeating revision and feedback rounds in canonical order', () => {
  const result = deriveCurrentStage([
    { id: 'revision-02', stage: 'revision', roundNumber: 2, effectiveOn: '2026-03-01', recordedAt: '2026-03-01T00:00:00.000Z', recordedBy: 'editor@example.com', state: 'active' },
    { id: 'feedback-02', stage: 'feedback-sent', roundNumber: 2, effectiveOn: '2026-03-02', recordedAt: '2026-03-02T00:00:00.000Z', recordedBy: 'editor@example.com', state: 'active' },
  ]);
  assert.equal(result?.id, 'feedback-02');
});
