import { ActivityViewEvent } from '../domain/activityView';
import { isSafeChapterMetadata, isSafeStageRecord } from '../domain/chapterValidation';
import { validateProjectState } from '../domain/projectState';
import { Chapter, ProjectState } from '../types';

export interface PortableProjectFile {
  format: 'book-editorial-tracker-project';
  version: 1;
  projectRevision: number;
  savedAt: string;
  savedBy: string;
  project: ProjectState;
  chapters: Chapter[];
  activity: ActivityViewEvent[];
}

export const PORTABLE_PROJECT_FORMAT = 'book-editorial-tracker-project';
export const PORTABLE_PROJECT_VERSION = 1;
export const MAX_PORTABLE_PROJECT_BYTES = 25 * 1024 * 1024;
export const MAX_PORTABLE_CHAPTERS = 50;
export const MAX_PORTABLE_STAGE_RECORDS_PER_CHAPTER = 100;
export const MAX_PORTABLE_ACTIVITY_RECORDS = 5000;

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function serializedSize(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength;
  return value.length;
}

function hasUnsafeReference(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/^https:\/\//i.test(text)) {
    try {
      const parsed = new URL(text);
      return parsed.protocol !== 'https:';
    } catch {
      return true;
    }
  }
  return /^file:/i.test(text)
    || /^[A-Za-z]:[\\/]/.test(text)
    || /^\/(?!\/)/.test(text)
    || text.includes('..\\')
    || text.includes('../')
    || text.includes('\\');
}

function assertNoUnsafeReferences(value: unknown, path = 'project file'): void {
  if (typeof value === 'string') {
    if (hasUnsafeReference(value)) throw new Error(`The portable project file contains an unsafe reference at ${path}.`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoUnsafeReferences(entry, `${path}[${index}]`));
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    assertNoUnsafeReferences(entry, `${path}.${key}`);
  });
}

function validateActivity(event: unknown): ActivityViewEvent {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Invalid activity record.');
  const candidate = event as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) throw new Error('Invalid activity record.');
  if (typeof candidate.actorEmail !== 'string' || !candidate.actorEmail.trim()) throw new Error('Invalid activity record.');
  if (typeof candidate.action !== 'string' || !candidate.action.trim()) throw new Error('Invalid activity record.');
  if (typeof candidate.summary !== 'string' || !candidate.summary.trim()) throw new Error('Invalid activity record.');
  if (candidate.clientAt !== undefined && !isIsoTimestamp(candidate.clientAt)) throw new Error('Invalid activity record.');
  if (candidate.chapterId !== undefined && typeof candidate.chapterId !== 'string') throw new Error('Invalid activity record.');
  if (candidate.chapterIds !== undefined && (!Array.isArray(candidate.chapterIds) || candidate.chapterIds.some(id => typeof id !== 'string'))) throw new Error('Invalid activity record.');
  return candidate as unknown as ActivityViewEvent;
}

function validateChapter(chapter: unknown): Chapter {
  if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) throw new Error('Invalid chapter record.');
  const candidate = chapter as Chapter;
  assertNoUnsafeReferences(candidate, 'project file.chapters');
  if (!isSafeChapterMetadata(candidate)) throw new Error('Invalid chapter record.');
  if (!Number.isInteger(candidate.dataRevision ?? 0) || (candidate.dataRevision ?? 0) < 0) throw new Error('Invalid chapter record.');
  const records = candidate.submissions ?? [];
  if (!Array.isArray(records)) throw new Error('Invalid chapter record.');
  if (records.length > MAX_PORTABLE_STAGE_RECORDS_PER_CHAPTER) throw new Error('A portable project file may contain at most 100 stage records per chapter.');
  if (records.some(record => !isSafeStageRecord(record))) throw new Error('Invalid chapter stage record.');
  return { ...candidate, submissions: records };
}

export function validatePortableProjectFile(candidate: unknown): PortableProjectFile {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Invalid portable project file.');
  const file = candidate as Record<string, unknown>;
  if (file.format !== PORTABLE_PROJECT_FORMAT) throw new Error('Invalid portable project file format.');
  if (file.version !== PORTABLE_PROJECT_VERSION) throw new Error('Unsupported project file version.');
  if (!Number.isInteger(file.projectRevision) || (file.projectRevision as number) < 0) throw new Error('Invalid project revision.');
  if (!isIsoTimestamp(file.savedAt)) throw new Error('Invalid saved timestamp.');
  if (typeof file.savedBy !== 'string' || !file.savedBy.trim() || file.savedBy.length > 120) throw new Error('Invalid saved-by label.');
  const project = validateProjectState(file.project);
  if (!Array.isArray(file.chapters)) throw new Error('Invalid chapter records.');
  if (file.chapters.length > MAX_PORTABLE_CHAPTERS) throw new Error('A portable project file may contain at most 50 chapters.');
  if (!Array.isArray(file.activity)) throw new Error('Invalid activity records.');
  if (file.activity.length > MAX_PORTABLE_ACTIVITY_RECORDS) throw new Error('A portable project file may contain at most 5000 activity records.');
  const chapters = file.chapters.map(validateChapter);
  const activity = file.activity.map(validateActivity);
  assertNoUnsafeReferences({ ...file, project, chapters, activity });
  return {
    format: PORTABLE_PROJECT_FORMAT,
    version: PORTABLE_PROJECT_VERSION,
    projectRevision: file.projectRevision as number,
    savedAt: file.savedAt as string,
    savedBy: (file.savedBy as string).trim(),
    project,
    chapters,
    activity,
  };
}

export function parsePortableProjectFile(contents: string): PortableProjectFile {
  if (serializedSize(contents) > MAX_PORTABLE_PROJECT_BYTES) throw new Error('The portable project file is larger than 25 MiB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('The portable project file is not valid JSON.');
  }
  return validatePortableProjectFile(parsed);
}

export async function preparePortableProjectOpen(contents: string): Promise<{ file: PortableProjectFile; originalHash: string }> {
  const file = parsePortableProjectFile(contents);
  const originalHash = await hashPortableProjectContents(contents);
  return { file, originalHash };
}

export function serializePortableProjectFile(file: PortableProjectFile): string {
  const rawContents = `${JSON.stringify(file, null, 2)}\n`;
  if (serializedSize(rawContents) > MAX_PORTABLE_PROJECT_BYTES) throw new Error('The portable project file is larger than 25 MiB.');
  const validated = validatePortableProjectFile(file);
  const contents = `${JSON.stringify(validated, null, 2)}\n`;
  if (serializedSize(contents) > MAX_PORTABLE_PROJECT_BYTES) throw new Error('The portable project file is larger than 25 MiB.');
  return contents;
}

export function assertPortableProjectRevision(file: PortableProjectFile, expectedRevision: number): void {
  if (file.projectRevision !== expectedRevision) throw new Error('The portable project file changed since it was opened.');
}

export async function hashPortableProjectContents(contents: string): Promise<string> {
  const encoded = new TextEncoder().encode(contents);
  if (!globalThis.crypto?.subtle) {
    throw new Error('Project file hashing is unavailable in this runtime.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
