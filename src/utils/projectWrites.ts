import { Firestore } from 'firebase/firestore';
import { normalizeProjectState, validateProjectState } from '../domain/projectState';
import { ProjectState } from '../types';
import { getActivityEventRef, getChapterRef, getTeamProjectStateRef, runTransaction } from './firestoreWrapper';

export interface ReviewedResetInput {
  previousProject: ProjectState;
  nextProjectName: string;
  reviewedChapters: Array<{ id: string; dataRevision: number }>;
  backupExportedAt: string;
}

const RESTART_CONFLICT_MESSAGE = 'Nothing was deleted. A chapter changed after review; reload and start again.';

export async function createInitialProject(
  db: Firestore,
  name: string,
  actor: string,
): Promise<ProjectState> {
  const now = new Date().toISOString();
  const generationId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const prepared = normalizeProjectState(name, generationId, actor, now);
  const project = validateProjectState(prepared);
  if (!project.name || !project.startedBy) throw new Error('A project name and actor email are required.');

  return runTransaction(db, async (transaction) => {
    const projectRef = getTeamProjectStateRef(db);
    const snapshot = await transaction.get(projectRef);
    if (snapshot.exists()) throw new Error('A project is already named.');

    const eventRef = getActivityEventRef(db);
    const payload = {
      actorEmail: actor,
      action: 'project-started' as const,
      summary: `Project started: ${project.name}`,
      clientAt: now,
    };
    transaction.set(projectRef, project);
    transaction.set(eventRef, payload);
      return project;
  });
}

export async function startNewProjectWithRevisionCheck(
  db: Firestore,
  input: ReviewedResetInput,
  actor: string,
): Promise<ProjectState> {
  const name = input.nextProjectName?.trim();
  const backupExportedAt = input.backupExportedAt?.trim();
  if (!name) throw new Error('A project name is required.');
  if (!backupExportedAt) throw new Error('A successful JSON backup is required before starting a new project.');
  if (!Array.isArray(input.reviewedChapters)) throw new Error('Reviewed chapter information is required.');
  validateProjectState(input.previousProject);

  const now = new Date().toISOString();
  const generationId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const prepared = validateProjectState(normalizeProjectState(name, generationId, actor, now));

  return runTransaction(db, async (transaction) => {
    const projectRef = getTeamProjectStateRef(db);
    const projectSnapshot = await transaction.get(projectRef);
    if (!projectSnapshot.exists()) {
      throw new Error('No current project was found. Load a project before starting a new one.');
    }
    const liveProject = validateProjectState(projectSnapshot.data());
    const previousProject = validateProjectState(input.previousProject);
    if (
      liveProject.generationId !== previousProject.generationId ||
      liveProject.startedAt !== previousProject.startedAt ||
      liveProject.startedBy !== previousProject.startedBy ||
      liveProject.name !== previousProject.name
    ) {
      throw new Error(RESTART_CONFLICT_MESSAGE);
    }

    const chapterRefs = input.reviewedChapters.map(review => getChapterRef(db, review.id));
    const chapterSnapshots = await Promise.all(chapterRefs.map(ref => transaction.get(ref)));

    for (let index = 0; index < chapterSnapshots.length; index += 1) {
      const snapshot = chapterSnapshots[index];
      const reviewed = input.reviewedChapters[index];
      if (!snapshot.exists() || (snapshot.data() as { dataRevision?: unknown }).dataRevision !== reviewed.dataRevision) {
        throw new Error(RESTART_CONFLICT_MESSAGE);
      }
    }

    chapterRefs.forEach(ref => transaction.delete(ref));
    const eventRef = getActivityEventRef(db);
    transaction.set(projectRef, prepared);
    transaction.set(eventRef, {
      actorEmail: actor,
      action: 'project-started',
      summary: `Started project: ${prepared.name}`,
      clientAt: now,
    });
    return prepared;
  });
}
