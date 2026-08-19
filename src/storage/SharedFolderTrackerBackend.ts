import { ActivityViewEvent } from '../domain/activityView';
import { applyStageHistoryProjections, chapterStageRank, clearLegacyStageProjection, deriveCurrentStage, projectLegacyStageFields } from '../domain/chapterStageHistory';
import { isSafeChapterMetadata, isSafeStageRecord } from '../domain/chapterValidation';
import { ProjectImportPlan, ProjectImportResult, validateInventoryChaptersForCreation } from '../domain/projectImportPlan';
import { normalizeProjectState, validateProjectState } from '../domain/projectState';
import { Chapter, ChapterStageRecord, ProjectState } from '../types';
import { ReviewedResetInput } from '../utils/projectWrites';
import { WriteResult } from '../utils/chapterWrites';
import { TrackerBackend, TrackerSnapshot, Unsubscribe } from './TrackerBackend';
import {
  PortableProjectFile,
  hashPortableProjectContents,
  parsePortableProjectFile,
  serializePortableProjectFile,
  validatePortableProjectFile,
} from './projectFileFormat';

export interface SharedProjectFileApi {
  verifySharedOwnership(fileToken: string, instanceId: string): Promise<{ ok: boolean; message?: string; lock?: SharedProjectLock | null }>;
  saveSharedProjectFile(fileToken: string, instanceId: string, expectedHash: string, expectedProjectRevision: number, contents: string): Promise<{ ok: boolean; hash?: string; message: string }>;
  saveSharedProjectFileAs(contents: string): Promise<{ cancelled: boolean; fileToken?: string; hash?: string }>;
}

export interface SharedProjectLock {
  editorLabel: string;
  acquiredAt: string;
  heartbeatAt: string;
}

export interface SharedFolderTrackerBackendOptions {
  fileToken: string;
  contents: string;
  initialHash?: string;
  editorLabel: string;
  instanceId: string;
  fileApi: SharedProjectFileApi;
  canEdit: boolean;
  onOwnershipLost?: (message: string) => void;
}

const RESTART_CONFLICT_MESSAGE = 'Nothing was deleted. A chapter changed after review; reload and start again.';
const STALE_SAVE_MESSAGE = 'Nothing was saved. The shared project file changed on disk or in revision.';
const READ_ONLY_MESSAGE = 'This shared project is read-only while another editor is active.';
const OWNERSHIP_LOST_MESSAGE = 'Shared editing access was lost. No further shared saves are permitted until this file is reopened and a lock is acquired.';

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function changedFields(incoming: Chapter, current: Chapter): string[] {
  return Object.keys(incoming).filter(key =>
    !['id', 'dataRevision', 'updatedAt', 'updatedBy', 'submissions'].includes(key)
    && (incoming as unknown as Record<string, unknown>)[key] !== (current as unknown as Record<string, unknown>)[key],
  );
}

export class SharedFolderTrackerBackend implements TrackerBackend {
  readonly kind = 'shared-folder' as const;
  readonly supportsConcurrentEditing = false;
  private file: PortableProjectFile;
  private currentHash?: string;
  private readonly listeners = new Set<(snapshot: TrackerSnapshot) => void>();
  private readonly fileToken: string;
  private readonly editorLabel: string;
  private readonly instanceId: string;
  private readonly fileApi: SharedProjectFileApi;
  private readonly onOwnershipLost?: (message: string) => void;
  private canEdit: boolean;
  private expectedRevision: number;
  private readOnlyMessage = READ_ONLY_MESSAGE;

  constructor(options: SharedFolderTrackerBackendOptions) {
    if (!options.editorLabel.trim()) throw new Error('A shared editor label is required.');
    if (!options.instanceId.trim()) throw new Error('A shared editor instance id is required.');
    this.fileToken = options.fileToken;
    this.editorLabel = options.editorLabel.trim();
    this.instanceId = options.instanceId.trim();
    this.fileApi = options.fileApi;
    this.canEdit = options.canEdit;
    this.onOwnershipLost = options.onOwnershipLost;
    this.currentHash = options.initialHash;
    this.file = parsePortableProjectFile(options.contents);
    this.expectedRevision = this.file.projectRevision;
  }

  setCanEdit(value: boolean, message = READ_ONLY_MESSAGE): void {
    this.canEdit = value;
    this.readOnlyMessage = value ? READ_ONLY_MESSAGE : message;
  }

  subscribe(listener: (snapshot: TrackerSnapshot) => void, _onError: (message: string) => void): Unsubscribe {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  async saveChapter(chapter: Chapter, expectedRevision: number, actor: string): Promise<WriteResult> {
    return this.withMutation(async nextFile => {
      if (!isSafeChapterMetadata(chapter) || (chapter.submissions ?? []).some(record => !isSafeStageRecord(record))) throw new Error('Chapter metadata or stage history is invalid.');
      const currentIndex = nextFile.chapters.findIndex(current => current.id === chapter.id);
      const current = currentIndex >= 0 ? nextFile.chapters[currentIndex] : undefined;
      const currentRevision = current?.dataRevision ?? 0;
      if (currentRevision !== expectedRevision) return { kind: 'conflict', current: current ?? {} as Chapter };
      const fields = current ? changedFields(chapter, current) : Object.keys(chapter).filter(key => !['dataRevision', 'updatedAt', 'updatedBy'].includes(key));
      if (current && fields.length === 0) return { kind: 'unchanged', current };
      const timestamp = nowIso();
      const saved: Chapter = {
        ...chapter,
        submissions: current?.submissions ?? chapter.submissions ?? [],
        dataRevision: currentRevision + 1,
        updatedAt: timestamp,
        updatedBy: actor,
      };
      if (currentIndex >= 0) nextFile.chapters[currentIndex] = saved;
      else nextFile.chapters.push(saved);
      await this.recordMutation(nextFile, actor, current ? 'chapter-updated' : 'chapter-created', current ? `Updated ${chapter.id}` : `Created ${chapter.id}`, { chapterId: chapter.id, changedFields: fields, revisionBefore: currentRevision, revisionAfter: saved.dataRevision });
      return { kind: 'ok', new: saved };
    });
  }

  async batchUpdateChapterFields(chapterIds: string[], field: keyof Chapter, value: string, actor: string): Promise<void> {
    return this.withMutation(async nextFile => {
      if (!chapterIds.length) return;
      const timestamp = nowIso();
      const ids = new Set(chapterIds);
      let changed = 0;
      nextFile.chapters = nextFile.chapters.map(chapter => {
        if (!ids.has(chapter.id)) return chapter;
        changed += 1;
        return { ...chapter, [field]: value, dataRevision: (chapter.dataRevision ?? 0) + 1, updatedAt: timestamp, updatedBy: actor };
      });
      if (changed !== chapterIds.length) throw new Error('A selected chapter no longer exists.');
      await this.recordMutation(nextFile, actor, 'batch-status-updated', `Updated ${chapterIds.length} chapter${chapterIds.length === 1 ? '' : 's'}`, { chapterIds, changedFields: [String(field)], counts: { chapters: chapterIds.length } });
    });
  }

  async applyProjectImport(plan: ProjectImportPlan, actor: string): Promise<ProjectImportResult> {
    return this.withMutation(async nextFile => {
      const selected = plan.entries.filter(entry => entry.selected);
      if (!selected.length) throw new Error('Select at least one inspected stage record to add.');
      const changedChapters: Chapter[] = [];
      for (const entry of selected) {
        if (!entry.chapterId || !entry.record || !entry.inspected) throw new Error('Every selected file must be inspected and matched before it can be added.');
        const index = nextFile.chapters.findIndex(chapter => chapter.id === entry.chapterId);
        if (index < 0) throw new Error(`Nothing was changed. ${entry.chapterId} no longer exists.`);
        const current = nextFile.chapters[index];
        if ((current.dataRevision ?? 0) !== plan.expectedRevisions[entry.chapterId]) throw new Error(`Nothing was changed. ${entry.chapterId} changed after the preview.`);
        if (!isSafeStageRecord(entry.record)) throw new Error('A selected stage record still needs a valid stage, round, or word count.');
        const updated = {
          ...applyStageHistoryProjections(current, [...(current.submissions ?? []), entry.record]),
          dataRevision: (current.dataRevision ?? 0) + 1,
          updatedAt: nowIso(),
          updatedBy: actor,
        };
        nextFile.chapters[index] = updated;
        changedChapters.push(updated);
      }
      await this.recordMutation(nextFile, actor, 'project-history-imported', `Added ${selected.length} stage record${selected.length === 1 ? '' : 's'} to ${changedChapters.length} chapter${changedChapters.length === 1 ? '' : 's'}`, { chapterIds: changedChapters.map(chapter => chapter.id), changedFields: ['submissions'] });
      return {
        chaptersChanged: changedChapters.length,
        stageRecordsAdded: selected.length,
        alreadyRecorded: plan.entries.filter(entry => entry.disposition === 'Already recorded').length,
        excluded: plan.entries.filter(entry => !entry.selected && entry.disposition !== 'Already recorded' && entry.disposition !== 'Unsupported').length,
        unsupported: plan.entries.filter(entry => entry.disposition === 'Unsupported').length,
        failed: 0,
        changedChapters,
      };
    });
  }

  async createInitialProject(name: string, actor: string): Promise<ProjectState> {
    if (this.file.projectRevision > 0) throw new Error('A project is already named.');
    const timestamp = nowIso();
    const project = validateProjectState(normalizeProjectState(name, nextId('generation'), actor, timestamp));
    return this.withMutation(async nextFile => {
      nextFile.project = project;
      await this.recordMutation(nextFile, actor, 'project-started', `Project started: ${project.name}`);
      return project;
    });
  }

  async createChaptersFromInventory(chapters: Chapter[], actor: string): Promise<{ created: string[]; skipped: string[] }> {
    return this.withMutation(async nextFile => {
      const validationError = validateInventoryChaptersForCreation(chapters, nextFile.chapters);
      if (validationError) throw new Error(validationError);
      const created: string[] = [];
      const timestamp = nowIso();
      for (const chapter of chapters) {
        const nextChapter = { ...chapter, submissions: [], dataRevision: 1, updatedAt: timestamp, updatedBy: actor };
        nextFile.chapters.push(nextChapter);
        created.push(chapter.id);
      }
      await this.recordMutation(nextFile, actor, 'chapter-imported', `Created ${created.length} chapter${created.length === 1 ? '' : 's'} from scan inventory`, { chapterIds: created, counts: { created: created.length, skipped: 0 } });
      return { created, skipped: [] };
    });
  }

  async appendStageRecord(chapterId: string, record: ChapterStageRecord, expectedRevision: number, actor: string): Promise<WriteResult> {
    return this.withMutation(async nextFile => {
      if (!isSafeStageRecord(record)) throw new Error('Stage record metadata is invalid.');
      const index = nextFile.chapters.findIndex(chapter => chapter.id === chapterId);
      const current = index >= 0 ? nextFile.chapters[index] : undefined;
      if (!current || (current.dataRevision ?? 0) !== expectedRevision) return { kind: 'conflict', current: current ?? {} as Chapter };
      const records = current.submissions ?? [];
      if (record.sourceSha256 && records.some(existing => existing.state === 'active' && existing.sourceSha256 === record.sourceSha256)) return { kind: 'duplicate', current };
      const conflictingRecords = records.filter(existing => existing.state === 'active' && chapterStageRank(existing) === chapterStageRank(record));
      if (conflictingRecords.length) return { kind: 'stage-conflict', current, conflictingRecords };
      const timestamp = nowIso();
      const updated = { ...applyStageHistoryProjections(current, [...records, record]), dataRevision: (current.dataRevision ?? 0) + 1, updatedAt: timestamp, updatedBy: actor };
      nextFile.chapters[index] = updated;
      await this.recordMutation(nextFile, actor, 'stage-record-added', `Added ${record.stage} to ${chapterId}`, { chapterId, changedFields: ['submissions'], revisionBefore: current.dataRevision ?? 0, revisionAfter: updated.dataRevision });
      return { kind: 'ok', new: updated };
    });
  }

  async voidStageRecord(chapterId: string, recordId: string, reason: string, expectedRevision: number, actor: string): Promise<WriteResult> {
    return this.withMutation(async nextFile => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) throw new Error('A reason is required.');
      const index = nextFile.chapters.findIndex(chapter => chapter.id === chapterId);
      const current = index >= 0 ? nextFile.chapters[index] : undefined;
      if (!current || (current.dataRevision ?? 0) !== expectedRevision) return { kind: 'conflict', current: current ?? {} as Chapter };
      const records = current.submissions ?? [];
      const target = records.find(record => record.id === recordId && record.state === 'active');
      if (!target) return { kind: 'conflict', current };
      const timestamp = nowIso();
      const updatedRecords = records.map(record => record.id === recordId ? { ...record, state: 'voided' as const, voidedAt: timestamp, voidedBy: actor, voidReason: trimmedReason } : record);
      const replacement = [...updatedRecords].filter(record => record.state === 'active' && record.stage === target.stage).sort((left, right) => right.effectiveOn.localeCompare(left.effectiveOn))[0];
      let rebuilt = clearLegacyStageProjection(current, target.stage);
      if (replacement) {
        rebuilt = { ...rebuilt, ...projectLegacyStageFields(replacement) };
      }
      const newCurrentStage = deriveCurrentStage(updatedRecords);
      if (newCurrentStage) rebuilt = { ...rebuilt, ...projectLegacyStageFields(newCurrentStage) };
      const updated = {
        ...rebuilt,
        submissions: updatedRecords,
        dataRevision: (current.dataRevision ?? 0) + 1,
        updatedAt: timestamp,
        updatedBy: actor,
      };
      nextFile.chapters[index] = updated;
      await this.recordMutation(nextFile, actor, 'stage-record-voided', `Marked a ${target.stage} record as entered by mistake for ${chapterId}`, { chapterId, changedFields: ['submissions'], revisionBefore: current.dataRevision ?? 0, revisionAfter: updated.dataRevision });
      return { kind: 'ok', new: updated };
    });
  }

  async createChapters(chapters: Chapter[], actor: string, source: string): Promise<{ created: string[]; skipped: string[] }> {
    return this.withMutation(async nextFile => {
      const created: string[] = [];
      const skipped: string[] = [];
      const existing = new Set(nextFile.chapters.map(chapter => chapter.id));
      const timestamp = nowIso();
      for (const chapter of chapters) {
        if (!isSafeChapterMetadata(chapter) || (chapter.submissions ?? []).some(record => !isSafeStageRecord(record))) throw new Error('Chapter metadata or stage history is invalid.');
        if (existing.has(chapter.id)) {
          skipped.push(chapter.id);
        } else {
          nextFile.chapters.push({ ...chapter, submissions: chapter.submissions ?? [], dataRevision: 1, updatedAt: timestamp, updatedBy: actor });
          existing.add(chapter.id);
          created.push(chapter.id);
        }
      }
      if (created.length) await this.recordMutation(nextFile, actor, 'chapter-imported', `Imported ${created.length} chapter${created.length === 1 ? '' : 's'} from ${source}`, { chapterIds: created, counts: { created: created.length, skipped: skipped.length } });
      return { created, skipped };
    });
  }

  async deleteChapters(chapters: Chapter[], actor: string): Promise<WriteResult> {
    return this.withMutation(async nextFile => {
      if (!chapters.length) throw new Error('Select at least one chapter to delete.');
      for (const reviewed of chapters) {
        const current = nextFile.chapters.find(chapter => chapter.id === reviewed.id);
        if (!current || (current.dataRevision ?? 0) !== (reviewed.dataRevision ?? 0)) return { kind: 'conflict', current: current ?? {} as Chapter };
      }
      nextFile.chapters = nextFile.chapters.filter(chapter => !chapters.some(reviewed => reviewed.id === chapter.id));
      const chapterIds = chapters.map(chapter => chapter.id);
      await this.recordMutation(nextFile, actor, 'chapter-deleted', `Deleted ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`, { chapterIds, counts: { chapters: chapters.length } });
      return { kind: 'ok', new: chapters[0] };
    });
  }

  async startNewProject(input: ReviewedResetInput, actor: string): Promise<ProjectState> {
    const previousProject = validateProjectState(input.previousProject);
    const liveProject = validateProjectState(this.file.project);
    if (liveProject.generationId !== previousProject.generationId || liveProject.startedAt !== previousProject.startedAt || liveProject.startedBy !== previousProject.startedBy || liveProject.name !== previousProject.name) {
      throw new Error(RESTART_CONFLICT_MESSAGE);
    }
    return this.withMutation(async nextFile => {
      for (const reviewed of input.reviewedChapters) {
        const current = nextFile.chapters.find(chapter => chapter.id === reviewed.id);
        if (!current || (current.dataRevision ?? 0) !== reviewed.dataRevision) throw new Error(RESTART_CONFLICT_MESSAGE);
      }
      const timestamp = nowIso();
      const project = validateProjectState(normalizeProjectState(input.nextProjectName, nextId('generation'), actor, timestamp));
      nextFile.chapters = nextFile.chapters.filter(chapter => !input.reviewedChapters.some(reviewed => reviewed.id === chapter.id));
      nextFile.project = project;
      await this.recordMutation(nextFile, actor, 'project-started', `Started project: ${project.name}`);
      return project;
    });
  }

  async close(): Promise<void> {
    this.listeners.clear();
  }

  private assertWritable() {
    if (!this.canEdit) throw new Error(this.readOnlyMessage);
  }

  private async withMutation<T>(mutate: (nextFile: PortableProjectFile) => Promise<T> | T): Promise<T> {
    this.assertWritable();
    await this.verifyOwnershipBeforeMutation();
    if (this.file.projectRevision !== this.expectedRevision) {
      throw new Error(STALE_SAVE_MESSAGE);
    }
    const priorFile = this.copyOf(this.file);
    const priorHash = this.currentHash;
    const nextFile = this.copyOf(this.file);
    try {
      const result = await mutate(nextFile);
      if (this.isNoopResult(result)) {
        return result;
      }
      const contents = serializePortableProjectFile(nextFile);
      const expectedHash = priorHash ?? await hashPortableProjectContents(await this.currentContents());
      const saveResult = await this.fileApi.saveSharedProjectFile(
        this.fileToken,
        this.instanceId,
        expectedHash,
        priorFile.projectRevision,
        contents,
      );
      if (!saveResult.ok && this.shouldMarkOwnershipLost(saveResult.message)) {
        this.markOwnershipLost(saveResult.message);
      }
      if (!saveResult.ok || !saveResult.hash) throw new Error(saveResult.message || 'The project file could not be saved.');
      this.file = nextFile;
      this.currentHash = saveResult.hash;
      this.expectedRevision = this.file.projectRevision;
      this.emit();
      return result;
    } catch (error) {
      this.file = priorFile;
      this.currentHash = priorHash;
      this.expectedRevision = priorFile.projectRevision;
      throw error;
    }
  }

  private isNoopResult(value: unknown): value is { kind: Exclude<WriteResult['kind'], 'ok'>; current?: Chapter } {
    return Boolean(
      value
      && typeof value === 'object'
      && 'kind' in value
      && typeof (value as { kind: string }).kind === 'string'
      && (value as { kind: string }).kind !== 'ok',
    );
  }

  private async verifyOwnershipBeforeMutation(): Promise<void> {
    const result = await this.fileApi.verifySharedOwnership(this.fileToken, this.instanceId);
    if (!result.ok) {
      const message = result.message || OWNERSHIP_LOST_MESSAGE;
      this.markOwnershipLost(message);
      throw new Error(message);
    }
  }

  private shouldMarkOwnershipLost(message: string | undefined): boolean {
    return /owns the shared lock/i.test(message || '')
      || /no shared lock exists/i.test(message || '')
      || /editing access was lost/i.test(message || '');
  }

  private markOwnershipLost(message: string | undefined): void {
    const safeMessage = message || OWNERSHIP_LOST_MESSAGE;
    this.setCanEdit(false, safeMessage);
    this.onOwnershipLost?.(safeMessage);
  }

  private copyOf(file: PortableProjectFile): PortableProjectFile {
    return {
      ...file,
      project: { ...file.project },
      chapters: file.chapters.map(chapter => ({
        ...chapter,
        submissions: chapter.submissions ? [...chapter.submissions] : undefined,
      })),
      activity: file.activity.map(event => ({ ...event })),
    };
  }

  private snapshot(): TrackerSnapshot {
    return {
      project: this.file.project,
      chapters: this.file.chapters.map(chapter => ({ ...chapter, submissions: chapter.submissions ? [...chapter.submissions] : undefined })),
      activity: this.file.activity.map(event => ({ ...event })),
      revision: this.file.projectRevision,
    };
  }

  private async recordMutation(nextFile: PortableProjectFile, actor: string, action: string, summary: string, details: Partial<ActivityViewEvent> & { changedFields?: string[]; counts?: Record<string, number>; revisionBefore?: number; revisionAfter?: number } = {}): Promise<void> {
    const timestamp = nowIso();
    nextFile.projectRevision += 1;
    nextFile.savedAt = timestamp;
    nextFile.savedBy = this.editorLabel;
    nextFile.project = { ...nextFile.project, updatedAt: timestamp };
    nextFile.activity.unshift({
      id: nextId('shared-activity'),
      actorEmail: actor || this.editorLabel,
      action,
      summary,
      clientAt: timestamp,
      chapterId: details.chapterId,
      chapterIds: details.chapterIds,
    });
    validatePortableProjectFile(nextFile);
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private async currentContents(): Promise<string> {
    return serializePortableProjectFile(this.file);
  }
}
