import { Chapter, ChapterStageRecord } from '../types';
import { isSafeProjectReference } from './projectReference';

const stages = new Set(['abstract', 'initial-manuscript', 'feedback-sent', 'revision', 'final-manuscript', 'publisher-submission', 'typeset-submission']);

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function isSafeChapterId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length < 100 && !/[\\/]/.test(value);
}

export function isSafeChapterMetadata(chapter: Pick<Chapter, 'id' | 'title' | 'folderUrl' | 'feedbackLink'>): boolean {
  return isSafeChapterId(chapter.id) && typeof chapter.title === 'string' && chapter.title.trim().length > 0 && chapter.title.length < 500
    && isSafeProjectReference(chapter.folderUrl ?? '') && isSafeProjectReference(chapter.feedbackLink ?? '');
}

export function isSafeStageRecord(record: ChapterStageRecord): boolean {
  const fileName = record.sourceFileName;
  const validFilename = fileName === undefined || (fileName.length > 0 && fileName.length <= 255 && !/[\\/:]/.test(fileName));
  const validRound = record.stage === 'revision'
    ? Number.isInteger(record.roundNumber) && (record.roundNumber ?? 0) >= 1
    : record.stage === 'feedback-sent'
      ? Number.isInteger(record.roundNumber) && (record.roundNumber ?? -1) >= 0
      : record.roundNumber === undefined;
  return typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 300
    && stages.has(record.stage) && validRound && validFilename
    && isSafeProjectReference(record.sourceRelativePath ?? '')
    && isCalendarDate(record.effectiveOn)
    && typeof record.recordedBy === 'string' && record.recordedBy.trim().length > 0
    && (record.state === 'active' || record.state === 'voided');
}
