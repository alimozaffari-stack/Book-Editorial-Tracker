import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalFileTrackerBackend } from '../src/storage/LocalFileTrackerBackend';
import { parsePortableProjectFile, serializePortableProjectFile } from '../src/storage/projectFileFormat';
import { isActivityAfterProjectStart, validateProjectState } from '../src/domain/projectState';

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
  const timestamp = '2026-01-01T00:00:00.000Z';
  let contents = serializePortableProjectFile({
    format: 'book-editorial-tracker-project', version: 1, projectRevision: 0,
    savedAt: timestamp, savedBy: 'Editor',
    project: { name: 'Draft', generationId: 'draft', startedAt: timestamp, updatedAt: timestamp, startedBy: 'Editor' },
    chapters: [], activity: [],
  });
  let writes = 0;
  const backend = new LocalFileTrackerBackend({
    fileToken: 'test-token', initialHash: 'initial-hash', editorLabel: 'Editor', contents,
    fileApi: { async saveProjectFile(token, expectedHash, nextContents) {
      assert.equal(token, 'test-token');
      assert.equal(expectedHash, 'initial-hash');
      contents = nextContents;
      writes += 1;
      return { ok: true, hash: 'saved-hash', message: 'Saved' };
    } },
  });
  const project = await backend.createInitialProject(' Release project ', 'Editor');
  const saved = parsePortableProjectFile(contents);
  assert.equal(saved.project.name, 'Release project');
  assert.equal(saved.project.generationId, project.generationId);
  assert.equal(saved.activity.length, 1);
  const event = saved.activity[0];
  assert.equal(event.action, 'project-started');
  assert.equal(event.summary, `Project started: ${project.name}`);
  assert.ok(isActivityAfterProjectStart(event.clientAt, project));
  await assert.rejects(() => backend.createInitialProject('Project two', 'Editor'), /already named/);
  assert.equal(writes, 1, 'Repeat initialization must not overwrite the project');
});
