import { Chapter, ChapterStageRecord, ProjectState } from '../types';
import { ActivityViewEvent } from '../domain/activityView';
import { ProjectImportPlan, ProjectImportResult } from '../domain/projectImportPlan';
import { WriteResult } from '../utils/chapterWrites';
import { ReviewedResetInput } from '../utils/projectWrites';

export type BackendKind = 'firebase' | 'local-file' | 'shared-folder';
export type Unsubscribe = () => void;

export interface TrackerSnapshot {
  project: ProjectState | null;
  chapters: Chapter[];
  activity: ActivityViewEvent[];
  revision: number;
}

export interface TrackerBackend {
  readonly kind: BackendKind;
  readonly supportsConcurrentEditing: boolean;
  subscribe(listener: (snapshot: TrackerSnapshot) => void, onError: (message: string) => void): Unsubscribe;
  saveChapter(chapter: Chapter, expectedRevision: number, actor: string): Promise<WriteResult>;
  batchUpdateChapterFields(chapterIds: string[], field: keyof Chapter, value: string, actor: string): Promise<void>;
  applyProjectImport(plan: ProjectImportPlan, actor: string): Promise<ProjectImportResult>;
  createInitialProject(name: string, actor: string): Promise<ProjectState>;
  createChaptersFromInventory(chapters: Chapter[], actor: string): Promise<{ created: string[]; skipped: string[] }>;
  appendStageRecord(chapterId: string, record: ChapterStageRecord, expectedRevision: number, actor: string): Promise<WriteResult>;
  voidStageRecord(chapterId: string, recordId: string, reason: string, expectedRevision: number, actor: string): Promise<WriteResult>;
  createChapters(chapters: Chapter[], actor: string, source: string): Promise<{ created: string[]; skipped: string[] }>;
  deleteChapters(chapters: Chapter[], actor: string): Promise<WriteResult>;
  startNewProject(input: ReviewedResetInput, actor: string): Promise<ProjectState>;
  close(): Promise<void>;
}
