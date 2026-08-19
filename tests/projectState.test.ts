import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProject } from '../src/utils/projectWrites';
import { isActivityAfterProjectStart, validateProjectState } from '../src/domain/projectState';
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
      const data = mockStore[ref.id];
      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    },
    set(ref: any, data: any) {
      mockStore[ref.id] = data;
    },
  };
  return fn(transaction);
});

function resetMockStore() {
  mockStore = {};
  eventSequence = 0;
}

test('validates a staged project name and timestamps', () => {
  const candidate = {
    name: ' Project Alpha ',
    generationId: 'abc-123',
    startedAt: '2026-08-11T10:00:00.000Z',
    startedBy: 'owner@example.com',
    updatedAt: '2026-08-11T10:00:01.000Z',
  };
  const project = validateProjectState(candidate);
  assert.equal(project.name, 'Project Alpha');
});

test('rejects blank or overlong project names', () => {
  assert.throws(() => validateProjectState({
    name: '   ',
    generationId: 'abc',
    startedAt: '2026-08-11T10:00:00.000Z',
    startedBy: 'owner@example.com',
    updatedAt: '2026-08-11T10:00:00.000Z',
  }), /Invalid project state/);
  assert.throws(() => validateProjectState({
    name: 'x'.repeat(121),
    generationId: 'abc',
    startedAt: '2026-08-11T10:00:00.000Z',
    startedBy: 'owner@example.com',
    updatedAt: '2026-08-11T10:00:00.000Z',
  }), /Invalid project state/);
});

test('rejects invalid project timestamp', () => {
  assert.throws(() => validateProjectState({
    name: 'Project',
    generationId: 'abc',
    startedAt: 'not-a-time',
    startedBy: 'owner@example.com',
    updatedAt: '2026-08-11T10:00:00.000Z',
  }), /Invalid project state/);
});

test('checks event cutoff against project start', () => {
  assert.equal(isActivityAfterProjectStart('2026-08-10T10:00:00.000Z', {
    name: 'Project',
    generationId: 'abc',
    startedAt: '2026-08-11T10:00:00.000Z',
    startedBy: 'owner@example.com',
    updatedAt: '2026-08-11T10:00:00.000Z',
  }), false);
  assert.equal(isActivityAfterProjectStart('2026-08-11T10:00:00.000Z', {
    name: 'Project',
    generationId: 'abc',
    startedAt: '2026-08-11T10:00:00.000Z',
    startedBy: 'owner@example.com',
    updatedAt: '2026-08-11T10:00:00.000Z',
  }), true);
});

test('createInitialProject writes project and matching initial activity event', async () => {
  resetMockStore();
  const project = await createInitialProject({} as any, 'Public beta', 'admin@example.com');
  assert.equal(mockStore['teamState-project'].name, 'Public beta');
  assert.equal(mockStore['teamState-project'].generationId.length, project.generationId.length);
  const events = Object.keys(mockStore).filter(key => key.startsWith('event-'));
  assert.equal(events.length, 1);
  const event = mockStore[events[0]];
  assert.equal(event.action, 'project-started');
  assert.equal(event.summary, `Project started: ${project.name}`);
  assert.equal(event.clientAt, project.startedAt);
  await assert.rejects(() => createInitialProject({} as any, 'Project two', 'admin@example.com'));
});
