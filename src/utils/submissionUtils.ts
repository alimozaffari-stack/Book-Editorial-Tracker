/**
 * Utility functions for handling submission records.
 * These helpers are used by the manual submission intake UI to construct a
 * {@link ChapterStageRecord} that conforms to the data contract defined in
 * `src/types.ts`.
 */

import { ChapterStage, ChapterStageRecord, WordCountSource } from '../types';

/**
 * Parameters required to create a {@link ChapterStageRecord}. All fields are
 * explicitly listed to avoid accidental omission of required metadata.
 */
export interface CreateSubmissionParams {
  /** Stage of the submission (e.g., 'initial', 'revision', etc.). */
  stage: ChapterStage;
  /** Optional revision number for revision‑stage submissions. */
  revisionNumber?: number;
  /** Original file name of the submitted document. */
  sourceFileName: string;
  /** Relative path to the source file within the project (optional). */
  sourceRelativePath?: string;
  /** Size of the source file in bytes. */
  sourceSizeBytes: number;
  /** SHA‑256 hash of the source file (opaque identifier). */
  sourceSha256: string;
  /** Filesystem creation timestamp (ISO string, optional). */
  filesystemCreatedAt?: string;
  /** Filesystem modification timestamp (ISO string). */
  filesystemModifiedAt: string;
  /** Document creation timestamp from DOCX metadata (optional). */
  documentCreatedAt?: string;
  /** Document modification timestamp from DOCX metadata (optional). */
  documentModifiedAt?: string;
  /** Document title from DOCX metadata (optional). */
  documentTitle?: string;
  /** Document creator from DOCX metadata (optional). */
  documentCreator?: string;
  /** Word count calculated from the document content. */
  calculatedWordCount: number;
  /** Final word count value (may be manually corrected). */
  wordCount: number;
  /** Source of the word count value. */
  wordCountSource: WordCountSource;
  /** Editorial submission date confirmed by the user (YYYY‑MM‑DD). */
  submittedOn: string;
  /** Email of the user who recorded the submission. */
  recordedBy: string;
}

/**
 * Create a {@link ChapterStageRecord} from the supplied parameters.
 * The `id` field follows the convention `${stage}:${revisionNumber ?? 0}:${sourceSha256}`.
 */
export function createSubmissionRecord(params: CreateSubmissionParams): ChapterStageRecord {
  const {
    stage,
    revisionNumber,
    sourceFileName,
    sourceRelativePath,
    sourceSizeBytes,
    sourceSha256,
    filesystemCreatedAt,
    filesystemModifiedAt,
    documentCreatedAt,
    documentModifiedAt,
    documentTitle,
    documentCreator,
    calculatedWordCount,
    wordCount,
    wordCountSource,
    submittedOn,
    recordedBy,
  } = params;

  const id = `${stage}:${revisionNumber ?? 0}:${sourceSha256}`;

  const record: ChapterStageRecord = {
    id,
    stage,
    ...(revisionNumber === undefined ? {} : { roundNumber: revisionNumber }),
    sourceFileName,
    ...(sourceRelativePath === undefined ? {} : { sourceRelativePath }),
    sourceSizeBytes,
    sourceSha256,
    ...(filesystemCreatedAt === undefined ? {} : { filesystemCreatedAt }),
    filesystemModifiedAt,
    ...(documentCreatedAt === undefined ? {} : { documentCreatedAt }),
    ...(documentModifiedAt === undefined ? {} : { documentModifiedAt }),
    calculatedWordCount,
    wordCount,
    wordCountSource,
    effectiveOn: submittedOn,
    recordedAt: new Date().toISOString(),
    recordedBy,
    state: 'active',
  };
  return record;
}
