import { Firestore, collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ActivityViewEvent } from '../domain/activityView';
import { ProjectImportPlan, ProjectImportResult } from '../domain/projectImportPlan';
import { Chapter, ChapterStageRecord, ProjectState } from '../types';
import { WriteResult, appendStageRecordWithRevision, createChaptersIfAbsent, createInventoryChaptersIfAbsent, deleteChaptersWithActivity, saveChapterWithRevision, updateChapterFieldsBatch, voidStageRecordWithRevision } from '../utils/chapterWrites';
import { ReviewedResetInput, createInitialProject, startNewProjectWithRevisionCheck } from '../utils/projectWrites';
import { applyProjectImport } from '../domain/projectImportPlan';
import { TrackerBackend, Unsubscribe, TrackerSnapshot, BackendKind } from './TrackerBackend';

interface FirebaseBackendDependencies {
  saveChapterWithRevision: (db: Firestore, chapter: Chapter, expectedRevision: number, actor: string) => Promise<WriteResult>;
  updateChapterFieldsBatch: (db: Firestore, chapterIds: string[], field: keyof Chapter, value: string, actor: string) => Promise<void>;
  applyProjectImport: (db: Firestore, plan: ProjectImportPlan, actor: string) => Promise<ProjectImportResult>;
  createInitialProject: (db: Firestore, name: string, actor: string) => Promise<ProjectState>;
  createInventoryChaptersIfAbsent: (db: Firestore, chapters: Chapter[], actor: string) => Promise<{ created: string[]; skipped: string[] }>;
  appendStageRecordWithRevision: (db: Firestore, chapterId: string, record: ChapterStageRecord, expectedRevision: number, actor: string) => Promise<WriteResult>;
  voidStageRecordWithRevision: (db: Firestore, chapterId: string, recordId: string, reason: string, expectedRevision: number, actor: string) => Promise<WriteResult>;
  createChaptersIfAbsent: (db: Firestore, chapters: Chapter[], actor: string, source: string) => Promise<{ created: string[]; skipped: string[] }>;
  deleteChaptersWithActivity: (db: Firestore, chapters: Chapter[], actor: string) => Promise<WriteResult>;
  startNewProjectWithRevisionCheck: (db: Firestore, input: ReviewedResetInput, actor: string) => Promise<ProjectState>;
  subscribeProject: (db: Firestore, onProject: (project: ProjectState | null) => void, onError: (message: string) => void) => Unsubscribe;
  subscribeChapters: (db: Firestore, onChapters: (chapters: Chapter[]) => void, onError: (message: string) => void) => Unsubscribe;
  subscribeActivity: (db: Firestore, onActivity: (activity: ActivityViewEvent[]) => void, onError: (message: string) => void) => Unsubscribe;
}

const defaultDependencies: FirebaseBackendDependencies = {
  saveChapterWithRevision,
  updateChapterFieldsBatch,
  createInitialProject,
  createInventoryChaptersIfAbsent,
  applyProjectImport,
  appendStageRecordWithRevision,
  voidStageRecordWithRevision,
  createChaptersIfAbsent,
  deleteChaptersWithActivity,
  startNewProjectWithRevisionCheck,
  subscribeProject: (db, onProject, onError) => onSnapshot(
    doc(db, 'teamState', 'project'),
    (snapshot) => {
      onProject(snapshot.exists() ? snapshot.data() as ProjectState : null);
    },
    (error) => onError((error as Error).message ?? 'Could not load project updates.'),
  ),
  subscribeChapters: (db, onChapters, onError) => onSnapshot(
    query(collection(db, 'chapters')),
    (snapshot) => {
      onChapters(snapshot.docs.map(document => document.data() as Chapter));
    },
    (error) => onError((error as Error).message ?? 'Could not load chapter updates.'),
  ),
  subscribeActivity: (db, onActivity, onError) => onSnapshot(
    query(collection(db, 'auditEvents'), orderBy('clientAt', 'desc')),
    (snapshot) => {
      onActivity(snapshot.docs.map(document => ({
        id: document.id,
        ...document.data(),
      }) as ActivityViewEvent));
    },
    (error) => onError((error as Error).message ?? 'Could not load activity updates.'),
  ),
};

export interface FirebaseTrackerBackendOptions {
  db?: Firestore;
  dependencies?: Partial<FirebaseBackendDependencies>;
}

export class FirebaseTrackerBackend implements TrackerBackend {
  public readonly kind: BackendKind = 'firebase';
  public readonly supportsConcurrentEditing = true;
  private readonly db: Firestore | null;
  private readonly dependencies: FirebaseBackendDependencies;
  private activeUnsubscribers: Unsubscribe[] = [];

  constructor(options: FirebaseTrackerBackendOptions = {}) {
    this.db = options.db ?? null;
    this.dependencies = { ...defaultDependencies, ...options.dependencies };
  }

  subscribe(listener: (snapshot: TrackerSnapshot) => void, onError: (message: string) => void): Unsubscribe {
    let snapshot: TrackerSnapshot = { project: null, chapters: [], activity: [], revision: 0 };
    const emit = () => {
      snapshot = { ...snapshot, revision: snapshot.revision + 1 };
      listener({ ...snapshot });
    };
    this.activeUnsubscribers.forEach(unsubscribe => unsubscribe());
    this.activeUnsubscribers = [
      this.dependencies.subscribeProject(this.db, (project) => {
        snapshot = { ...snapshot, project };
        emit();
      }, onError),
      this.dependencies.subscribeChapters(this.db, (chapters) => {
        snapshot = { ...snapshot, chapters };
        emit();
      }, onError),
      this.dependencies.subscribeActivity(this.db, (activity) => {
        snapshot = { ...snapshot, activity };
        emit();
      }, onError),
    ];

    return () => {
      const unsubscribe = this.activeUnsubscribers;
      this.activeUnsubscribers = [];
      unsubscribe.forEach(stop => stop());
    };
  }

  async saveChapter(chapter: Chapter, expectedRevision: number, actor: string): Promise<WriteResult> {
    return this.dependencies.saveChapterWithRevision(this.db as Firestore, chapter, expectedRevision, actor);
  }

  async batchUpdateChapterFields(chapterIds: string[], field: keyof Chapter, value: string, actor: string): Promise<void> {
    return this.dependencies.updateChapterFieldsBatch(this.db as Firestore, chapterIds, field, value, actor);
  }

  async applyProjectImport(plan: ProjectImportPlan, actor: string): Promise<ProjectImportResult> {
    return this.dependencies.applyProjectImport(this.db as Firestore, plan, actor);
  }

  async createInitialProject(name: string, actor: string): Promise<ProjectState> {
    return this.dependencies.createInitialProject(this.db as Firestore, name, actor);
  }

  async createChaptersFromInventory(chapters: Chapter[], actor: string): Promise<{ created: string[]; skipped: string[] }> {
    return this.dependencies.createInventoryChaptersIfAbsent(this.db as Firestore, chapters, actor);
  }

  async appendStageRecord(chapterId: string, record: ChapterStageRecord, expectedRevision: number, actor: string): Promise<WriteResult> {
    return this.dependencies.appendStageRecordWithRevision(this.db as Firestore, chapterId, record, expectedRevision, actor);
  }

  async voidStageRecord(chapterId: string, recordId: string, reason: string, expectedRevision: number, actor: string): Promise<WriteResult> {
    return this.dependencies.voidStageRecordWithRevision(this.db as Firestore, chapterId, recordId, reason, expectedRevision, actor);
  }

  async createChapters(chapters: Chapter[], actor: string, source: string): Promise<{ created: string[]; skipped: string[] }> {
    return this.dependencies.createChaptersIfAbsent(this.db as Firestore, chapters, actor, source);
  }

  async deleteChapters(chapters: Chapter[], actor: string): Promise<WriteResult> {
    return this.dependencies.deleteChaptersWithActivity(this.db as Firestore, chapters, actor);
  }

  async startNewProject(input: ReviewedResetInput, actor: string): Promise<ProjectState> {
    return this.dependencies.startNewProjectWithRevisionCheck(this.db as Firestore, input, actor);
  }

  async close(): Promise<void> {
    const unsubscribers = this.activeUnsubscribers;
    this.activeUnsubscribers = [];
    unsubscribers.forEach(stop => stop());
  }
}
