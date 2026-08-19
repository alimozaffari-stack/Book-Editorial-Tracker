import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Chapter, ChapterStageRecord, ProjectState } from '../src/types';
import { FirebaseTrackerBackend, FirebaseTrackerBackendOptions } from '../src/storage/FirebaseTrackerBackend';
import { createBackend } from '../src/storage/backendFactory';
import { ActivityViewEvent } from '../src/domain/activityView';
import { ProjectImportResult, ProjectImportPlan } from '../src/domain/projectImportPlan';
import { WriteResult, createInventoryChaptersIfAbsent } from '../src/utils/chapterWrites';
import { LocalFileTrackerBackend } from '../src/storage/LocalFileTrackerBackend';
import { SharedFolderTrackerBackend } from '../src/storage/SharedFolderTrackerBackend';
import { PortableProjectFile, assertPortableProjectRevision, parsePortableProjectFile, preparePortableProjectOpen, serializePortableProjectFile } from '../src/storage/projectFileFormat';
import * as wrapper from '../src/utils/firestoreWrapper';

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

test('FirebaseTrackerBackend delegates write operations to existing Firebase write helpers', async () => {
  const writes = {
    saveCalled: 0,
    appendCalled: 0,
    voidCalled: 0,
    createCalled: 0,
    deleteCalled: 0,
    batchCalled: 0,
    startCalled: 0,
    applyImportCalled: 0,
    createProjectCalled: 0,
  };

  const chapter: Chapter = { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'T', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' };
  const record: ChapterStageRecord = { id: 'r-01', stage: 'revision', roundNumber: 1, effectiveOn: '2026-01-01', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'a@example.com', state: 'active' };
  const project: ProjectState = { name: 'Current', generationId: 'g1', startedAt: '2026-01-01T00:00:00Z', startedBy: 'a@example.com', updatedAt: '2026-01-01T00:00:00Z' };

  const backend = new FirebaseTrackerBackend({
    dependencies: {
      saveChapterWithRevision: async (_db, _, expectedRevision, actor) => {
        assert.equal(expectedRevision, 1);
        assert.equal(actor, 'editor@example.com');
        writes.saveCalled += 1;
        return { kind: 'ok', new: { ...chapter, dataRevision: 2 } } as WriteResult;
      },
      updateChapterFieldsBatch: async (_db, _chapterIds, _field, _value, actor) => {
        assert.equal(actor, 'editor@example.com');
        writes.batchCalled += 1;
      },
      appendStageRecordWithRevision: async () => {
        writes.appendCalled += 1;
        return { kind: 'ok', new: chapter } as WriteResult;
      },
      voidStageRecordWithRevision: async () => {
        writes.voidCalled += 1;
        return { kind: 'ok', new: chapter } as WriteResult;
      },
      createChaptersIfAbsent: async () => {
        writes.createCalled += 1;
        return { created: ['CH-01'], skipped: [] };
      },
      deleteChaptersWithActivity: async () => {
        writes.deleteCalled += 1;
        return { kind: 'ok', new: chapter } as WriteResult;
      },
      startNewProjectWithRevisionCheck: async () => {
        writes.startCalled += 1;
        return project;
      },
      createInitialProject: async () => {
        writes.createProjectCalled += 1;
        return { name: 'Imported', generationId: 'g1', startedAt: '2026-01-01T00:00:00Z', startedBy: 'editor@example.com', updatedAt: '2026-01-01T00:00:00Z' };
      },
      applyProjectImport: async () => {
        writes.applyImportCalled += 1;
        const result: ProjectImportResult = {
          chaptersChanged: 1,
          stageRecordsAdded: 1,
          alreadyRecorded: 0,
          excluded: 0,
          unsupported: 0,
          failed: 0,
          changedChapters: [chapter],
        };
        return result;
      },
      subscribeProject: () => () => undefined,
      subscribeChapters: () => () => undefined,
      subscribeActivity: () => () => undefined,
    } as FirebaseTrackerBackendOptions['dependencies'],
  } as FirebaseTrackerBackendOptions);

  const saveResult = await backend.saveChapter(chapter, 1, 'editor@example.com');
  assert.equal(saveResult.kind, 'ok');
  assert.equal(writes.saveCalled, 1);

  await backend.appendStageRecord('CH-01', record, 1, 'editor@example.com');
  await backend.voidStageRecord('CH-01', 'r-01', 'typo', 2, 'editor@example.com');
  await backend.batchUpdateChapterFields(['CH-01'], 'leadEditor', 'Editor', 'editor@example.com');
  await backend.createChapters([chapter], 'editor@example.com', 'manual-entry');
  await backend.deleteChapters([chapter], 'editor@example.com');
  await backend.startNewProject({ previousProject: project, nextProjectName: 'Next', reviewedChapters: [{ id: 'CH-01', dataRevision: 1 }], backupExportedAt: '2026-01-01T00:00:00Z' }, 'editor@example.com');
  await backend.applyProjectImport({ entries: [], expectedRevisions: {} } as ProjectImportPlan, 'editor@example.com');
  await backend.createInitialProject('Imported', 'editor@example.com');

  assert.equal(writes.appendCalled, 1);
  assert.equal(writes.voidCalled, 1);
  assert.equal(writes.batchCalled, 1);
  assert.equal(writes.createCalled, 1);
  assert.equal(writes.deleteCalled, 1);
  assert.equal(writes.startCalled, 1);
  assert.equal(writes.applyImportCalled, 1);
  assert.equal(writes.createProjectCalled, 1);
});

test('FirebaseTrackerBackend uses scan-inventory backend path and can be rejected for pre-write ID conflicts', async () => {
  let delegated = 0;
  let accidental = 0;
  const chapter = { id: 'CH-01', dataRevision: 1, contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'T', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' };
  const backend = new FirebaseTrackerBackend({
    dependencies: {
      createInventoryChaptersIfAbsent: async () => {
        delegated += 1;
        throw new Error('Nothing was created. A selected chapter already exists; reload the scan and review the inventory again.');
      },
      createChaptersIfAbsent: async () => {
        accidental += 1;
        return { created: [], skipped: [] };
      },
    } as FirebaseTrackerBackendOptions['dependencies'],
  } as FirebaseTrackerBackendOptions);

  await assert.rejects(async () => {
    await backend.createChaptersFromInventory([chapter, { ...chapter, id: 'CH-02' }], 'editor@example.com');
  }, /already exists/);

  assert.equal(delegated, 1);
  assert.equal(accidental, 0);
});

test('createInventoryChaptersIfAbsent rejects a case-insensitive live collision before any Firebase write', async () => {
  const db = makeFirebaseDb('inventory-case-collision');
  const originalRunTransaction = wrapper.runTransaction;
  wrapper.setFirestoreReferenceResolversForTest(
    (_db, id) => ({ id } as any),
    () => ({ id: 'activity-event' } as any),
  );
  let setCalls = 0;
  let activityWrites = 0;
  wrapper.setRunTransaction(async (_db, callback) => callback({
    get: async (target: { type?: string; id?: string }) => {
      if (target?.type === 'collection') {
        return {
          docs: [
            {
              id: 'existing-doc',
              data: () => inventoryChapter('ch-01', 'Existing title', 'Existing contributor'),
            },
          ],
        };
      }
      throw new Error(`Unexpected get target: ${String(target?.id ?? target?.type)}`);
    },
    set: (ref: { id: string }) => {
      if (ref.id === 'activity-event') {
        activityWrites += 1;
        return;
      }
      setCalls += 1;
    },
  } as any));

  try {
    await assert.rejects(
      () => createInventoryChaptersIfAbsent(db, [inventoryChapter('CH-01')], 'editor@example.com'),
      /already exists/i,
    );
    assert.equal(setCalls, 0);
    assert.equal(activityWrites, 0);
  } finally {
    wrapper.setRunTransaction(originalRunTransaction as any);
    wrapper.setFirestoreReferenceResolversForTest();
  }
});

test('createBackend defaults to the Firebase implementation', () => {
  const backend = createBackend();
  assert.equal(backend.kind, 'firebase');
  assert.equal(backend.supportsConcurrentEditing, true);
});

test('FirebaseTrackerBackend marks concurrent edits as supported and subscribes listeners', () => {
  const project: ProjectState = { name: 'Current', generationId: 'g1', startedAt: '2026-01-01T00:00:00Z', startedBy: 'editor@example.com', updatedAt: '2026-01-01T00:00:00Z' };
  const chapters = [{ id: 'CH-01', contributorId: 'A', contributorName: 'One', contributorEmail: 'a@example.com', title: 'T', folderUrl: '', leadEditor: '', initialAbstractSubmitted: 'No', updatedAbstractSubmitted: 'No', initialChapterSubmission: 'No', initialChapterDate: '', submittedWordCount: '0', followUpForInitialSubmission: 'No', followUpDate: '', feedbackSent: 'No', dateFeedbackSent: '', feedbackLink: '', revision01Submitted: 'No', dateRevision01Submitted: '', followUpContacted: 'No', dateFollowUpContacted: '', decisionToProceed: 'No', reasonIfNo: '', imageListSubmitted: 'No', imagesMeetQc: 'No', indexingTermsSubmitted: 'No' }];
  const activity: ActivityViewEvent[] = [{ id: 'activity-01', actorEmail: 'a@example.com', action: 'chapter-created', summary: 'created CH-01' }];
  let subscribeProjectCalled = 0;
  let subscribeChaptersCalled = 0;
  let subscribeActivityCalled = 0;
  const backend = new FirebaseTrackerBackend({
    dependencies: {
      appendStageRecordWithRevision: (_db, _chapterId, _record, _revision, _actor) => Promise.resolve({ kind: 'ok', new: chapters[0] as Chapter }),
      voidStageRecordWithRevision: (_db, _chapterId, _recordId, _reason, _revision, _actor) => Promise.resolve({ kind: 'ok', new: chapters[0] as Chapter }),
      createChaptersIfAbsent: (_db, _chapters, _actor, _source) => Promise.resolve({ created: [], skipped: [] }),
      deleteChaptersWithActivity: (_db, _chapters, _actor) => Promise.resolve({ kind: 'ok', new: chapters[0] as Chapter }),
      startNewProjectWithRevisionCheck: (_db, _input, _actor) => Promise.resolve(project),
      subscribeProject: (_db, onProject) => {
        subscribeProjectCalled += 1;
        onProject(project);
        return () => {};
      },
      subscribeChapters: (_db, onChapters) => {
        subscribeChaptersCalled += 1;
        onChapters(chapters as unknown as Chapter[]);
        return () => {};
      },
      subscribeActivity: (_db, onActivity) => {
        subscribeActivityCalled += 1;
        onActivity(activity);
        return () => {};
      },
    } as FirebaseTrackerBackendOptions['dependencies'],
  } as FirebaseTrackerBackendOptions);

  const snapshots = [] as any[];
  const unsubscribe = backend.subscribe((snapshot) => snapshots.push(snapshot), () => { throw new Error('not expected'); });
  assert.equal(subscribeProjectCalled, 1);
  assert.equal(subscribeChaptersCalled, 1);
  assert.equal(subscribeActivityCalled, 1);
  assert.equal(snapshots.length, 3);
  assert.equal(snapshots[0].project?.name, 'Current');
  assert.equal(snapshots[1].chapters[0].id, 'CH-01');
  assert.equal(snapshots[2].activity[0].summary, 'created CH-01');
  assert.equal(backend.supportsConcurrentEditing, true);
  unsubscribe();
});

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
