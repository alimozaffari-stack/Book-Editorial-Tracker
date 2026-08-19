import { Chapter, ChapterDiscrepancy, ChapterStageRecord } from '../types';
import { activeStageConflicts, chapterStageRank, formatStageEffectiveDate } from './chapterStageHistory';

export interface DerivedCurrentStage { key: string; label: string; record?: ChapterStageRecord; }
export interface ChapterProgress { currentStage: DerivedCurrentStage; currentWordCount?: number; discrepancies: ChapterDiscrepancy[]; }
export interface AbstractPresence {
  present: boolean;
  evidence: Array<'active-abstract-stage' | 'abstract-text' | 'legacy-yes'>;
  legacyStatus: string;
}

const manuscriptStages = new Set(['initial-manuscript', 'revision', 'final-manuscript', 'publisher-submission', 'typeset-submission']);
const yes = (value: string | undefined) => value?.trim().toLowerCase() === 'yes';

export function deriveAbstractPresence(chapter: Chapter): AbstractPresence {
  const evidence: AbstractPresence['evidence'] = [];
  const rawLegacyStatus = chapter.initialAbstractSubmitted?.trim() || 'Not recorded';
  if ((chapter.submissions ?? []).some(record => record.state === 'active' && record.stage === 'abstract')) evidence.push('active-abstract-stage');
  if (chapter.abstractText?.trim()) evidence.push('abstract-text');
  if (yes(chapter.initialAbstractSubmitted)) evidence.push('legacy-yes');
  return {
    present: evidence.length > 0,
    evidence,
    legacyStatus: yes(rawLegacyStatus) ? 'Yes' : rawLegacyStatus.toLowerCase() === 'no' ? 'No' : rawLegacyStatus,
  };
}

export function abstractStatusReconciliationIds(chapters: Chapter[]): string[] {
  return chapters
    .filter(chapter => {
      const presence = deriveAbstractPresence(chapter);
      return !yes(chapter.initialAbstractSubmitted)
        && (presence.evidence.includes('active-abstract-stage') || presence.evidence.includes('abstract-text'));
    })
    .map(chapter => chapter.id);
}

export function deriveCurrentStage(chapter: Chapter): DerivedCurrentStage {
  const active = (chapter.submissions ?? []).filter(record => record.state === 'active').sort((a, b) => chapterStageRank(b) - chapterStageRank(a) || b.effectiveOn.localeCompare(a.effectiveOn));
  const record = active[0];
  if (record) {
    const label = record.stage === 'revision'
      ? `Revision ${String(record.roundNumber ?? 1).padStart(2, '0')}`
      : record.stage === 'feedback-sent'
        ? `Feedback round ${record.roundNumber ?? 0}`
        : record.stage.replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { key: record.stage, label, record };
  }
  if (yes(chapter.typesetSubmission)) return { key: 'typeset-submission', label: 'Typeset submission' };
  if (yes(chapter.publisherSubmission)) return { key: 'publisher-submission', label: 'Publisher submission' };
  if (yes(chapter.revision01Submitted)) return { key: 'revision', label: 'Revision 01' };
  if (yes(chapter.feedbackSent)) return { key: 'feedback-sent', label: 'Feedback sent' };
  if (yes(chapter.initialChapterSubmission)) return { key: 'initial-manuscript', label: 'Initial manuscript' };
  if (yes(chapter.initialAbstractSubmitted)) return { key: 'abstract', label: 'Abstract' };
  return { key: 'no-confirmed-history', label: 'No confirmed history' };
}

export function findChapterDiscrepancies(chapter: Chapter): ChapterDiscrepancy[] {
  const result: ChapterDiscrepancy[] = [];
  const abstractPresence = deriveAbstractPresence(chapter);
  if (abstractPresence.present && !yes(chapter.initialAbstractSubmitted)) {
    const source = abstractPresence.evidence.includes('abstract-text') ? 'Abstract text is present.' : 'An active abstract stage is present.';
    result.push({ code: 'legacy-abstract-status', severity: 'cleanup', field: 'initialAbstractSubmitted', message: `${source} The imported legacy status is ${abstractPresence.legacyStatus}.` });
  }
  if (yes(chapter.initialChapterSubmission) && !abstractPresence.present) result.push({ code: 'missing-abstract-evidence', severity: 'cleanup', field: 'initialAbstractSubmitted', message: 'Initial manuscript is marked complete, but no abstract evidence is recorded.' });
  for (const conflict of activeStageConflicts(chapter.submissions)) {
    const details = conflict.records.map(record => {
      const wordCount = record.wordCount ?? record.calculatedWordCount;
      const words = wordCount === undefined ? 'word count unavailable' : `${wordCount.toLocaleString('en-AU')} words`;
      return `${formatStageEffectiveDate(record.effectiveOn)}, ${words}`;
    }).join('; ');
    const count = conflict.records.length === 2 ? 'Two' : String(conflict.records.length);
    result.push({
      code: 'duplicate-active-rank', severity: 'blocking', field: 'submissions',
      recordIds: conflict.records.map(record => record.id),
      message: `Duplicate active stage: ${conflict.stageLabel}. ${count} records are active (${details}). Choose the canonical record.`,
    });
  }
  return result;
}

export function deriveChapterProgress(chapter: Chapter): ChapterProgress {
  const currentStage = deriveCurrentStage(chapter);
  const records = (chapter.submissions ?? []).filter(record => record.state === 'active' && manuscriptStages.has(record.stage)).sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn));
  const latest = records.at(-1);
  const currentWordCount = latest?.wordCount ?? latest?.calculatedWordCount ?? (Number.isFinite(Number(chapter.submittedWordCount)) ? Number(chapter.submittedWordCount) : undefined);
  return { currentStage, currentWordCount, discrepancies: findChapterDiscrepancies(chapter) };
}
