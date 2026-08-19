import { DocumentReference, Transaction, serverTimestamp } from 'firebase/firestore';

export type ActivityAction = 'chapter-created' | 'chapter-updated' | 'chapter-deleted' | 'batch-status-updated' | 'chapter-imported' | 'project-history-imported' | 'stage-record-added' | 'stage-record-voided' | 'team-changed' | 'project-started';

export interface ActivityEventInput {
  ref: DocumentReference;
  actorEmail: string;
  action: ActivityAction;
  summary: string;
  chapterId?: string;
  chapterIds?: string[];
  changedFields?: string[];
  revisionBefore?: number;
  revisionAfter?: number;
  counts?: Record<string, number>;
}

export function writeActivityEvent(transaction: Transaction, event: ActivityEventInput): void {
  transaction.set(event.ref, {
    actorEmail: event.actorEmail,
    action: event.action,
    summary: event.summary,
    ...(event.chapterId ? { chapterId: event.chapterId } : {}),
    ...(event.chapterIds?.length ? { chapterIds: event.chapterIds } : {}),
    ...(event.changedFields?.length ? { changedFields: event.changedFields } : {}),
    ...(event.revisionBefore !== undefined ? { revisionBefore: event.revisionBefore } : {}),
    ...(event.revisionAfter !== undefined ? { revisionAfter: event.revisionAfter } : {}),
    ...(event.counts ? { counts: event.counts } : {}),
    clientAt: new Date().toISOString(),
    serverAt: serverTimestamp(),
  });
}
