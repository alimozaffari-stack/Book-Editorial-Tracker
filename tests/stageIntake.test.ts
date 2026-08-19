import assert from 'node:assert/strict';
import test from 'node:test';
import { inferStageFromFileName, validateStageIntake } from '../src/components/StageIntakeDialog';

test('infers a revision round from a Word filename', () => {
  assert.deepEqual(inferStageFromFileName('CH04_Revision_02.docx'), { stage: 'revision', round: 2 });
});

test('requires a positive round, confirmed date, and whole-number word count', () => {
  assert.equal(validateStageIntake({ stage: 'revision', round: '', effectiveOn: '2026-08-13', wordCount: '1000' }).field, 'round');
  assert.equal(validateStageIntake({ stage: 'revision', round: '2', effectiveOn: '', wordCount: '1000' }).field, 'effectiveOn');
  assert.equal(validateStageIntake({ stage: 'revision', round: '2', effectiveOn: '2026-02-31', wordCount: '1000' }).field, 'effectiveOn');
  assert.equal(validateStageIntake({ stage: 'revision', round: '2', effectiveOn: '2026-08-13', wordCount: '10.5' }).field, 'wordCount');
  assert.deepEqual(validateStageIntake({ stage: 'revision', round: '2', effectiveOn: '2026-08-13', wordCount: '1000' }), {});
});

test('accepts and infers feedback round zero', () => {
  assert.deepEqual(inferStageFromFileName('CH04_Feedback_00.docx'), { stage: 'feedback-sent', round: 0 });
  assert.deepEqual(validateStageIntake({ stage: 'feedback-sent', round: '0', effectiveOn: '2026-08-13', wordCount: '0' }), {});
});
