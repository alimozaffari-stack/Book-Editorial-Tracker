import { Chapter, ChapterStage, ChapterStageRecord, WordCountSource } from '../types';
import { createChapter } from '../utils/chapterImport';
import { isSafeProjectReference } from './projectReference';
import { isSafeChapterId, isSafeStageRecord } from './chapterValidation';
import { validateProjectState } from './projectState';

type BackupDocument = { format?: unknown; version?: unknown; collections?: { chapters?: unknown; users?: unknown; auditEvents?: unknown }; project?: unknown };

export function backupCollectionCounts(input: unknown): { chapters: number; users: number; auditEvents: number } {
  if (!input || typeof input !== 'object') throw new Error('Invalid backup file format.');
  const backup = input as { collections?: { chapters?: unknown; users?: unknown; auditEvents?: unknown } };
  return {
    chapters: Array.isArray(backup.collections?.chapters) ? backup.collections.chapters.length : 0,
    users: Array.isArray(backup.collections?.users) ? backup.collections.users.length : 0,
    auditEvents: Array.isArray(backup.collections?.auditEvents) ? backup.collections.auditEvents.length : 0,
  };
}

const chapterStringFields: Array<keyof Chapter> = [
  'contributorId', 'contributorEmail', 'folderUrl', 'leadEditor', 'initialAbstractSubmitted', 'updatedAbstractSubmitted',
  'updatedAbstractDate', 'abstractRevision', 'initialChapterSubmission', 'initialChapterDate', 'chapterRevision', 'submittedWordCount',
  'followUpForInitialSubmission', 'followUpDate', 'feedbackSent', 'dateFeedbackSent', 'feedbackReceived', 'dateFeedbackReceived',
  'feedbackLink', 'feedbackRevision', 'revision01Submitted', 'dateRevision01Submitted', 'manuscriptSubmission', 'manuscriptSubmissionDate',
  'publisherSubmission', 'publisherSubmissionDate', 'typesetSubmission', 'typesetSubmissionDate', 'biographicalStatement', 'bioText',
  'abstractText', 'institutionalAffiliation', 'contactPerson', 'followUpContacted', 'dateFollowUpContacted', 'decisionToProceed', 'reasonIfNo',
  'imageListSubmitted', 'imagesMeetQc', 'indexingTermsSubmitted', 'updatedAt', 'updatedBy',
];
const stages = new Set<ChapterStage>(['abstract', 'initial-manuscript', 'feedback-sent', 'revision', 'final-manuscript', 'publisher-submission', 'typeset-submission']);
const wordSources = new Set<WordCountSource>(['docx-properties', 'calculated', 'manual']);

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function normalizeStageRecord(candidate: unknown): ChapterStageRecord {
  if (!candidate || typeof candidate !== 'object') throw new Error('The backup contains invalid stage history.');
  const raw = candidate as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.stage !== 'string' || !stages.has(raw.stage as ChapterStage) || typeof raw.effectiveOn !== 'string' || !isIsoDate(raw.effectiveOn) || typeof raw.recordedAt !== 'string' || !isIsoTimestamp(raw.recordedAt) || typeof raw.recordedBy !== 'string' || !raw.recordedBy.trim() || (raw.state !== 'active' && raw.state !== 'voided')) throw new Error('The backup contains invalid stage history.');
  const record: ChapterStageRecord = { id: raw.id, stage: raw.stage as ChapterStage, effectiveOn: raw.effectiveOn, recordedAt: raw.recordedAt, recordedBy: raw.recordedBy, state: raw.state };
  const stringFields: Array<keyof ChapterStageRecord> = ['sourceFileName', 'sourceRelativePath', 'sourceSha256', 'filesystemCreatedAt', 'filesystemModifiedAt', 'documentCreatedAt', 'documentModifiedAt', 'voidedAt', 'voidedBy', 'voidReason'];
  for (const key of stringFields) { const value = raw[key]; if (value !== undefined && typeof value !== 'string') throw new Error('The backup contains invalid stage history.'); if (typeof value === 'string') (record as any)[key] = value; }
  if (record.sourceRelativePath && !isSafeProjectReference(record.sourceRelativePath)) throw new Error('The backup contains an unsafe folder reference.');
  for (const key of ['roundNumber', 'sourceSizeBytes', 'calculatedWordCount', 'wordCount'] as const) { const value = raw[key]; if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value) || value < 0)) throw new Error('The backup contains invalid stage history.'); if (typeof value === 'number') (record as any)[key] = value; }
  if (record.stage === 'revision' && (!Number.isInteger(record.roundNumber) || (record.roundNumber ?? 0) < 1)) throw new Error('The backup contains invalid stage history.');
  if (record.stage === 'feedback-sent' && (!Number.isInteger(record.roundNumber) || (record.roundNumber ?? -1) < 0)) throw new Error('The backup contains invalid stage history.');
  if (raw.wordCountSource !== undefined && (typeof raw.wordCountSource !== 'string' || !wordSources.has(raw.wordCountSource as WordCountSource))) throw new Error('The backup contains invalid stage history.');
  if (raw.wordCountSource) record.wordCountSource = raw.wordCountSource as WordCountSource;
  return record;
}

/** Validates a local backup and returns only its chapter records for review-first import. */
export function chaptersFromBackup(input: unknown): Chapter[] {
  if (!input || typeof input !== 'object') throw new Error('Invalid backup file format.');
  const backup = input as BackupDocument;
  if (backup.format !== 'editorial-review-tracker-backup' || (backup.version !== 1 && backup.version !== 2)) {
    throw new Error('Invalid backup file format.');
  }
  if (backup.version === 2) {
    if (backup.project !== undefined) validateProjectState(backup.project);
  }
  if (!Array.isArray(backup.collections?.chapters)) throw new Error('The backup does not contain chapter records.');
  return backup.collections.chapters.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('The backup contains an invalid chapter record.');
    const raw = candidate as Partial<Chapter>;
    if (!isSafeChapterId(raw.id) || typeof raw.title !== 'string' || raw.title.trim().length === 0 || raw.title.length >= 500 || typeof raw.contributorName !== 'string' || !raw.contributorName.trim()) throw new Error('The backup contains an invalid chapter record.');
    if (raw.folderUrl !== undefined && (typeof raw.folderUrl !== 'string' || !isSafeProjectReference(raw.folderUrl))) throw new Error('The backup contains an unsafe folder reference.');
    if (raw.feedbackLink !== undefined && (typeof raw.feedbackLink !== 'string' || !isSafeProjectReference(raw.feedbackLink))) throw new Error('The backup contains an unsafe feedback reference.');
    if (raw.submissions !== undefined && !Array.isArray(raw.submissions)) throw new Error('The backup contains invalid stage history.');
    const normalized = createChapter({ id: raw.id, title: raw.title, contributorName: raw.contributorName });
    for (const key of chapterStringFields) { const value = raw[key]; if (value !== undefined && typeof value !== 'string') throw new Error('The backup contains an invalid chapter record.'); if (typeof value === 'string') (normalized as any)[key] = value; }
    if (raw.dataRevision !== undefined && (typeof raw.dataRevision !== 'number' || !Number.isInteger(raw.dataRevision) || raw.dataRevision < 0)) throw new Error('The backup contains an invalid chapter record.');
    if (typeof raw.dataRevision === 'number') normalized.dataRevision = raw.dataRevision;
    if (Array.isArray(raw.submissions)) normalized.submissions = raw.submissions.map(normalizeStageRecord);
    if (!(normalized.submissions ?? []).every(isSafeStageRecord)) throw new Error('The backup contains invalid stage history.');
    return { ...normalized, id: raw.id.trim(), title: raw.title.trim(), contributorName: raw.contributorName.trim() };
  });
}
