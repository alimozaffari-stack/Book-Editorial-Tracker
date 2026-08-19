import { Firestore, collection, query } from 'firebase/firestore';
import { runTransaction, getActivityEventRef, getChapterRef } from './firestoreWrapper';
import { Chapter, ChapterStageRecord } from '../types';
import { writeActivityEvent } from '../domain/activityLog';
import { applyStageHistoryProjections, chapterStageRank, clearLegacyStageProjection, deriveCurrentStage, projectLegacyStageFields } from '../domain/chapterStageHistory';
import { isSafeProjectReference } from '../domain/projectReference';
import { isSafeChapterMetadata, isSafeStageRecord } from '../domain/chapterValidation';
import { validateInventoryChaptersForCreation } from '../domain/projectImportPlan';

/**
 * Result of a revision-aware write operation.
 */
export type WriteResult =
  | { kind: 'ok'; new: Chapter }
  | { kind: 'duplicate'; current: Chapter }
  | { kind: 'stage-conflict'; current: Chapter; conflictingRecords: ChapterStageRecord[] }
  | { kind: 'unchanged'; current: Chapter }
  | { kind: 'conflict'; current: Chapter };

/**
 * Save a chapter document with revision checking.
 *
 * @param db Firestore instance
 * @param incoming Chapter data to write (must include `id`)
 * @param expectedRevision The revision number the caller expects the document to have.
 * @param actor Email of the user performing the write (for audit fields)
 * @returns WriteResult indicating success or conflict.
 */
export async function saveChapterWithRevision(
  db: Firestore,
  incoming: Chapter,
  expectedRevision: number,
  actor: string,
): Promise<WriteResult> {
  if (!isSafeChapterMetadata(incoming) || (incoming.submissions ?? []).some(record => !isSafeStageRecord(record))) throw new Error('Chapter metadata or stage history is invalid.');
  const chapterRef = getChapterRef(db, incoming.id);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chapterRef);
    const current: Chapter = snap.exists() ? (snap.data() as Chapter) : ({} as Chapter);
    const currentRevision = current.dataRevision ?? 0;
    if (currentRevision !== expectedRevision) {
      // Conflict – return the current document without writing.
      return { kind: 'conflict', current } as WriteResult;
    }
    // Merge fields, preserving server‑side submissions and incrementing revision.
    const changedFields = Object.keys(incoming).filter(key =>
      !['id', 'dataRevision', 'updatedAt', 'updatedBy', 'submissions'].includes(key)
      && (incoming as any)[key] !== (current as any)[key],
    );
    if (snap.exists() && changedFields.length === 0) {
      return { kind: 'unchanged', current } as WriteResult;
    }
    const merged: Chapter = {
      ...incoming,
      // Preserve existing submissions if any.
      submissions: current.submissions ?? [],
      dataRevision: currentRevision + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    };
    transaction.set(chapterRef, merged);
    writeActivityEvent(transaction, {
      ref: getActivityEventRef(db), actorEmail: actor,
      action: snap.exists() ? 'chapter-updated' : 'chapter-created',
      summary: snap.exists() ? `Updated ${incoming.id}` : `Created ${incoming.id}`,
      chapterId: incoming.id, changedFields, revisionBefore: currentRevision, revisionAfter: merged.dataRevision,
    });
    return { kind: 'ok', new: merged } as WriteResult;
  });
}

/** Appends exactly one confirmed stage record without using a general chapter save. */
export async function appendStageRecordWithRevision(
  db: Firestore, chapterId: string, record: ChapterStageRecord, expectedRevision: number, actor: string,
): Promise<WriteResult> {
  if (!isSafeStageRecord(record)) throw new Error('Stage record metadata is invalid.');
  const chapterRef = getChapterRef(db, chapterId);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chapterRef);
    const current = snap.exists() ? snap.data() as Chapter : undefined;
    if (!current || (current.dataRevision ?? 0) !== expectedRevision) {
      return { kind: 'conflict', current: current ?? {} as Chapter } as WriteResult;
    }
    const currentRecords = current.submissions ?? [];
    const duplicateHash = record.sourceSha256 && currentRecords.some(existing => existing.state === 'active' && existing.sourceSha256 === record.sourceSha256);
    if (duplicateHash) return { kind: 'duplicate', current } as WriteResult;
    const conflictingRecords = currentRecords.filter(existing =>
      existing.state === 'active' && chapterStageRank(existing) === chapterStageRank(record));
    if (conflictingRecords.length) return { kind: 'stage-conflict', current, conflictingRecords } as WriteResult;
    const merged: Chapter = {
      ...applyStageHistoryProjections(current, [...currentRecords, record]),
      dataRevision: (current.dataRevision ?? 0) + 1, updatedAt: new Date().toISOString(), updatedBy: actor,
    };
    transaction.set(chapterRef, merged);
    writeActivityEvent(transaction, {
      ref: getActivityEventRef(db), actorEmail: actor, action: 'stage-record-added',
      summary: `Added ${record.stage} to ${chapterId}`, chapterId, changedFields: ['submissions'],
      revisionBefore: current.dataRevision ?? 0, revisionAfter: merged.dataRevision,
    });
    return { kind: 'ok', new: merged } as WriteResult;
  });
}

/** Voids one mistaken history record while preserving an immutable explanation. */
export async function voidStageRecordWithRevision(
  db: Firestore,
  chapterId: string,
  recordId: string,
  reason: string,
  expectedRevision: number,
  actor: string,
): Promise<WriteResult> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error('A reason is required.');
  const chapterRef = getChapterRef(db, chapterId);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(chapterRef);
    const current = snapshot.exists() ? snapshot.data() as Chapter : undefined;
    if (!current || (current.dataRevision ?? 0) !== expectedRevision) {
      return { kind: 'conflict', current: current ?? {} as Chapter } as WriteResult;
    }
    const records = current.submissions ?? [];
    const target = records.find(record => record.id === recordId && record.state === 'active');
    if (!target) return { kind: 'conflict', current } as WriteResult;
    const now = new Date().toISOString();
    const updatedRecords = records.map(record => record.id === recordId ? {
      ...record,
      state: 'voided' as const,
      voidedAt: now,
      voidedBy: actor,
      voidReason: trimmedReason,
    } : record);
    const sameStageReplacement = [...updatedRecords]
      .filter(record => record.state === 'active' && record.stage === target.stage)
      .sort((left, right) => right.effectiveOn.localeCompare(left.effectiveOn))[0];
    let rebuilt = clearLegacyStageProjection(current, target.stage);
    if (sameStageReplacement) rebuilt = { ...rebuilt, ...projectLegacyStageFields(sameStageReplacement) };
    const newCurrentStage = deriveCurrentStage(updatedRecords);
    if (newCurrentStage) rebuilt = { ...rebuilt, ...projectLegacyStageFields(newCurrentStage) };
    const merged: Chapter = {
      ...rebuilt,
      submissions: updatedRecords,
      dataRevision: (current.dataRevision ?? 0) + 1,
      updatedAt: now,
      updatedBy: actor,
    };
    transaction.set(chapterRef, merged);
    writeActivityEvent(transaction, {
      ref: getActivityEventRef(db), actorEmail: actor, action: 'stage-record-voided',
      summary: `Marked a ${target.stage} record as entered by mistake for ${chapterId}`,
      chapterId, changedFields: ['submissions'], revisionBefore: current.dataRevision ?? 0, revisionAfter: merged.dataRevision,
    });
    return { kind: 'ok', new: merged } as WriteResult;
  });
}

/**
 * Update specific fields of a chapter with revision bump.
 *
 * @param db Firestore instance
 * @param chapterId ID of the chapter to update
 * @param fields Partial fields to update (excluding `id`)
 * @param actor Email of the user performing the update
 * @returns WriteResult indicating success or conflict.
 */
export async function updateChapterFields(
  db: Firestore,
  chapterId: string,
  fields: Partial<Chapter>,
  actor: string,
): Promise<WriteResult> {
  const chapterRef = getChapterRef(db, chapterId);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chapterRef);
    if (!snap.exists()) {
      // If the document does not exist, treat as conflict with empty current.
      return { kind: 'conflict', current: {} as Chapter } as WriteResult;
    }
    const current: Chapter = snap.data() as Chapter;
    const merged: Chapter = {
      ...current,
      ...fields,
      dataRevision: (current.dataRevision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    };
    transaction.set(chapterRef, merged);
    writeActivityEvent(transaction, {
      ref: getActivityEventRef(db), actorEmail: actor, action: 'chapter-updated',
      summary: `Updated ${chapterId}`, chapterId, changedFields: Object.keys(fields),
      revisionBefore: current.dataRevision ?? 0, revisionAfter: merged.dataRevision,
    });
    return { kind: 'ok', new: merged } as WriteResult;
  });
}

/** Applies one status field to a selected set and records one summary event. */
export async function updateChapterFieldsBatch(
  db: Firestore, chapterIds: string[], field: keyof Chapter, value: string, actor: string,
): Promise<void> {
  return runTransaction(db, async transaction => {
    const refs = chapterIds.map(id => getChapterRef(db, id));
    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
    if (snapshots.some(snapshot => !snapshot.exists())) throw new Error('A selected chapter no longer exists.');
    snapshots.forEach((snapshot, index) => {
      const current = snapshot.data() as Chapter;
      transaction.set(refs[index], { ...current, [field]: value, dataRevision: (current.dataRevision ?? 0) + 1, updatedAt: new Date().toISOString(), updatedBy: actor });
    });
    writeActivityEvent(transaction, { ref: getActivityEventRef(db), actorEmail: actor, action: 'batch-status-updated', summary: `Updated ${chapterIds.length} chapter${chapterIds.length === 1 ? '' : 's'}`, chapterIds, changedFields: [field], counts: { chapters: chapterIds.length } });
  });
}

/** Creates only records that are absent and logs the resulting summary atomically. */
export async function createChaptersIfAbsent(
  db: Firestore, chapters: Chapter[], actor: string, source: string,
): Promise<{ created: string[]; skipped: string[] }> {
  if (chapters.some(chapter => !isSafeChapterMetadata(chapter) || (chapter.submissions ?? []).some(record => !isSafeStageRecord(record)))) throw new Error('Chapter metadata or stage history is invalid.');
  return runTransaction(db, async transaction => {
    const refs = chapters.map(chapter => getChapterRef(db, chapter.id));
    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
    const created: string[] = []; const skipped: string[] = [];
    snapshots.forEach((snapshot, index) => {
      const chapter = chapters[index];
      if (snapshot.exists()) { skipped.push(chapter.id); return; }
      const saved = { ...chapter, dataRevision: 1, updatedAt: new Date().toISOString(), updatedBy: actor, submissions: chapter.submissions ?? [] };
      transaction.set(refs[index], saved); created.push(chapter.id);
    });
    if (created.length) writeActivityEvent(transaction, { ref: getActivityEventRef(db), actorEmail: actor, action: 'chapter-imported', summary: `Imported ${created.length} chapter${created.length === 1 ? '' : 's'} from ${source}`, chapterIds: created, counts: { created: created.length, skipped: skipped.length } });
    return { created, skipped };
  });
}

/** Creates all reviewed inventory chapters atomically; any existing chapter ID aborts the write. */
export async function createInventoryChaptersIfAbsent(
  db: Firestore, chapters: Chapter[], actor: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const initialValidationError = validateInventoryChaptersForCreation(chapters, []);
  if (initialValidationError) throw new Error(initialValidationError);
  return runTransaction(db, async transaction => {
    const liveSnapshot = await ((transaction as unknown) as { get: (target: unknown) => Promise<{ docs: Array<{ id: string; data: () => unknown }> }> }).get(
      query(collection(db, 'chapters')),
    );
    const liveValidationError = validateInventoryChaptersForCreation(
      chapters,
      liveSnapshot.docs.map(document => {
        const data = document.data() as Partial<Chapter>;
        return { id: typeof data.id === 'string' && data.id.trim() ? data.id : document.id };
      }),
    );
    if (liveValidationError) throw new Error(liveValidationError);
    const refs = chapters.map(chapter => getChapterRef(db, chapter.id));
    const timestamp = new Date().toISOString();
    refs.forEach((ref, index) => {
      const chapter = chapters[index];
      const saved = { ...chapter, dataRevision: 1, updatedAt: timestamp, updatedBy: actor, submissions: [] };
      transaction.set(ref, saved);
    });
    if (chapters.length) {
      writeActivityEvent(transaction, {
        ref: getActivityEventRef(db), actorEmail: actor, action: 'chapter-imported',
        summary: `Created ${chapters.length} chapter${chapters.length === 1 ? '' : 's'} from scan inventory`,
        chapterIds: chapters.map(chapter => chapter.id),
        counts: { created: chapters.length, skipped: 0 },
      });
    }
    return { created: chapters.map(chapter => chapter.id), skipped: [] };
  });
}

export async function deleteChapterWithActivity(db: Firestore, chapter: Chapter, actor: string): Promise<WriteResult> {
  return deleteChaptersWithActivity(db, [chapter], actor);
}

/** Deletes a reviewed selection atomically and emits one summary Activity event. */
export async function deleteChaptersWithActivity(db: Firestore, chapters: Chapter[], actor: string): Promise<WriteResult> {
  if (!chapters.length) throw new Error('Select at least one chapter to delete.');
  return runTransaction(db, async transaction => {
    const refs = chapters.map(chapter => getChapterRef(db, chapter.id));
    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];
      if (!snapshot.exists()) return { kind: 'conflict', current: {} as Chapter };
      const current = snapshot.data() as Chapter;
      if ((current.dataRevision ?? 0) !== (chapters[index].dataRevision ?? 0)) return { kind: 'conflict', current };
    }
    refs.forEach(ref => transaction.delete(ref));
    const chapterIds = chapters.map(chapter => chapter.id);
    writeActivityEvent(transaction, {
      ref: getActivityEventRef(db), actorEmail: actor, action: 'chapter-deleted',
      summary: `Deleted ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`,
      ...(chapters.length === 1 ? { chapterId: chapterIds[0] } : { chapterIds }),
      counts: { chapters: chapters.length },
    });
    return { kind: 'ok', new: snapshots[0].data() as Chapter };
  });
}
