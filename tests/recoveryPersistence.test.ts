import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LocalFileTrackerBackend } from '../src/storage/LocalFileTrackerBackend';
import { SharedFolderTrackerBackend } from '../src/storage/SharedFolderTrackerBackend';
import { serializePortableProjectFile, parsePortableProjectFile, PortableProjectFile } from '../src/storage/projectFileFormat';
import { TrackerBackend, TrackerSnapshot } from '../src/storage/TrackerBackend';
import { Chapter } from '../src/types';

function fixture(shared: boolean, beforeSave: () => Promise<void> = async () => {}) {
  const initial: PortableProjectFile = {
    format: 'book-editorial-tracker-project', version: 1, projectRevision: 0,
    savedAt: '2026-01-01T00:00:00.000Z', savedBy: 'test',
    project: { name: 'Original', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'test', updatedAt: '2026-01-01T00:00:00.000Z' },
    chapters: [], activity: [],
  };
  let disk = serializePortableProjectFile(initial);
  let hash = 'initial';
  let reject = false;
  let writes = 0;
  const save = async (_token: string, expected: string, contents: string) => {
    await beforeSave();
    await new Promise(resolve => setTimeout(resolve, 5));
    if (reject || expected !== hash) return { ok: false, message: 'Project file changed on disk.' };
    disk = contents; hash = `saved-${++writes}`;
    return { ok: true, hash, message: 'Saved' };
  };
  const backend: TrackerBackend = shared
    ? new SharedFolderTrackerBackend({ fileToken: 'synthetic', contents: disk, initialHash: hash, editorLabel: 'test', instanceId: 'instance', canEdit: true,
      fileApi: { verifySharedOwnership: async () => ({ ok: true }), saveSharedProjectFile: (token, _instance, expected, _revision, contents) => save(token, expected, contents), saveSharedProjectFileAs: async () => ({ cancelled: true }) } })
    : new LocalFileTrackerBackend({ fileToken: 'synthetic', contents: disk, initialHash: hash, editorLabel: 'test', fileApi: { saveProjectFile: save } });
  let snapshot: TrackerSnapshot;
  backend.subscribe(value => { snapshot = value; }, error => { throw new Error(error); });
  return { backend, snapshot: () => snapshot!, disk: () => parsePortableProjectFile(disk), writes: () => writes, reject: () => { reject = true; } };
}

const chapter = (id: string): Chapter => ({
  id, contributorId: '', contributorName: 'Contributor', contributorEmail: '', title: id, folderUrl: '', leadEditor: '',
  initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0',
  followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '',
  followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No',
});

for (const shared of [false, true]) {
  const mode = shared ? 'shared' : 'local';
  test(`${mode}: subsequent mutation cannot replace the first failed recovery candidate`, async () => {
    const f = fixture(shared);
    f.reject();
    await assert.rejects(f.backend.createChapters([chapter('A')], 'test', 'manual'), /changed on disk/);
    const firstCandidate = f.backend.recoveryContents();
    await assert.rejects(f.backend.createChapters([chapter('B')], 'test', 'manual'), /conflict copy/);
    assert.equal(f.backend.recoveryContents(), firstCandidate);
    assert.deepEqual(parsePortableProjectFile(firstCandidate).chapters.map(c => c.id), ['A']);
    assert.deepEqual(f.disk().chapters, []);
    assert.equal(f.writes(), 0);
  });
  test(`${mode}: close waits for the in-flight write to finish successfully`, async () => {
    let releaseWrite!: () => void;
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => { signalStarted = resolve; });
    const release = new Promise<void>(resolve => { releaseWrite = resolve; });
    const f = fixture(shared, async () => { signalStarted(); await release; });
    const mutation = f.backend.createChapters([chapter('A')], 'test', 'manual');
    await started;
    let closed = false;
    const closing = f.backend.close().then(() => { closed = true; });
    await Promise.resolve();
    assert.equal(closed, false);
    assert.equal(f.writes(), 0);
    releaseWrite();
    await Promise.all([mutation, closing]);
    assert.equal(closed, true);
    assert.equal(f.writes(), 1);
    assert.deepEqual(f.disk().chapters.map(c => c.id), ['A']);
  });
  test(`${mode}: close preserves failed work until the conflict copy is explicitly saved`, async () => {
    const f = fixture(shared);
    f.reject();
    await assert.rejects(f.backend.createChapters([chapter('A')], 'test', 'manual'), /changed on disk/);
    assert.equal(f.backend.hasPendingRecovery(), true);
    const savedCopy = f.backend.recoveryContents();
    await assert.rejects(f.backend.close(), /conflict copy/);
    assert.equal(f.backend.recoveryContents(), savedCopy);
    // The caller supplies true only after persisting this copy via Save As.
    assert.deepEqual(parsePortableProjectFile(savedCopy).chapters.map(c => c.id), ['A']);
    await f.backend.close(true);
    assert.equal(f.backend.hasPendingRecovery(), false);
    assert.equal(f.writes(), 0, 'Closing must not overwrite the original file');
  });
  test(`${mode}: simultaneous initialization creates exactly one project`, async () => {
    const f = fixture(shared);
    const results = await Promise.allSettled([
      f.backend.createInitialProject('First', 'test'),
      f.backend.createInitialProject('Second', 'test'),
    ]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    if (results[1].status === 'rejected') assert.match(String(results[1].reason), /already named/);
    assert.equal(f.writes(), 1);
    assert.equal(f.disk().project.name, 'First');
    assert.equal(f.disk().projectRevision, 1);
    assert.equal(f.disk().activity.filter(event => event.action === 'project-started').length, 1);
  });
  test(`${mode}: overlapping saves retain both chapters and monotonically advance revision`, async () => {
    const f = fixture(shared);
    await Promise.all([f.backend.createChapters([chapter('A')], 'test', 'manual'), f.backend.createChapters([chapter('B')], 'test', 'manual')]);
    assert.deepEqual(f.disk().chapters.map(c => c.id), ['A', 'B']);
    assert.equal(f.disk().projectRevision, 2);
    assert.equal(f.snapshot().revision, 2);
  });
  test(`${mode}: rejected save preserves disk and retains attempted content for conflict copy`, async () => {
    const f = fixture(shared);
    await f.backend.createChapters([chapter('A')], 'test', 'manual');
    f.reject();
    await assert.rejects(f.backend.saveChapter({ ...f.snapshot().chapters[0], title: 'Unsaved work' }, 1, 'test'), /changed on disk/);
    assert.equal(f.disk().chapters[0].title, 'A');
    assert.equal(f.snapshot().chapters[0].title, 'A');
    assert.equal(parsePortableProjectFile(f.backend.recoveryContents()).chapters[0].title, 'Unsaved work');
  });
  test(`${mode}: stale reset is rejected; reviewed revision starts a new empty generation`, async () => {
    const f = fixture(shared);
    await f.backend.createChapters([chapter('A')], 'test', 'manual');
    await assert.rejects(f.backend.startNewProject({ name: 'New', expectedRevision: 0 }, 'test'), /Nothing was deleted/);
    assert.equal(f.disk().chapters.length, 1);
    const project = await f.backend.startNewProject({ name: 'New', expectedRevision: 1 }, 'test');
    assert.equal(project.name, 'New');
    assert.notEqual(project.generationId, 'g1');
    assert.equal(f.disk().chapters.length, 0);
    assert.equal(f.disk().projectRevision, 2);
  });
  test(`${mode}: conflicting chapter revision does not write the file`, async () => {
    const f = fixture(shared);
    await f.backend.createChapters([chapter('A')], 'test', 'manual');
    const result = await f.backend.saveChapter({ ...f.snapshot().chapters[0], title: 'Stale' }, 0, 'test');
    assert.equal(result.kind, 'conflict');
    assert.equal(f.writes(), 1);
    assert.equal(f.disk().chapters[0].title, 'A');
  });
}
