import {
  Firestore,
  DocumentReference,
  collection,
  doc as firebaseDoc,
  runTransaction as firebaseRunTransaction,
  Transaction,
  getDoc,
  query as firebaseQuery,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { ChapterStage, ChapterStageRecord, StageConflict } from '../types';

type ChapterReferenceResolver = (db: Firestore, chapterId: string) => DocumentReference;
type ActivityReferenceResolver = (db: Firestore) => DocumentReference;
type UserReferenceResolver = (db: Firestore, email: string) => DocumentReference;
type TeamRosterReferenceResolver = (db: Firestore) => DocumentReference;
type TeamProjectReferenceResolver = (db: Firestore) => DocumentReference;

let runTransactionImplementation = firebaseRunTransaction;
let chapterReferenceResolver: ChapterReferenceResolver = (db, chapterId) => firebaseDoc(db, 'chapters', chapterId);
let activityReferenceResolver: ActivityReferenceResolver = db => firebaseDoc(collection(db, 'auditEvents'));
let userReferenceResolver: UserReferenceResolver = (db, email) => firebaseDoc(db, 'users', email);
let teamRosterReferenceResolver: TeamRosterReferenceResolver = db => firebaseDoc(db, 'teamState', 'roster');
let teamProjectReferenceResolver: TeamProjectReferenceResolver = db => firebaseDoc(db, 'teamState', 'project');

export function getChapterRef(db: Firestore, chapterId: string): DocumentReference {
  return chapterReferenceResolver(db, chapterId);
}

export function getActivityEventRef(db: Firestore): DocumentReference {
  return activityReferenceResolver(db);
}

export function getUserRef(db: Firestore, email: string): DocumentReference {
  return userReferenceResolver(db, email);
}

export function getTeamRosterStateRef(db: Firestore): DocumentReference {
  return teamRosterReferenceResolver(db);
}

export function getTeamProjectStateRef(db: Firestore): DocumentReference {
  return teamProjectReferenceResolver(db);
}

/** Test seam for transaction-backed write unit tests; production uses Firebase defaults. */
export function setRunTransaction(implementation: typeof firebaseRunTransaction): void {
  runTransactionImplementation = implementation;
}

/** Test seam for reference-free write unit tests; production uses Firestore document references. */
export function setFirestoreReferenceResolversForTest(
  chapterResolver?: ChapterReferenceResolver,
  activityResolver?: ActivityReferenceResolver,
  userResolver?: UserReferenceResolver,
  teamRosterResolver?: TeamRosterReferenceResolver,
  teamProjectResolver?: TeamProjectReferenceResolver,
): void {
  chapterReferenceResolver = chapterResolver ?? ((db, chapterId) => firebaseDoc(db, 'chapters', chapterId));
  activityReferenceResolver = activityResolver ?? (db => firebaseDoc(collection(db, 'auditEvents')));
  userReferenceResolver = userResolver ?? ((db, email) => firebaseDoc(db, 'users', email));
  teamRosterReferenceResolver = teamRosterResolver ?? (db => firebaseDoc(db, 'teamState', 'roster'));
  teamProjectReferenceResolver = teamProjectResolver ?? (db => firebaseDoc(db, 'teamState', 'project'));
}

/**
 * Resolves the reference to the parent stage document for a given chapter.
 */
export function getStageRef(db: Firestore, chapterId: string, stage: ChapterStage) {
  return firebaseDoc(db, 'chapters', chapterId, 'stages', stage);
}

/**
 * Resolves the reference to the subcollection of records under a stage document.
 */
export function getStageRecordsRef(db: Firestore, chapterId: string, stage: ChapterStage) {
  const stageRef = getStageRef(db, chapterId, stage);
  return collection(db, stageRef.path, 'records');
}

/**
 * Resolves a single record document reference.
 */
export function getRecordRef(
  db: Firestore,
  chapterId: string,
  stage: ChapterStage,
  recordId: string,
) {
  const recordsRef = getStageRecordsRef(db, chapterId, stage);
  return firebaseDoc(db, recordsRef.path, recordId);
}

/**
 * Runs a query to find conflicting records for the given stage and rank.
 * Returns the conflict found, if any, along with the conflicting record's ID.
 */
export async function findConflictInStageRecords(
  db: Firestore,
  chapterId: string,
  stage: ChapterStage,
  rank: number,
  excludeRecordId?: string,
): Promise<{ conflict: StageConflict | null; conflictId: string | null }> {
  const recordsRef = getStageRecordsRef(db, chapterId, stage);

  let q;
  if (excludeRecordId) {
    // We'll filter out the excluded record manually since we need all at this rank
    q = firebaseQuery(recordsRef, where('rank', '==', rank));
  } else {
    q = firebaseQuery(recordsRef, where('rank', '==', rank));
  }

  const snapshot = await getDocs(q);

  for (const docSnap of snapshot.docs) {
    if (excludeRecordId && docSnap.id === excludeRecordId) continue;
    if (!docSnap.exists()) continue;
    const data = docSnap.data() as ChapterStageRecord;
    if (data.state === 'voided') continue;
    return {
      conflict: {
        recordId: docSnap.id,
        chapterId,
        stage,
        rank,
        details: `Record "${docSnap.id}" already occupies rank ${rank} in stage "${stage}" for chapter "${chapterId}"`,
      },
      conflictId: docSnap.id,
    };
  }

  return { conflict: null, conflictId: null };
}

/**
 * Generic helper to run a Firestore transaction.
 */
export async function runTransaction<T>(
  db: Firestore,
  updateFn: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return await runTransactionImplementation(db, updateFn);
}
