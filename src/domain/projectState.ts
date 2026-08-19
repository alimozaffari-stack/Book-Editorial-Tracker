import { ProjectState } from '../types';

function isSafeText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isSafeGenerationId(value: string): boolean {
  return value.length <= 100 && /^[A-Za-z0-9._-]+$/.test(value);
}

export function normalizeProjectName(name: string): string {
  return name.trim();
}

export function normalizeProjectState(rawName: string, generationId: string, actor: string, timestamp: string): ProjectState {
  return {
    name: normalizeProjectName(rawName),
    generationId,
    startedBy: actor.trim(),
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateProjectState(candidate: unknown): ProjectState {
  if (!candidate || typeof candidate !== 'object') throw new Error('Invalid project state.');
  const project = candidate as Record<string, unknown>;
  const name = isSafeText(project.name) ? normalizeProjectName(project.name) : '';
  const generationId = isSafeText(project.generationId) ? project.generationId.trim() : '';
  const startedBy = isSafeText(project.startedBy) ? (project.startedBy as string).trim() : '';
  if (!name || name.length > 120) throw new Error('Invalid project state.');
  if (!generationId || generationId.length < 1 || generationId.length > 100 || !isSafeGenerationId(generationId)) throw new Error('Invalid project state.');
  if (!startedBy || startedBy.length > 120) throw new Error('Invalid project state.');
  if (!isSafeText(project.startedAt) || !isIsoTimestamp(project.startedAt)) throw new Error('Invalid project state.');
  if (!isSafeText(project.updatedAt) || !isIsoTimestamp(project.updatedAt)) throw new Error('Invalid project state.');
  return {
    name,
    generationId,
    startedAt: project.startedAt,
    startedBy,
    updatedAt: project.updatedAt,
  };
}

export function isActivityAfterProjectStart(clientAt: string, project: ProjectState): boolean {
  if (!clientAt) return false;
  return !project.startedAt || clientAt >= project.startedAt;
}
