import { Firestore } from 'firebase/firestore';
import { Chapter, ChapterStageRecord } from '../types';
import { InspectionResult } from '../utils/docxInspection';
import { createChapter } from '../utils/chapterImport';
import { createSubmissionRecord } from '../utils/submissionUtils';
import { getActivityEventRef, getChapterRef, runTransaction } from '../utils/firestoreWrapper';
import { applyStageHistoryProjections } from './chapterStageHistory';
import { writeActivityEvent } from './activityLog';
import { isSafeProjectReference } from './projectReference';
import { isCalendarDate, isSafeChapterId, isSafeChapterMetadata, isSafeStageRecord } from './chapterValidation';
import { ProjectStageProposal, chapterIdFromFolder, proposalFromStageFolder } from './projectFolderScan';
import { MAX_CHAPTER_IMPORT_ROWS } from './chapterImportPlan';

export type ProjectImportDisposition = 'Ready' | 'Already recorded' | 'Needs review' | 'Unsupported' | 'Unmatched chapter';
export interface ProjectScanFile { relativePath: string; extension: string; sizeBytes: number; filesystemModifiedAt: string; }
export interface ProjectFolderScan { displayLabel: string; chapterFolders: Array<{ name: string; stageFolders: Array<{ name: string; files: ProjectScanFile[] }> }>; }
export interface ProjectImportEntry {
  chapterId?: string;
  file: ProjectScanFile;
  proposal?: ProjectStageProposal;
  disposition: ProjectImportDisposition;
  message: string;
  selected: boolean;
  inspected: boolean;
  record?: ChapterStageRecord;
}
export interface ProjectImportPlan { entries: ProjectImportEntry[]; expectedRevisions: Record<string, number>; }
export interface SelectedProjectDocx { fileName: string; sizeBytes: number; sha256: string; filesystemCreatedAt?: string; filesystemModifiedAt: string; }
export interface ProjectImportResult {
  chaptersChanged: number;
  stageRecordsAdded: number;
  alreadyRecorded: number;
  excluded: number;
  unsupported: number;
  failed: number;
  changedChapters: Chapter[];
}

export interface ChapterInventoryRow {
  chapterId: string;
  title: string;
  contributorName: string;
  submissionReference: string;
  discoveredFileCount: number;
  selected: boolean;
  validationError: string;
}

const inventoryReferenceFileSuffix = (relativePath: string): string => {
  const trimmed = relativePath.trim();
  const lastSlash = trimmed.lastIndexOf('/');
  return lastSlash < 0 ? '' : trimmed.slice(0, lastSlash);
};

function normalizeId(value: string): string {
  return value.trim();
}

function normalizedInventoryId(value: string): string {
  return normalizeId(value).toUpperCase();
}

export function validateInventoryChaptersForCreation(
  chapters: Chapter[],
  existingChapters: Array<Pick<Chapter, 'id'>>,
): string | null {
  if (!chapters.length) {
    return 'Nothing was created. Select at least one chapter from the inventory.';
  }
  if (chapters.length > MAX_CHAPTER_IMPORT_ROWS) {
    return `Nothing was created. Select at most ${MAX_CHAPTER_IMPORT_ROWS} chapters from the inventory and try again.`;
  }

  const existingIds = new Set(existingChapters.map(chapter => normalizedInventoryId(chapter.id)));
  const seen = new Set<string>();
  for (const chapter of chapters) {
    const normalizedId = normalizedInventoryId(chapter.id);
    const hasStageHistory = (chapter.submissions?.length ?? 0) > 0;
    const hasInvalidStageHistory = (chapter.submissions ?? []).some(record => !isSafeStageRecord(record));
    if (!normalizedId || !isSafeChapterMetadata(chapter) || !chapter.contributorName?.trim() || hasStageHistory || hasInvalidStageHistory) {
      return 'Nothing was created. Invalid chapter inventory metadata.';
    }
    if (seen.has(normalizedId)) {
      return 'Nothing was created. Selected chapter IDs must be unique.';
    }
    if (existingIds.has(normalizedId)) {
      return 'Nothing was created. A selected chapter already exists.';
    }
    seen.add(normalizedId);
  }
  return null;
}

export function buildChapterInventoryRows(scan: ProjectImportPlan): ChapterInventoryRow[] {
  const byChapter = new Map<string, { reference: string; count: number }>();
  for (const entry of scan.entries) {
    if (entry.disposition !== 'Unmatched chapter') continue;
    if (!entry.chapterId) continue;
    const chapterId = normalizeId(entry.chapterId);
    const prior = byChapter.get(chapterId) ?? { reference: '', count: 0 };
    if (!prior.reference) {
      const fallback = inventoryReferenceFileSuffix(entry.file.relativePath);
      prior.reference = isSafeProjectReference(fallback) ? fallback : '';
    }
    prior.count += 1;
    byChapter.set(chapterId, prior);
  }
  return [...byChapter.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([chapterId, detail]) => ({
      chapterId,
      title: '',
      contributorName: '',
      submissionReference: detail.reference,
      discoveredFileCount: detail.count,
      selected: true,
      validationError: '',
    }));
}

export function validateChapterInventoryRows(rows: ChapterInventoryRow[], existingChapters: Chapter[]): ChapterInventoryRow[] {
  const existingIds = new Set(existingChapters.map(chapter => normalizedInventoryId(chapter.id)));
  const selectedCounts = rows.reduce<Map<string, number>>((counts, row) => {
    const candidateId = normalizeId(row.chapterId);
    if (!row.selected || !candidateId) return counts;
    const normalizedId = normalizedInventoryId(candidateId);
    counts.set(normalizedId, (counts.get(normalizedId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  return rows.map(row => {
    const candidateId = normalizeId(row.chapterId);
    const normalizedId = normalizedInventoryId(candidateId);
    let validationError = '';
    if (!candidateId) {
      validationError = 'A chapter ID is required.';
    } else if (!isSafeChapterId(candidateId)) {
      validationError = 'The chapter ID contains invalid characters or is too long.';
    } else if (existingIds.has(normalizedId)) {
      validationError = 'This chapter ID already exists in the tracker.';
    } else if (row.selected && (selectedCounts.get(normalizedId) ?? 0) > 1) {
      validationError = 'Chapter IDs in the proposal must be unique.';
    }
    if (!validationError && row.selected) {
      if (!row.title.trim()) {
        validationError = 'Title is required.';
      } else if (!row.contributorName.trim()) {
        validationError = 'Contributor name is required.';
      }
    }
    if (!validationError && row.submissionReference && !isSafeProjectReference(row.submissionReference)) {
      validationError = 'Submission reference must be a safe project reference.';
    }
    return {
      ...row,
      chapterId: candidateId,
      validationError,
    };
  });
}

export function chapterInventoryRowsToChapters(rows: ChapterInventoryRow[]): Chapter[] {
  return rows
    .filter(row => row.selected)
    .filter(row => !row.validationError)
    .map(row => createChapter({
      id: normalizeId(row.chapterId),
      title: row.title.trim(),
      contributorName: row.contributorName.trim(),
      folderUrl: row.submissionReference.trim(),
    }));
}

export function canCreateFromInventoryRows(rows: ChapterInventoryRow[]): boolean {
  const selected = rows.filter(row => row.selected);
  return selected.length > 0 && selected.length <= MAX_CHAPTER_IMPORT_ROWS && selected.every(row => !row.validationError);
}

export function finalizeAppliedProjectImport(plan: ProjectImportPlan, result: ProjectImportResult): ProjectImportPlan {
  const appliedHashes = new Set(result.changedChapters.flatMap(chapter =>
    (chapter.submissions ?? []).filter(record => record.state === 'active').map(record => record.sourceSha256).filter((hash): hash is string => Boolean(hash)),
  ));
  return {
    ...plan,
    entries: plan.entries.map(entry => entry.selected && entry.inspected && entry.record?.sourceSha256 && appliedHashes.has(entry.record.sourceSha256)
      ? { ...entry, disposition: 'Already recorded', message: 'Added in this import.', selected: false, record: undefined }
      : entry),
  };
}

function sameStage(left: Pick<ChapterStageRecord, 'stage' | 'roundNumber'>, right: ProjectStageProposal): boolean {
  return left.stage === right.stage && (left.roundNumber ?? 0) === (right.roundNumber ?? 0);
}

export function planProjectImport(scan: ProjectFolderScan, chapters: Chapter[]): ProjectImportPlan {
  const existing = new Map(chapters.map(chapter => [chapter.id.toUpperCase(), chapter]));
  const entries: ProjectImportEntry[] = scan.chapterFolders.flatMap(folder => {
    const detectedChapterId = chapterIdFromFolder(folder.name);
    const matchedChapter = detectedChapterId ? existing.get(detectedChapterId.toUpperCase()) : undefined;
    const chapterId = matchedChapter?.id ?? detectedChapterId;
    return folder.stageFolders.flatMap(stageFolder => stageFolder.files.map(file => {
      const proposal = proposalFromStageFolder(stageFolder.name);
      if (!chapterId || !matchedChapter) return { chapterId, file, proposal, disposition: 'Unmatched chapter', message: 'Import chapter list first.', selected: false, inspected: false } as ProjectImportEntry;
      if (file.extension !== '.docx') return { chapterId, file, proposal, disposition: 'Unsupported', message: 'Only Word documents can be inspected.', selected: false, inspected: false } as ProjectImportEntry;
      if (!proposal) return { chapterId, file, disposition: 'Needs review', message: 'Stage folder is not recognised.', selected: false, inspected: false } as ProjectImportEntry;
      const possibleExistingStage = (matchedChapter.submissions ?? []).some(record => record.state === 'active' && sameStage(record, proposal));
      return { chapterId, file, proposal, disposition: possibleExistingStage ? 'Needs review' : 'Ready', message: possibleExistingStage ? 'This chapter already has an active record for the proposed stage and round.' : 'Ready for explicit Word-document inspection.', selected: !possibleExistingStage, inspected: false } as ProjectImportEntry;
    }));
  });

  const candidateCounts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.chapterId || !entry.proposal || entry.file.extension !== '.docx') continue;
    const key = `${entry.chapterId}:${entry.proposal.stage}:${entry.proposal.roundNumber ?? 0}`;
    candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1);
  }
  for (const entry of entries) {
    if (!entry.chapterId || !entry.proposal) continue;
    const key = `${entry.chapterId}:${entry.proposal.stage}:${entry.proposal.roundNumber ?? 0}`;
    if ((candidateCounts.get(key) ?? 0) > 1 && entry.disposition === 'Ready') {
      entry.disposition = 'Needs review';
      entry.message = 'Several files could represent this stage and round. Choose one explicitly.';
      entry.selected = false;
    }
  }
  return { entries, expectedRevisions: Object.fromEntries(chapters.map(chapter => [chapter.id, chapter.dataRevision ?? 0])) };
}

/** Re-evaluates unmatched rows after a chapter-list import without changing reviewed baselines. */
export function recalculateProjectImport(plan: ProjectImportPlan, scan: ProjectFolderScan, chapters: Chapter[]): ProjectImportPlan {
  const recalculated = planProjectImport(scan, chapters);
  const previous = new Map(plan.entries.map(entry => [entry.file.relativePath, entry]));
  return {
    entries: recalculated.entries.map(entry => {
      const prior = previous.get(entry.file.relativePath);
      if (prior?.inspected && prior.chapterId?.toLowerCase() === entry.chapterId?.toLowerCase()) return prior;
      if (prior?.disposition === 'Unmatched chapter') {
        return { ...entry, selected: false, inspected: false };
      }
      return entry;
    }),
    expectedRevisions: { ...recalculated.expectedRevisions, ...plan.expectedRevisions },
  };
}

export function markProjectFileInspected(
  plan: ProjectImportPlan,
  relativePath: string,
  selectedFile: SelectedProjectDocx,
  inspection: InspectionResult,
  chapters: Chapter[],
  actor: string,
): ProjectImportPlan {
  if (!inspection.valid || selectedFile.sha256 !== inspection.hash) throw new Error('The selected Word document failed bounded inspection.');
  return { ...plan, entries: plan.entries.map(entry => {
    if (entry.file.relativePath !== relativePath) return entry;
    if (!entry.chapterId || !entry.proposal) throw new Error('The inspected file has no confirmed chapter and stage.');
    const chapter = chapters.find(candidate => candidate.id.toUpperCase() === entry.chapterId?.toUpperCase());
    if (!chapter) throw new Error('The target chapter no longer exists.');
    const active = (chapter.submissions ?? []).filter(record => record.state === 'active');
    if (active.some(record => record.sourceSha256 === selectedFile.sha256)) {
      return { ...entry, disposition: 'Already recorded' as const, message: 'This exact file is already recorded for this chapter.', selected: false, inspected: true, record: undefined };
    }
    const record = createSubmissionRecord({
      stage: entry.proposal.stage,
      revisionNumber: entry.proposal.roundNumber,
      sourceFileName: selectedFile.fileName,
      sourceRelativePath: entry.file.relativePath,
      sourceSizeBytes: selectedFile.sizeBytes,
      sourceSha256: selectedFile.sha256,
      filesystemCreatedAt: selectedFile.filesystemCreatedAt,
      filesystemModifiedAt: selectedFile.filesystemModifiedAt,
      documentCreatedAt: inspection.documentCreatedAt,
      documentModifiedAt: inspection.documentModifiedAt,
      documentTitle: inspection.documentTitle,
      documentCreator: inspection.documentCreator,
      calculatedWordCount: inspection.calculatedWordCount,
      wordCount: inspection.calculatedWordCount,
      wordCountSource: inspection.wordCountSource,
      submittedOn: (inspection.documentModifiedAt ?? selectedFile.filesystemModifiedAt).slice(0, 10),
      recordedBy: actor,
    });
    const suspectedDuplicate = active.some(current => sameStage(current, entry.proposal!));
    const requiresRound = entry.proposal.stage === 'revision'
      ? !Number.isInteger(entry.proposal.roundNumber) || (entry.proposal.roundNumber ?? 0) < 1
      : entry.proposal.stage === 'feedback-sent'
        ? !Number.isInteger(entry.proposal.roundNumber) || (entry.proposal.roundNumber ?? -1) < 0
        : false;
    const disposition = suspectedDuplicate || requiresRound || entry.disposition === 'Needs review' ? 'Needs review' : 'Ready';
    const message = disposition === 'Ready' ? 'Inspected and ready to add.' : requiresRound ? 'Enter the feedback or revision round before selecting this record.' : 'Review the proposed stage and round before selecting this record.';
    return { ...entry, disposition, message, selected: disposition === 'Ready' || (entry.selected && !requiresRound), inspected: true, record };
  }) };
}

export function setProjectEntrySelected(plan: ProjectImportPlan, relativePath: string, selected: boolean): ProjectImportPlan {
  return { ...plan, entries: plan.entries.map(entry => entry.file.relativePath === relativePath && entry.chapterId && entry.proposal && entry.file.extension === '.docx' && (entry.disposition === 'Ready' || entry.disposition === 'Needs review') ? { ...entry, selected } : entry) };
}

export function updateProjectEntryProposal(plan: ProjectImportPlan, relativePath: string, proposal?: ProjectStageProposal): ProjectImportPlan {
  return { ...plan, entries: plan.entries.map(entry => {
    if (entry.file.relativePath !== relativePath || !entry.chapterId || entry.file.extension !== '.docx') return entry;
    return { ...entry, proposal, disposition: proposal ? 'Needs review' : 'Needs review', selected: false, inspected: false, record: undefined, message: proposal ? 'Classification changed. Select this file for bounded inspection.' : 'Choose a supported stage before inspection.' };
  }) };
}

export function updateProjectInspectedRecord(
  plan: ProjectImportPlan,
  relativePath: string,
  changes: Partial<Pick<ChapterStageRecord, 'stage' | 'roundNumber' | 'effectiveOn' | 'wordCount'>>,
): ProjectImportPlan {
  return { ...plan, entries: plan.entries.map(entry => {
    if (entry.file.relativePath !== relativePath || !entry.record) return entry;
    const stage = changes.stage ?? entry.record.stage;
    const roundNumber = stage === 'revision' || stage === 'feedback-sent' ? changes.roundNumber ?? entry.record.roundNumber : undefined;
    const effectiveOn = changes.effectiveOn ?? entry.record.effectiveOn;
    const wordCount = changes.wordCount ?? entry.record.wordCount ?? entry.record.calculatedWordCount ?? 0;
    const record = { ...entry.record, stage, roundNumber, effectiveOn, wordCount, wordCountSource: wordCount === entry.record.calculatedWordCount ? entry.record.wordCountSource : 'manual' as const, id: `${stage}:${roundNumber ?? 0}:${entry.record.sourceSha256 ?? entry.record.id}` };
    if (stage === 'revision' && (!Number.isInteger(roundNumber) || (roundNumber ?? 0) < 1)) return { ...entry, proposal: { stage, roundNumber }, record, selected: false, message: 'Enter a whole-number revision round of 1 or more.' };
    if (stage === 'feedback-sent' && (!Number.isInteger(roundNumber) || (roundNumber ?? -1) < 0)) return { ...entry, proposal: { stage, roundNumber }, record, selected: false, message: 'Enter a whole-number feedback round of 0 or more.' };
    if (!isCalendarDate(effectiveOn) || !Number.isInteger(wordCount) || wordCount < 0) return { ...entry, proposal: { stage, roundNumber }, record, selected: false, message: 'Confirm a valid date and whole-number word count.' };
    return { ...entry, proposal: { stage, roundNumber }, record, selected: true, message: 'Reviewed and selected to add.' };
  }) };
}

function csvCell(value: unknown): string { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export function projectImportPlanCsv(plan: ProjectImportPlan): string {
  return ['chapter_id,relative_path,extension,size_bytes,proposed_stage,round,outcome,selected,message', ...plan.entries.map(entry => [entry.chapterId, entry.file.relativePath, entry.file.extension, entry.file.sizeBytes, entry.proposal?.stage, entry.proposal?.roundNumber, entry.disposition, entry.selected, entry.message].map(csvCell).join(','))].join('\r\n');
}

export function projectImportPlanMarkdown(plan: ProjectImportPlan, displayLabel: string): string {
  const safe = (value: unknown) => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [`# Project scan: ${displayLabel}`, '', 'This report contains project-relative references only. The scan did not change source files.', '', '| Chapter | Relative file | Proposed stage | Outcome | Selected |', '|---|---|---|---|---|', ...plan.entries.map(entry => `| ${safe(entry.chapterId)} | ${safe(entry.file.relativePath)} | ${safe(entry.proposal?.stage)} | ${safe(entry.disposition)} | ${entry.selected ? 'Yes' : 'No'} |`), ''].join('\n');
}

/** Applies all explicitly approved history records in one revision-checked transaction. */
export async function applyProjectImport(
  db: Firestore,
  plan: ProjectImportPlan,
  actor: string,
): Promise<ProjectImportResult> {
  const selected = plan.entries.filter(entry => entry.selected);
  if (!selected.length) throw new Error('Select at least one inspected stage record to add.');
  if (selected.some(entry => !entry.inspected || !entry.record || !entry.chapterId)) {
    throw new Error('Every selected file must be inspected and matched before it can be added.');
  }

  const grouped = new Map<string, ChapterStageRecord[]>();
  const allowedStages = new Set(['abstract', 'initial-manuscript', 'feedback-sent', 'revision', 'final-manuscript', 'publisher-submission', 'typeset-submission']);
  for (const entry of selected) {
    const chapterId = entry.chapterId!;
    const record = entry.record!;
    if (!record.sourceRelativePath || !isSafeProjectReference(record.sourceRelativePath)) {
      throw new Error('A selected stage record contains an unsafe project reference.');
    }
    const invalidRound = record.stage === 'revision'
      ? !Number.isInteger(record.roundNumber) || (record.roundNumber ?? 0) < 1
      : record.stage === 'feedback-sent'
        ? !Number.isInteger(record.roundNumber) || (record.roundNumber ?? -1) < 0
        : false;
    if (!allowedStages.has(record.stage) || record.state !== 'active' || !isCalendarDate(record.effectiveOn) || !Number.isInteger(record.wordCount ?? record.calculatedWordCount ?? 0) || (record.wordCount ?? record.calculatedWordCount ?? 0) < 0 || invalidRound) {
      throw new Error('A selected stage record still needs a valid stage, round, date, or word count.');
    }
    const records = grouped.get(chapterId) ?? [];
    const duplicateHash = records.some(existing => existing.sourceSha256 && existing.sourceSha256 === record.sourceSha256);
    const duplicateStage = records.some(existing => existing.stage === record.stage && (existing.roundNumber ?? 0) === (record.roundNumber ?? 0));
    if (duplicateHash || duplicateStage) throw new Error(`Choose only one file for each stage and round in ${chapterId}.`);
    records.push(record);
    grouped.set(chapterId, records);
  }
  if (grouped.size > 50) throw new Error('A project import may change at most 50 chapters at once.');

  const chapterIds = [...grouped.keys()];
  const changedChapters = await runTransaction(db, async transaction => {
    const refs = chapterIds.map(chapterId => getChapterRef(db, chapterId));
    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
    const updates: Chapter[] = [];
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];
      const chapterId = chapterIds[index];
      if (!snapshot.exists()) throw new Error(`Nothing was changed. ${chapterId} no longer exists.`);
      const current = snapshot.data() as Chapter;
      if ((current.dataRevision ?? 0) !== plan.expectedRevisions[chapterId]) {
        throw new Error(`Nothing was changed. ${chapterId} changed after the preview.`);
      }
      const incomingRecords = grouped.get(chapterId)!;
      const activeHashes = new Set((current.submissions ?? []).filter(record => record.state === 'active').map(record => record.sourceSha256).filter(Boolean));
      if (incomingRecords.some(record => record.sourceSha256 && activeHashes.has(record.sourceSha256))) {
        throw new Error(`Nothing was changed. A selected file is already recorded for ${chapterId}.`);
      }
      const activeStages = (current.submissions ?? []).filter(record => record.state === 'active');
      if (incomingRecords.some(record => activeStages.some(existing => existing.stage === record.stage && (existing.roundNumber ?? 0) === (record.roundNumber ?? 0)))) {
        throw new Error(`Nothing was changed. ${chapterId} already has an active record for a selected stage and round.`);
      }
      const merged = applyStageHistoryProjections(current, [...(current.submissions ?? []), ...incomingRecords]);
      const updated: Chapter = {
        ...merged,
        dataRevision: (current.dataRevision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: actor,
      };
      transaction.set(refs[index], updated);
      updates.push(updated);
    }
    writeActivityEvent(transaction, {
      ref: getActivityEventRef(db),
      actorEmail: actor,
      action: 'project-history-imported',
      summary: `Added ${selected.length} stage record${selected.length === 1 ? '' : 's'} to ${updates.length} chapter${updates.length === 1 ? '' : 's'}`,
      chapterIds,
      changedFields: ['submissions'],
      counts: Object.fromEntries(chapterIds.map(chapterId => [chapterId, grouped.get(chapterId)!.length])),
    });
    return updates;
  });

  return {
    chaptersChanged: changedChapters.length,
    stageRecordsAdded: selected.length,
    alreadyRecorded: plan.entries.filter(entry => entry.disposition === 'Already recorded').length,
    excluded: plan.entries.filter(entry => !entry.selected && entry.disposition !== 'Already recorded' && entry.disposition !== 'Unsupported').length,
    unsupported: plan.entries.filter(entry => entry.disposition === 'Unsupported').length,
    failed: 0,
    changedChapters,
  };
}
