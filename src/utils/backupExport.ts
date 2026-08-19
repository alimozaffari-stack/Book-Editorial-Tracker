import { ProjectState } from '../types';

export type ExportDocument = Record<string, unknown>;

interface BackupInput {
  chapters: ExportDocument[];
  users: ExportDocument[];
  auditEvents: ExportDocument[];
  exportedBy: string;
  exportedAt: string;
  project?: ProjectState;
}

export function buildProjectBackup(input: BackupInput) {
  return {
    format: 'editorial-review-tracker-backup',
    version: 2,
    exportedAt: input.exportedAt,
    exportedBy: input.exportedBy,
    ...(input.project ? { project: input.project } : {}),
    collections: {
      chapters: input.chapters,
      users: input.users,
      auditEvents: input.auditEvents,
    },
  };
}

function escapeCsv(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function chaptersToCsv(chapters: ExportDocument[]): string {
  const headers = Array.from(new Set(chapters.flatMap(chapter => Object.keys(chapter))));
  if (headers.length === 0) return '';

  return [
    headers.join(','),
    ...chapters.map(chapter => headers.map(header => escapeCsv(chapter[header])).join(',')),
  ].join('\r\n');
}

export function timestampedBackupFilename(extension: 'json' | 'csv', exportedAt = new Date()): string {
  const stamp = exportedAt.toISOString().replace(/[:.]/g, '-');
  return `editorial-review-tracker-backup-${stamp}.${extension}`;
}
