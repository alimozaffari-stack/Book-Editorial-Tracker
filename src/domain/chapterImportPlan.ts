import { Chapter, ChapterImportPlan, ChapterImportPlanEntry } from '../types';
import { createChapter, parseRows } from '../utils/chapterImport';
import { isSafeProjectReference } from './projectReference';
import { isSafeChapterId } from './chapterValidation';

export const MAX_CHAPTER_IMPORT_ROWS = 50;

function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Classifies CSV rows without writing. Existing IDs are intentionally read-only:
 * importing a file can create new records, but can never update existing ones.
 */
export function buildChapterImportPlan(csv: string, existing: Chapter[]): ChapterImportPlan {
  const rows = parseRows(csv);
  if (rows.length === 0) return { entries: [] };

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const requiredColumns = ['chapter_id', 'title', 'contributor_name'];
  const missingHeaders = requiredColumns.filter((column) => !headers.includes(column));
  const entries: ChapterImportPlanEntry[] = [];
  const rowIndexesById: Record<string, number[]> = {};

  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']));
    const rawId = String(row.chapter_id ?? '').trim();
    const title = String(row.title ?? '').trim();
    const contributorName = String(row.contributor_name ?? '').trim();
    const entry: ChapterImportPlanEntry = { rowNumber, normalizedId: rawId ? normalizeId(rawId) : '', disposition: 'invalid', messages: [] };

    if (missingHeaders.length > 0) {
      entry.messages.push(`Missing required column(s): ${missingHeaders.join(', ')}`);
    } else if (!rawId || !title || !contributorName) {
      entry.messages.push('chapter_id, title, and contributor_name are required.');
    } else if (!isSafeChapterId(rawId) || title.length >= 500) {
      entry.messages.push('chapter_id must be a single value under 100 characters and title must be under 500 characters.');
    } else if (!isSafeProjectReference(String(row.folder_url ?? ''))) {
      entry.messages.push('folder_url must be HTTPS or a project-relative reference.');
    } else {
      const normalizedId = normalizeId(rawId);
      entry.normalizedId = normalizedId;
      (rowIndexesById[normalizedId] ??= []).push(entries.length);
      const incoming = createChapter({
        id: rawId, title, contributorName,
        contributorEmail: String(row.contributor_email ?? ''),
        institutionalAffiliation: String(row.institutional_affiliation ?? ''),
        leadEditor: String(row.lead_editor ?? ''), folderUrl: String(row.folder_url ?? ''),
        submittedWordCount: String(row.word_count ?? ''), abstractText: String(row.abstract ?? ''), bioText: String(row.bio ?? ''),
      });
      if (incoming.abstractText) incoming.initialAbstractSubmitted = 'Yes';
      entry.incoming = incoming;
      entry.existing = existing.find((chapter) => normalizeId(chapter.id) === normalizedId);
      entry.baselineRevision = entry.existing?.dataRevision ?? 0;
      entry.disposition = 'new';
    }
    entries.push(entry);
  });

  entries.forEach((entry) => {
    if (entry.disposition === 'invalid') return;
    if ((rowIndexesById[entry.normalizedId] ?? []).length > 1) {
      entry.disposition = 'ambiguous';
      entry.messages.push('Duplicate ID within CSV file.');
    } else if (entry.existing) {
      entry.disposition = 'already-present';
      entry.messages.push('Already in tracker — not changed.');
    } else {
      entry.messages.push('New chapter will be created.');
    }
  });
  entries.filter(entry => entry.disposition === 'new').slice(MAX_CHAPTER_IMPORT_ROWS).forEach(entry => {
    entry.disposition = 'invalid';
    entry.messages.push(`At most ${MAX_CHAPTER_IMPORT_ROWS} new chapters may be imported at once.`);
  });
  return { entries };
}

/** Returns only entries that the user can safely create after review. */
export function selectedNewChapters(plan: ChapterImportPlan): Chapter[] {
  return plan.entries.filter((entry) => entry.disposition === 'new' && entry.incoming).map((entry) => entry.incoming as Chapter);
}

/** Applies the same create-only classifications to chapter records from a local backup. */
export function buildBackupImportPlan(incoming: Chapter[], existing: Chapter[]): ChapterImportPlan {
  const counts = incoming.reduce<Record<string, number>>((result, chapter) => {
    const id = typeof chapter?.id === 'string' ? normalizeId(chapter.id) : '';
    if (id) result[id] = (result[id] ?? 0) + 1;
    return result;
  }, {});
  const plan: ChapterImportPlan = {
    entries: incoming.map((chapter, index) => {
      const normalizedId = typeof chapter?.id === 'string' ? normalizeId(chapter.id) : '';
      const entry: ChapterImportPlanEntry = { rowNumber: index + 1, normalizedId, incoming: chapter, disposition: 'invalid', messages: [] };
      if (!normalizedId || !chapter.title?.trim() || !chapter.contributorName?.trim()) {
        entry.messages.push('chapter_id, title, and contributor_name are required.');
      } else if ((counts[normalizedId] ?? 0) > 1) {
        entry.disposition = 'ambiguous'; entry.messages.push('Duplicate ID within backup.');
      } else {
        entry.existing = existing.find((current) => normalizeId(current.id) === normalizedId);
        entry.baselineRevision = entry.existing?.dataRevision ?? 0;
        if (entry.existing) {
          entry.disposition = 'already-present'; entry.messages.push('Already in tracker — not changed.');
        } else {
          entry.disposition = 'new'; entry.messages.push('New chapter will be created.');
        }
      }
      return entry;
    }),
  };
  plan.entries.filter(entry => entry.disposition === 'new').slice(MAX_CHAPTER_IMPORT_ROWS).forEach(entry => {
    entry.disposition = 'invalid';
    entry.messages.push(`At most ${MAX_CHAPTER_IMPORT_ROWS} new chapters may be imported at once.`);
  });
  return plan;
}
