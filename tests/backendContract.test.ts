import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chapter, ChapterStageRecord, ProjectState } from '../src/types';
import { createBackend } from '../src/storage/backendFactory';
import { ActivityViewEvent } from '../src/domain/activityView';
import { ProjectImportResult, ProjectImportPlan } from '../src/domain/projectImportPlan';
import { LocalFileTrackerBackend } from '../src/storage/LocalFileTrackerBackend';
import { SharedFolderTrackerBackend } from '../src/storage/SharedFolderTrackerBackend';
import { PortableProjectFile, assertPortableProjectRevision, parsePortableProjectFile, preparePortableProjectOpen, serializePortableProjectFile } from '../src/storage/projectFileFormat';

function inventoryChapter(id: string, title = `Title ${id}`, contributorName = `Contributor ${id}`): Chapter {
  return {
    id,
    dataRevision: 0,
    contributorId: '',
    contributorName,
    contributorEmail: '',
    title,
    folderUrl: '',
    leadEditor: '',
    initialAbstractSubmitted: 'No',
    updatedAbstractSubmitted: 'No',
    initialChapterSubmission: 'No',
    initialChapterDate: '',
    submittedWordCount: '0',
    followUpForInitialSubmission: 'No',
    followUpDate: '',
    feedbackSent: 'No',
    dateFeedbackSent: '',
    feedbackLink: '',
    revision01Submitted: 'No',
    dateRevision01Submitted: '',
    followUpContacted: 'No',
    dateFollowUpContacted: '',
    decisionToProceed: 'No',
    reasonIfNo: '',
    imageListSubmitted: 'No',
    imagesMeetQc: 'No',
    indexingTermsSubmitted: 'No',
  };
}

function makeFirebaseDb(name: string): Firestore {
  const app = initializeApp({
    apiKey: 'test-key',
    authDomain: 'example.test',
    projectId: 'book-editorial-tracker-tests',
    appId: '1:1234567890:web:test',
  }, name);
  return getFirestore(app);
}









test('LocalFileTrackerBackend creates, saves, reopens, edits, and saves synthetic local project data', async () => {
  const project: ProjectState = { name: 'Local Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'tester', updatedAt: '2026-01-01T00:00:00.000Z' };
  const initial: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 0,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'tester',
    project,
    chapters: [],
    activity: [],
  };
  let storedContents = serializePortableProjectFile(initial);
  let storedHash = 'hash-0';
  const writes: Array<{ expectedHash: string; contents: string }> = [];
  const fileApi = {
    saveProjectFile: async (_fileToken: string, expectedHash: string, contents: string) => {
      assert.equal(expectedHash, storedHash);
      writes.push({ expectedHash, contents });
      storedContents = contents;
      storedHash = `hash-${writes.length}`;
      return { ok: true, hash: storedHash, message: 'saved' };
    },
  };

  const opened = new LocalFileTrackerBackend({ fileToken: 'token-1', contents: storedContents, initialHash: storedHash, editorLabel: 'Local Editor', fileApi });
  assert.equal(opened.kind, 'local-file');
  assert.equal(opened.supportsConcurrentEditing, false);

  const localChapter: Chapter = { id: 'CH-01', dataRevision: 0, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'T', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' };
  await opened.createChapters([localChapter], 'Local Editor', 'manual-entry');
  assert.equal(writes.length, 1);
  assert.equal(JSON.parse(storedContents).chapters.length, 1);

  const reopened = new LocalFileTrackerBackend({ fileToken: 'token-1', contents: storedContents, initialHash: storedHash, editorLabel: 'Local Editor', fileApi });
  const saved = await reopened.saveChapter({ ...localChapter, title: 'Updated title', dataRevision: 1 }, 1, 'Local Editor');
  assert.equal(saved.kind, 'ok');
  assert.equal(writes.length, 2);
  assert.equal(JSON.parse(storedContents).chapters[0].title, 'Updated title');
  assert.equal(JSON.parse(storedContents).projectRevision, 2);
});

test('LocalFileTrackerBackend initializes a local project as one local mutation', async () => {
  const starter: ProjectState = { name: 'Draft project', generationId: 'g0', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const file: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 0,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [],
    activity: [],
  };
  let storedContents = serializePortableProjectFile(file);
  let storedHash = 'hash-initial';
  const fileApi = {
    saveProjectFile: async (_fileToken: string, expectedHash: string, contents: string) => {
      assert.equal(expectedHash, storedHash);
      storedContents = contents;
      storedHash = `hash-${Date.now()}`;
      return { ok: true, hash: storedHash, message: 'saved' };
    },
  };
  const backend = new LocalFileTrackerBackend({ fileToken: 'token-1', contents: storedContents, initialHash: storedHash, editorLabel: 'Local Editor', fileApi });
  const snapshots: any[] = [];
  const unsubscribe = backend.subscribe((snapshot) => snapshots.push(snapshot), () => { throw new Error('not expected'); });

  const project = await backend.createInitialProject('Main Project', 'Local Editor');
  const parsed = parsePortableProjectFile(storedContents);

  assert.equal(project.name, 'Main Project');
  assert.equal(parsed.projectRevision, 1);
  assert.equal(parsed.project.name, 'Main Project');
  assert.equal(parsed.activity.length, 1);
  assert.equal(parsed.activity[0].action, 'project-started');
  assert.equal(parsed.activity[0].actorEmail, 'Local Editor');
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[1].project?.name, 'Main Project');

  assertPortableProjectRevision(parsed, 1);
  unsubscribe();
});

test('LocalFileTrackerBackend rejects inventory rows when any selected chapter already exists and performs no write', async () => {
  const starter: ProjectState = { name: 'Local Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const base: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [{ id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Existing', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' }],
    activity: [],
  };

  let saves = 0;
  let snapshotRevisions: number[] = [];
  const contents = serializePortableProjectFile(base);
  const backend = new LocalFileTrackerBackend({
    fileToken: 'token-conflict',
    contents,
    initialHash: 'hash-local',
    editorLabel: 'Local Editor',
    fileApi: {
      saveProjectFile: async () => {
        saves += 1;
        return { ok: true, hash: `hash-${Date.now()}`, message: 'ok' };
      },
    },
  });
  const unsubscribe = backend.subscribe((snapshot) => snapshotRevisions.push(snapshot.revision), () => { throw new Error('not expected'); });

  await assert.rejects(async () => {
    await backend.createChaptersFromInventory([
      { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Existing', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
      { id: 'CH-02', dataRevision: 1, contributorId: 'B', contributorName: 'Two', contributorEmail: 'b@example.com', title: 'New', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
    ], 'Local Editor');
  }, /already exists/);

  const finalState = parsePortableProjectFile(contents);
  assert.equal(finalState.chapters.length, 1);
  assert.equal(finalState.chapters[0].id, 'CH-01');
  assert.equal(finalState.activity.length, 0);
  assert.equal(saves, 0);
  assert.equal(snapshotRevisions.length, 1);

  unsubscribe();
});

test('LocalFileTrackerBackend rejects a case-insensitive existing inventory id with no save or snapshot emission', async () => {
  const starter: ProjectState = { name: 'Local Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const base: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [inventoryChapter('ch-01', 'Existing', 'One')],
    activity: [],
  };
  let saves = 0;
  const contents = serializePortableProjectFile(base);
  const backend = new LocalFileTrackerBackend({
    fileToken: 'token-case-conflict',
    contents,
    initialHash: 'hash-local',
    editorLabel: 'Local Editor',
    fileApi: {
      saveProjectFile: async () => {
        saves += 1;
        return { ok: true, hash: 'unused', message: 'ok' };
      },
    },
  });
  const revisions: number[] = [];
  const unsubscribe = backend.subscribe(snapshot => revisions.push(snapshot.revision), () => { throw new Error('not expected'); });

  await assert.rejects(
    () => backend.createChaptersFromInventory([inventoryChapter('CH-01')], 'Local Editor'),
    /already exists/i,
  );

  const after = parsePortableProjectFile(contents);
  assert.equal(after.chapters.length, 1);
  assert.equal(after.chapters[0].id, 'ch-01');
  assert.equal(after.activity.length, 0);
  assert.equal(saves, 0);
  assert.equal(revisions.length, 1);
  unsubscribe();
});

test('LocalFileTrackerBackend rejects duplicate inventory ids and oversized batches atomically', async () => {
  const starter: ProjectState = { name: 'Local Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const base: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [],
    activity: [],
  };
  let saves = 0;
  const contents = serializePortableProjectFile(base);
  const backend = new LocalFileTrackerBackend({
    fileToken: 'token-bounds',
    contents,
    initialHash: 'hash-local',
    editorLabel: 'Local Editor',
    fileApi: {
      saveProjectFile: async () => {
        saves += 1;
        return { ok: true, hash: 'unused', message: 'ok' };
      },
    },
  });
  const revisions: number[] = [];
  const unsubscribe = backend.subscribe(snapshot => revisions.push(snapshot.revision), () => { throw new Error('not expected'); });

  await assert.rejects(
    () => backend.createChaptersFromInventory([inventoryChapter('CH-01'), inventoryChapter('ch-01')], 'Local Editor'),
    /already exists|unique/i,
  );
  await assert.rejects(
    () => backend.createChaptersFromInventory(Array.from({ length: 51 }, (_, index) => inventoryChapter(`CH-${String(index + 1).padStart(2, '0')}`)), 'Local Editor'),
    /50|at most/i,
  );

  const after = parsePortableProjectFile(contents);
  assert.equal(after.chapters.length, 0);
  assert.equal(after.activity.length, 0);
  assert.equal(saves, 0);
  assert.equal(revisions.length, 1);
  unsubscribe();
});

test('LocalFileTrackerBackend stale hash failure restores local memory and disk state with no new snapshot', async () => {
  const starter: ProjectState = { name: 'Local Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const file: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [],
    activity: [],
  };
  let storedContents = serializePortableProjectFile(file);
  let storedHash = 'hash-0';
  const fileApi = {
    saveProjectFile: async (_fileToken: string, expectedHash: string, contents: string) => {
      assert.equal(typeof expectedHash, 'string');
      return { ok: false, message: 'The project file changed on disk. Save As to keep your changes.' };
    },
    saveProjectFileAs: async () => ({ cancelled: true }),
  };
  const backend = new LocalFileTrackerBackend({ fileToken: 'token-2', contents: storedContents, initialHash: storedHash, editorLabel: 'Local Editor', fileApi });
  const snapshots: Array<number> = [];
  const unsubscribe = backend.subscribe((snapshot) => snapshots.push(snapshot.revision), () => { throw new Error('not expected'); });
  const localChapter: Chapter = { id: 'CH-01', dataRevision: 0, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'T', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' };
  await assert.rejects(async () => {
    await backend.createChapters([localChapter], 'Local Editor', 'manual-entry');
  }, /changed on disk/);

  const finalState = parsePortableProjectFile(storedContents);
  assert.equal(finalState.projectRevision, 1);
  assert.equal(finalState.chapters.length, 0);
  assert.equal(snapshots.length, 1);

  unsubscribe();
});

test('LocalFileTrackerBackend can open and save a minified portable project without a false stale conflict', async () => {
  const minifiedContents = JSON.stringify({
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'Local Editor',
    project: { name: 'Local Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'Local Editor', updatedAt: '2026-01-01T00:00:00.000Z' },
    chapters: [],
    activity: [],
  });
  const opened = await preparePortableProjectOpen(minifiedContents);
  let sawSave = false;
  const backend = new LocalFileTrackerBackend({
    fileToken: 'token-minified',
    contents: minifiedContents,
    initialHash: opened.originalHash,
    editorLabel: 'Local Editor',
    fileApi: {
      saveProjectFile: async (_fileToken: string, expectedHash: string, contents: string) => {
        assert.equal(expectedHash, opened.originalHash);
        sawSave = true;
        return { ok: true, hash: '1'.repeat(64), message: contents };
      },
    },
  });

  await backend.createChapters([
    { id: 'CH-LOCAL', dataRevision: 0, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'T', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
  ], 'Local Editor', 'manual-entry');

  assert.equal(sawSave, true);
});

test('createBackend supports shared-folder mode with no concurrent editing and read-only fallbacks', () => {
  const backend = createBackend('shared-folder', {
    sharedFile: {
      fileToken: 'shared-token-1',
      contents: serializePortableProjectFile({
        format: 'book-editorial-tracker-project',
        version: 1,
        projectRevision: 0,
        savedAt: '2026-01-01T00:00:00.000Z',
        savedBy: 'editor',
        project: { name: 'Current', generationId: 'g0', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' },
        chapters: [],
        activity: [],
      }),
      editorLabel: 'editor',
      instanceId: 'shared-instance',
      initialHash: 'shared-hash',
      fileApi: {
        verifySharedOwnership: async () => ({ ok: true, lock: { instanceId: 'shared-instance', editorLabel: 'editor', acquiredAt: '2026-01-01T00:00:00.000Z', heartbeatAt: '2026-01-01T00:00:00.000Z' } }),
        saveSharedProjectFile: async () => ({ ok: true, hash: 'shared-hash', message: 'saved' }),
        saveSharedProjectFileAs: async () => ({ cancelled: true }),
      },
      canEdit: true,
    },
  });
  assert.equal(backend.kind, 'shared-folder');
  assert.equal(backend.supportsConcurrentEditing, false);
  backend.close();
});

test('SharedFolderTrackerBackend rejects stale hashes and stale revisions without emitting a replacement snapshot', async () => {
  const starter: ProjectState = { name: 'Shared Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const original: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [
      { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Title', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
    ],
    activity: [],
  };

  let storedContents = serializePortableProjectFile(original);
  const staleHashBackend = new SharedFolderTrackerBackend({
    fileToken: 'shared-token-1',
    contents: storedContents,
    initialHash: 'stale-hash',
    editorLabel: 'Shared Editor',
    instanceId: 'instance-owner',
    canEdit: true,
    fileApi: {
      verifySharedOwnership: async () => ({ ok: true, lock: { instanceId: 'instance-owner', editorLabel: 'Shared Editor', acquiredAt: '2026-01-01T00:00:00.000Z', heartbeatAt: '2026-01-01T00:00:00.000Z' } }),
      saveSharedProjectFile: async (_fileToken: string, _instanceId: string, expectedHash: string) => {
        assert.equal(expectedHash, 'stale-hash');
        return { ok: false, message: 'The project file changed on disk. Save As to keep your changes.' };
      },
      saveSharedProjectFileAs: async () => ({ cancelled: true }),
    },
  });
  const staleSnapshots: number[] = [];
  const staleUnsub = staleHashBackend.subscribe((snapshot) => staleSnapshots.push(snapshot.revision), () => { throw new Error('not expected'); });

  await assert.rejects(async () => {
    await staleHashBackend.saveChapter(
      { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Updated title', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
      1,
      'Shared Editor',
    );
  }, /changed on disk/);
  const staleAfter = parsePortableProjectFile(storedContents);
  assert.equal(staleAfter.chapters[0].title, 'Title');
  assert.equal(staleAfter.projectRevision, 1);
  assert.equal(staleSnapshots.length, 1);
  await staleUnsub();

  let revisionStoredContents = serializePortableProjectFile(original);
  const revisionBackend = new SharedFolderTrackerBackend({
    fileToken: 'shared-token-2',
    contents: revisionStoredContents,
    initialHash: 'shared-hash',
    editorLabel: 'Shared Editor',
    instanceId: 'instance-owner',
    canEdit: true,
    fileApi: {
      verifySharedOwnership: async () => ({ ok: true, lock: { instanceId: 'instance-owner', editorLabel: 'Shared Editor', acquiredAt: '2026-01-01T00:00:00.000Z', heartbeatAt: '2026-01-01T00:00:00.000Z' } }),
      saveSharedProjectFile: async () => ({ ok: true, hash: 'shared-hash', message: 'saved' }),
      saveSharedProjectFileAs: async () => ({ cancelled: true }),
    },
  });
  const revisionSnapshots: number[] = [];
  const revisionUnsub = revisionBackend.subscribe((snapshot) => revisionSnapshots.push(snapshot.revision), () => { throw new Error('not expected'); });
  const conflict = await revisionBackend.saveChapter(
    { id: 'CH-01', dataRevision: 0, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Another title', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
    0,
    'Shared Editor',
  );
  const revisionAfter = parsePortableProjectFile(revisionStoredContents);
  assert.equal(conflict.kind, 'conflict');
  assert.equal(revisionAfter.chapters[0].title, 'Title');
  assert.equal(revisionAfter.projectRevision, 1);
  assert.equal(revisionSnapshots.length, 1);
  await revisionUnsub();
});

test('SharedFolderTrackerBackend becomes read-only after shared ownership loss and blocks later mutations', async () => {
  const starter: ProjectState = { name: 'Shared Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const original: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [
      { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Title', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
    ],
    activity: [],
  };

  let storedContents = serializePortableProjectFile(original);
  let verificationCalls = 0;
  const backend = new SharedFolderTrackerBackend({
    fileToken: 'shared-token-3',
    contents: storedContents,
    initialHash: 'shared-hash',
    editorLabel: 'Shared Editor',
    canEdit: true,
    instanceId: 'instance-owner',
    fileApi: {
      verifySharedOwnership: async () => {
        verificationCalls += 1;
        return { ok: false, message: 'Shared editing access was lost. No further shared saves are permitted until this file is reopened and a lock is acquired.' };
      },
      saveSharedProjectFile: async () => ({ ok: true, hash: 'shared-hash-next', message: 'saved' }),
      saveSharedProjectFileAs: async () => ({ cancelled: true }),
    },
  });
  const snapshots: number[] = [];
  const unsubscribe = backend.subscribe((snapshot) => snapshots.push(snapshot.revision), () => { throw new Error('not expected'); });

  await assert.rejects(async () => {
    await backend.saveChapter(
      { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Updated title', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
      1,
      'Shared Editor',
    );
  }, /No further shared saves are permitted/);

  const afterLoss = parsePortableProjectFile(storedContents);
  assert.equal(verificationCalls, 1);
  assert.equal(afterLoss.chapters[0].title, 'Title');
  assert.equal(snapshots.length, 1);

  await assert.rejects(async () => {
    await backend.saveChapter(
      { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Second update', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
      1,
      'Shared Editor',
    );
  }, /No further shared saves are permitted/);

  assert.equal(verificationCalls, 1);
  unsubscribe();
});

test('SharedFolderTrackerBackend rejects inventory with an already-existing selected chapter and performs no write', async () => {
  const starter: ProjectState = { name: 'Shared Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const base: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [{ id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Existing', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' }],
    activity: [],
  };
  let saves = 0;
  let verifyCalls = 0;
  const contents = serializePortableProjectFile(base);
  const backend = new SharedFolderTrackerBackend({
    fileToken: 'shared-conflict-token',
    contents,
    initialHash: 'hash-shared',
    editorLabel: 'Shared Editor',
    instanceId: 'instance-owner',
    canEdit: true,
    fileApi: {
      verifySharedOwnership: async () => {
        verifyCalls += 1;
        return { ok: true, lock: { instanceId: 'instance-owner', editorLabel: 'Shared Editor', acquiredAt: '2026-01-01T00:00:00.000Z', heartbeatAt: '2026-01-01T00:00:00.000Z' } };
      },
      saveSharedProjectFile: async () => {
        saves += 1;
        return { ok: true, hash: 'hash-shared', message: 'not used' };
      },
      saveSharedProjectFileAs: async () => ({ cancelled: true }),
    },
  });
  const snapshotRevisions: number[] = [];
  const unsubscribe = backend.subscribe((snapshot) => snapshotRevisions.push(snapshot.revision), () => { throw new Error('not expected'); });

  await assert.rejects(async () => {
    await backend.createChaptersFromInventory([
      { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'Existing', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
      { id: 'CH-02', dataRevision: 1, contributorId: 'B', contributorName: 'Two', contributorEmail: 'b@example.com', title: 'New', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
    ], 'Shared Editor');
  }, /already exists/);

  const finalState = parsePortableProjectFile(contents);
  assert.equal(verifyCalls, 1);
  assert.equal(saves, 0);
  assert.equal(finalState.chapters.length, 1);
  assert.equal(finalState.chapters[0].id, 'CH-01');
  assert.equal(finalState.activity.length, 0);
  assert.equal(snapshotRevisions.length, 1);

  unsubscribe();
});

test('SharedFolderTrackerBackend rejects a case-insensitive existing inventory id with no save or snapshot emission', async () => {
  const starter: ProjectState = { name: 'Shared Project', generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'editor', updatedAt: '2026-01-01T00:00:00.000Z' };
  const base: PortableProjectFile = {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'editor',
    project: starter,
    chapters: [inventoryChapter('ch-01', 'Existing', 'One')],
    activity: [],
  };
  let saves = 0;
  let verifyCalls = 0;
  const contents = serializePortableProjectFile(base);
  const backend = new SharedFolderTrackerBackend({
    fileToken: 'shared-case-conflict',
    contents,
    initialHash: 'hash-shared',
    editorLabel: 'Shared Editor',
    instanceId: 'instance-owner',
    canEdit: true,
    fileApi: {
      verifySharedOwnership: async () => {
        verifyCalls += 1;
        return { ok: true, lock: { editorLabel: 'Shared Editor', acquiredAt: '2026-01-01T00:00:00.000Z', heartbeatAt: '2026-01-01T00:00:00.000Z' } };
      },
      saveSharedProjectFile: async () => {
        saves += 1;
        return { ok: true, hash: 'unused', message: 'ok' };
      },
      saveSharedProjectFileAs: async () => ({ cancelled: true }),
    },
  });
  const revisions: number[] = [];
  const unsubscribe = backend.subscribe(snapshot => revisions.push(snapshot.revision), () => { throw new Error('not expected'); });

  await assert.rejects(
    () => backend.createChaptersFromInventory([inventoryChapter('CH-01')], 'Shared Editor'),
    /already exists/i,
  );

  const after = parsePortableProjectFile(contents);
  assert.equal(verifyCalls, 1);
  assert.equal(saves, 0);
  assert.equal(after.chapters.length, 1);
  assert.equal(after.chapters[0].id, 'ch-01');
  assert.equal(after.activity.length, 0);
  assert.equal(revisions.length, 1);
  unsubscribe();
});

test('SharedFolderTrackerBackend can open and save a differently formatted portable project without a false stale conflict', async () => {
  const spacedContents = `{
    "format": "book-editorial-tracker-project",
    "version": 1,
    "projectRevision": 1,
    "savedAt": "2026-01-01T00:00:00.000Z",
    "savedBy": "Shared Editor",
    "project": {
      "name": "Shared Project",
      "generationId": "g1",
      "startedAt": "2026-01-01T00:00:00.000Z",
      "startedBy": "Shared Editor",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    },
    "chapters": [],
    "activity": []
  }
`;
  const opened = await preparePortableProjectOpen(spacedContents);
  let sawSave = false;
  const backend = new SharedFolderTrackerBackend({
    fileToken: 'shared-token-open',
    contents: spacedContents,
    initialHash: opened.originalHash,
    editorLabel: 'Shared Editor',
    instanceId: 'instance-owner',
    canEdit: true,
    fileApi: {
      verifySharedOwnership: async () => ({ ok: true, lock: { instanceId: 'instance-owner', editorLabel: 'Shared Editor', acquiredAt: '2026-01-01T00:00:00.000Z', heartbeatAt: '2026-01-01T00:00:00.000Z' } }),
      saveSharedProjectFile: async (_fileToken: string, _instanceId: string, expectedHash: string) => {
        assert.equal(expectedHash, opened.originalHash);
        sawSave = true;
        return { ok: true, hash: '2'.repeat(64), message: 'saved' };
      },
      saveSharedProjectFileAs: async () => ({ cancelled: true }),
    },
  });

  await backend.createChapters([
    { id: 'CH-SHARED', dataRevision: 0, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'T', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' },
  ], 'Shared Editor', 'manual-entry');

  assert.equal(sawSave, true);
});
