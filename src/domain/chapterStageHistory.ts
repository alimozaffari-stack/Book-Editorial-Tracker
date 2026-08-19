import { ActiveStageConflict, Chapter, ChapterStageRecord } from '../types';

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
});

export function chapterStageRank(record: Pick<ChapterStageRecord, 'stage' | 'roundNumber'>): number {
  if (record.stage === 'abstract') return 1;
  if (record.stage === 'initial-manuscript') return 2;
  if (record.stage === 'feedback-sent') return 3 + Math.max(0, record.roundNumber ?? 0) * 2;
  if (record.stage === 'revision') return 4 + Math.max(0, (record.roundNumber ?? 1) - 1) * 2;
  if (record.stage === 'final-manuscript') return 100;
  if (record.stage === 'publisher-submission') return 101;
  return 102;
}

export function stageLabel(record: Pick<ChapterStageRecord, 'stage' | 'roundNumber'>): string {
  if (record.stage === 'revision') return `Revision ${String(record.roundNumber ?? 1).padStart(2, '0')}`;
  if (record.stage === 'feedback-sent') return `Feedback round ${record.roundNumber ?? 0}`;
  const labels: Record<Exclude<ChapterStageRecord['stage'], 'revision' | 'feedback-sent'>, string> = {
    abstract: 'Abstract',
    'initial-manuscript': 'Initial manuscript',
    'final-manuscript': 'Final manuscript',
    'publisher-submission': 'Publisher submission',
    'typeset-submission': 'Typeset submission',
  };
  return labels[record.stage];
}

export function formatStageEffectiveDate(effectiveOn: string): string {
  return dateFormatter.format(new Date(`${effectiveOn}T00:00:00.000Z`));
}

/** Returns every active same-rank group, with deterministic record ordering for review. */
export function activeStageConflicts(records: ChapterStageRecord[] | undefined): ActiveStageConflict[] {
  const groups = new Map<number, ChapterStageRecord[]>();
  for (const record of records ?? []) {
    if (record.state !== 'active') continue;
    const rank = chapterStageRank(record);
    groups.set(rank, [...(groups.get(rank) ?? []), record]);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([left], [right]) => left - right)
    .map(([rank, group]) => {
      const sortedRecords = [...group].sort((left, right) =>
        left.effectiveOn.localeCompare(right.effectiveOn)
        || left.recordedAt.localeCompare(right.recordedAt)
        || left.id.localeCompare(right.id));
      return { rank, stageLabel: stageLabel(sortedRecords[0]), records: sortedRecords };
    });
}

export function deriveCurrentStage(records: ChapterStageRecord[] | undefined): ChapterStageRecord | undefined {
  return (records ?? []).filter(record => record.state === 'active').sort((left, right) => {
    const stageDifference = chapterStageRank(right) - chapterStageRank(left);
    if (stageDifference !== 0) return stageDifference;
    const roundDifference = (right.roundNumber ?? 0) - (left.roundNumber ?? 0);
    return roundDifference !== 0 ? roundDifference : right.effectiveOn.localeCompare(left.effectiveOn);
  })[0];
}

export function projectLegacyStageFields(record: ChapterStageRecord | undefined): Partial<Chapter> {
  if (!record) return {};
  const wordCount = record.wordCount ?? record.calculatedWordCount;
  const wordCountFields = wordCount === undefined ? {} : { submittedWordCount: String(wordCount) };
  switch (record.stage) {
    case 'abstract': return { initialAbstractSubmitted: 'Yes' };
    case 'initial-manuscript': return { initialChapterSubmission: 'Yes', initialChapterDate: record.effectiveOn, ...wordCountFields };
    case 'feedback-sent': return { feedbackSent: 'Yes', dateFeedbackSent: record.effectiveOn };
    case 'revision': return { revision01Submitted: 'Yes', dateRevision01Submitted: record.effectiveOn, ...wordCountFields };
    case 'final-manuscript': return { manuscriptSubmission: 'Yes', manuscriptSubmissionDate: record.effectiveOn, ...wordCountFields };
    case 'publisher-submission': return { publisherSubmission: 'Yes', publisherSubmissionDate: record.effectiveOn, ...wordCountFields };
    case 'typeset-submission': return { typesetSubmission: 'Yes', typesetSubmissionDate: record.effectiveOn, ...wordCountFields };
  }
}

export function clearLegacyStageProjection(chapter: Chapter, stage: ChapterStageRecord['stage']): Chapter {
  switch (stage) {
    case 'abstract': return { ...chapter, initialAbstractSubmitted: 'No' };
    case 'initial-manuscript': return { ...chapter, initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0' };
    case 'feedback-sent': return { ...chapter, feedbackSent: 'No', dateFeedbackSent: '' };
    case 'revision': return { ...chapter, revision01Submitted: 'No', dateRevision01Submitted: '', submittedWordCount: '0' };
    case 'final-manuscript': return { ...chapter, manuscriptSubmission: 'No', manuscriptSubmissionDate: '', submittedWordCount: '0' };
    case 'publisher-submission': return { ...chapter, publisherSubmission: 'No', publisherSubmissionDate: '', submittedWordCount: '0' };
    case 'typeset-submission': return { ...chapter, typesetSubmission: 'No', typesetSubmissionDate: '', submittedWordCount: '0' };
  }
}

export function applyStageHistoryProjections(chapter: Chapter, records: ChapterStageRecord[]): Chapter {
  return { ...chapter, submissions: records, ...projectLegacyStageFields(deriveCurrentStage(records)) };
}
