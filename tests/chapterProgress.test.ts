import assert from 'node:assert/strict';
import test from 'node:test';
import * as chapterProgress from '../src/domain/chapterProgress';
import { activeStageConflicts } from '../src/domain/chapterStageHistory';
import { Chapter } from '../src/types';

const chapter = (overrides: Partial<Chapter> = {}): Chapter => ({
  id: 'CH01', contributorId: 'C01', contributorName: 'A', contributorEmail: '', title: 'T', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'Yes', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No', ...overrides,
});

test('prefers active history and its latest manuscript word count', () => {
  const result = chapterProgress.deriveChapterProgress(chapter({ submissions: [
    { id: 'initial', stage: 'initial-manuscript', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'a', state: 'active', wordCount: 1000 },
    { id: 'revision', stage: 'revision', roundNumber: 2, effectiveOn: '2026-02-01', recordedAt: '2026-02-01T00:00:00Z', recordedBy: 'a', state: 'active', wordCount: 1200 },
    { id: 'void', stage: 'typeset-submission', effectiveOn: '2026-03-01', recordedAt: '2026-03-01T00:00:00Z', recordedBy: 'a', state: 'voided', wordCount: 900 },
  ] }));
  assert.equal(result.currentStage.label, 'Revision 02');
  assert.equal(result.currentWordCount, 1200);
});

test('derives abstract presence from text despite an imported No status', () => {
  const api = chapterProgress as Record<string, unknown>;
  const deriveAbstractPresence = api.deriveAbstractPresence as ((value: Chapter) => unknown) | undefined;
  assert.equal(typeof deriveAbstractPresence, 'function');
  assert.deepEqual(deriveAbstractPresence?.(chapter({ abstractText: 'Text', initialAbstractSubmitted: 'No' })), {
    present: true,
    evidence: ['abstract-text'],
    legacyStatus: 'No',
  });
  const result = chapterProgress.deriveChapterProgress(chapter({ abstractText: 'Text', initialAbstractSubmitted: ' no ' }));
  assert.equal(result.discrepancies[0].message, 'Abstract text is present. The imported legacy status is No.');
});

test('derives abstract presence from an active abstract stage', () => {
  const api = chapterProgress as Record<string, unknown>;
  const deriveAbstractPresence = api.deriveAbstractPresence as ((value: Chapter) => unknown) | undefined;
  assert.equal(typeof deriveAbstractPresence, 'function');
  assert.deepEqual(deriveAbstractPresence?.(chapter({ submissions: [
    { id: 'abstract', stage: 'abstract', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'a', state: 'active' },
  ] })), {
    present: true,
    evidence: ['active-abstract-stage'],
    legacyStatus: 'No',
  });
});

test('uses legacy Yes only when no stronger abstract evidence exists', () => {
  const api = chapterProgress as Record<string, unknown>;
  const deriveAbstractPresence = api.deriveAbstractPresence as ((value: Chapter) => unknown) | undefined;
  assert.equal(typeof deriveAbstractPresence, 'function');
  assert.deepEqual(deriveAbstractPresence?.(chapter({ initialAbstractSubmitted: 'Yes' })), {
    present: true,
    evidence: ['legacy-yes'],
    legacyStatus: 'Yes',
  });
});

test('treats an initial manuscript without abstract evidence as cleanup, not an absent abstract claim', () => {
  const result = chapterProgress.deriveChapterProgress(chapter({ initialChapterSubmission: 'Yes' }));
  assert.deepEqual(result.discrepancies, [{
    code: 'missing-abstract-evidence',
    severity: 'cleanup',
    field: 'initialAbstractSubmitted',
    message: 'Initial manuscript is marked complete, but no abstract evidence is recorded.',
  }]);
});

test('selects only independently evidenced abstract statuses for reconciliation', () => {
  const api = chapterProgress as Record<string, unknown>;
  const abstractStatusReconciliationIds = api.abstractStatusReconciliationIds as ((values: Chapter[]) => unknown) | undefined;
  assert.equal(typeof abstractStatusReconciliationIds, 'function');
  assert.deepEqual(abstractStatusReconciliationIds?.([
    chapter({ id: 'CH01', abstractText: 'Text' }),
    chapter({ id: 'CH02', submissions: [{ id: 'abstract', stage: 'abstract', effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'a', state: 'active' }] }),
    chapter({ id: 'CH03', initialChapterSubmission: 'Yes' }),
    chapter({ id: 'CH04', initialAbstractSubmitted: 'Yes', abstractText: 'Text' }),
  ]), ['CH01', 'CH02']);
});

test('names duplicate active initial-manuscript records deterministically', () => {
  const records = [
    { id: 'first', stage: 'initial-manuscript' as const, effectiveOn: '2026-01-22', recordedAt: '2026-01-22T00:00:00Z', recordedBy: 'a', state: 'active' as const, wordCount: 7936 },
    { id: 'second', stage: 'initial-manuscript' as const, effectiveOn: '2026-04-14', recordedAt: '2026-04-14T00:00:00Z', recordedBy: 'b', state: 'active' as const, wordCount: 9604 },
  ];
  const discrepancy = chapterProgress.deriveChapterProgress(chapter({ submissions: records })).discrepancies[0];

  assert.equal(discrepancy.message, 'Duplicate active stage: Initial manuscript. Two records are active (22 Jan 2026, 7,936 words; 14 Apr 2026, 9,604 words). Choose the canonical record.');
  assert.equal(discrepancy.severity, 'blocking');
  assert.equal(discrepancy.code, 'duplicate-active-rank');
  assert.deepEqual(discrepancy.recordIds, ['first', 'second']);

  const conflicts = activeStageConflicts(records);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].records.map(record => record.id), ['first', 'second']);
});
