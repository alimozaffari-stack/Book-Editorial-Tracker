import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProject, startNewProjectWithRevisionCheck } from '../src/utils/projectWrites';
import * as wrapper from '../src/utils/firestoreWrapper';

let mockStore: Record<string, any> = {};
let eventSequence = 0;

wrapper.setFirestoreReferenceResolversForTest(
  (_db, chapterId) => ({ id: chapterId } as any),
  () => ({ id: `event-${++eventSequence}` } as any),
  () => ({ id: 'ignore' } as any),
  () => ({ id: 'ignore' } as any),
  () => ({ id: 'teamState-project' } as any),
);

wrapper.setRunTransaction(async (db: any, fn: (tx: any) => Promise<any>) => {
  const transaction = {
    async get(ref: any) {
      const id = ref.id;
      const data = mockStore[id];
      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    },
    set(ref: any, data: any) {
      mockStore[ref.id] = data;
    },
    delete(ref: any) {
      delete mockStore[ref.id];
    },
  };
  return fn(transaction);
});

function resetMockStore() {
  mockStore = {
    'teamState-roster': { members: ['admin@example.com'], updatedAt: '2026-01-01T00:00:00.000Z' },
    'users-admin@example.com': { email: 'admin@example.com', role: 'admin' },
    'users-editor@example.com': { email: 'editor@example.com', role: 'editor' },
    'audit-existing': { action: 'chapter-created', summary: 'Existing entry', actorEmail: 'editor@example.com', clientAt: '2026-01-01T00:00:00.000Z' },
    'CH01': { id: 'CH01', dataRevision: 1 },
    'CH02': { id: 'CH02', dataRevision: 4 },
    'teamState-project': {
      name: 'First project',
      generationId: 'abc-01',
      startedAt: '2026-01-01T00:00:00.000Z',
      startedBy: 'admin@example.com',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };
  eventSequence = 0;
}

test('startNewProjectWithRevisionCheck deletes all reviewed chapters together and writes one project-started event', async () => {
  resetMockStore();
  const result = await startNewProjectWithRevisionCheck(
    {} as any,
    {
      previousProject: mockStore['teamState-project'],
      nextProjectName: 'Next project',
      reviewedChapters: [{ id: 'CH01', dataRevision: 1 }, { id: 'CH02', dataRevision: 4 }],
      backupExportedAt: '2026-01-01T10:00:00.000Z',
    },
    'admin@example.com',
  );

  assert.equal(mockStore['teamState-project'].name, result.name);
  assert.equal(result.name, 'Next project');
  assert.equal(mockStore['CH01'], undefined);
  assert.equal(mockStore['CH02'], undefined);
  const events = Object.keys(mockStore).filter(key => key.startsWith('event-'));
  assert.equal(events.length, 1);
  assert.equal(mockStore[events[0]].action, 'project-started');
  assert.equal(mockStore[events[0]].summary, 'Started project: Next project');
  assert.equal(mockStore['teamState-roster'].members.length, 1);
  assert.equal(mockStore['users-editor@example.com'].role, 'editor');
  assert.equal(mockStore['audit-existing'].action, 'chapter-created');
});

test('startNewProjectWithRevisionCheck prevents stale revisions with zero deletions', async () => {
  resetMockStore();
  await assert.rejects(() => startNewProjectWithRevisionCheck(
    {} as any,
    {
      previousProject: mockStore['teamState-project'],
      nextProjectName: 'Next project',
      reviewedChapters: [{ id: 'CH01', dataRevision: 1 }, { id: 'CH02', dataRevision: 5 }],
      backupExportedAt: '2026-01-01T10:00:00.000Z',
    },
    'admin@example.com',
  ), /Nothing was deleted\. A chapter changed after review; reload and start again\./);
  assert.equal(mockStore['CH01']?.dataRevision, 1);
  assert.equal(mockStore['CH02']?.dataRevision, 4);
  assert.equal(mockStore['teamState-project'].name, 'First project');
  assert.equal(Object.keys(mockStore).filter(key => key.startsWith('event-')).length, 0);
});

test('startNewProjectWithRevisionCheck fails when project metadata changed after review, then succeeds after refresh', async () => {
  resetMockStore();
  const staleReview = structuredClone(mockStore['teamState-project']);
  mockStore['teamState-project'].name = 'Renamed project';

  await assert.rejects(() => startNewProjectWithRevisionCheck(
    {} as any,
    {
      previousProject: staleReview,
      nextProjectName: 'Next project',
      reviewedChapters: [{ id: 'CH01', dataRevision: 1 }, { id: 'CH02', dataRevision: 4 }],
      backupExportedAt: '2026-01-01T10:00:00.000Z',
    },
    'admin@example.com',
  ), /Nothing was deleted\. A chapter changed after review; reload and start again\./);
  assert.equal(mockStore['CH01']?.dataRevision, 1);
  assert.equal(mockStore['CH02']?.dataRevision, 4);
  assert.equal(mockStore['teamState-project'].name, 'Renamed project');
  assert.equal(Object.keys(mockStore).filter(key => key.startsWith('event-')).length, 0);

  const result = await startNewProjectWithRevisionCheck(
    {} as any,
    {
      previousProject: mockStore['teamState-project'],
      nextProjectName: 'Next project',
      reviewedChapters: [{ id: 'CH01', dataRevision: 1 }, { id: 'CH02', dataRevision: 4 }],
      backupExportedAt: '2026-01-01T10:00:00.000Z',
    },
    'admin@example.com',
  );

  const events = Object.keys(mockStore).filter(key => key.startsWith('event-'));
  assert.equal(events.length, 1);
  assert.equal(mockStore['CH01'], undefined);
  assert.equal(mockStore['CH02'], undefined);
  assert.equal(mockStore['teamState-project'].name, result.name);
  assert.equal(result.name, 'Next project');
  assert.equal(mockStore[events[0]].summary, 'Started project: Next project');
});

test('startNewProjectWithRevisionCheck rejects missing backup confirmation', async () => {
  resetMockStore();
  await assert.rejects(() => startNewProjectWithRevisionCheck(
    {} as any,
    {
      previousProject: mockStore['teamState-project'],
      nextProjectName: 'Next project',
      reviewedChapters: [{ id: 'CH01', dataRevision: 1 }],
      backupExportedAt: '   ',
    },
    'admin@example.com',
  ), /successful JSON backup/);
});

test('startNewProjectWithRevisionCheck rejects empty project names', async () => {
  resetMockStore();
  await assert.rejects(() => startNewProjectWithRevisionCheck(
    {} as any,
    {
      previousProject: mockStore['teamState-project'],
      nextProjectName: '   ',
      reviewedChapters: [{ id: 'CH01', dataRevision: 1 }],
      backupExportedAt: '2026-01-01T10:00:00.000Z',
    },
    'admin@example.com',
  ), /project name/);
});

test('startNewProjectWithRevisionCheck fails when project is missing', async () => {
  resetMockStore();
  delete mockStore['teamState-project'];
  await assert.rejects(() => startNewProjectWithRevisionCheck(
    {} as any,
    {
      previousProject: {
        name: 'First project',
        generationId: 'abc-01',
        startedAt: '2026-01-01T00:00:00.000Z',
        startedBy: 'admin@example.com',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      nextProjectName: 'Next project',
      reviewedChapters: [{ id: 'CH01', dataRevision: 1 }],
      backupExportedAt: '2026-01-01T10:00:00.000Z',
    },
    'admin@example.com',
  ), /No current project was found/);
});

test('createInitialProject writes one project started event and blocks duplicates', async () => {
  resetMockStore();
  delete mockStore['teamState-project'];
  const project = await createInitialProject({} as any, 'Public beta', 'admin@example.com');
  const keys = Object.keys(mockStore).filter(key => key.startsWith('event-'));
  assert.equal(keys.length, 1);
  assert.equal(mockStore['teamState-project'].name, project.name);
  assert.equal(mockStore[keys[0]].summary, `Project started: ${project.name}`);
  await assert.rejects(() => createInitialProject({} as any, 'Another', 'admin@example.com'), /A project is already named/);
});
