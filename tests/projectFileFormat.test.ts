import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chapter, ProjectState } from '../src/types';
import { ActivityViewEvent } from '../src/domain/activityView';
import {
  PortableProjectFile,
  assertPortableProjectRevision,
  preparePortableProjectOpen,
  parsePortableProjectFile,
  serializePortableProjectFile,
  validatePortableProjectFile,
  hashPortableProjectContents,
} from '../src/storage/projectFileFormat';

const project: ProjectState = {
  name: 'Local Book',
  generationId: 'local-generation',
  startedAt: '2026-01-01T00:00:00.000Z',
  startedBy: 'local-editor',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function chapter(id = 'CH-01'): Chapter {
  return {
    id,
    contributorId: 'A',
    contributorName: 'Author',
    contributorEmail: 'a@example.com',
    title: `Chapter ${id}`,
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
    dataRevision: 1,
  };
}

function portable(overrides: Partial<PortableProjectFile> = {}): PortableProjectFile {
  return {
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'local-editor',
    project,
    chapters: [chapter()],
    activity: [{ id: 'a1', actorEmail: 'local-editor', action: 'chapter-created', summary: 'Created CH-01', clientAt: '2026-01-01T00:00:00.000Z' }],
    ...overrides,
  };
}

test('portable project file validates and round-trips', () => {
  const contents = serializePortableProjectFile(portable());
  const parsed = parsePortableProjectFile(contents);
  assert.equal(parsed.format, 'book-editorial-tracker-project');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.project.name, 'Local Book');
  assert.equal(parsed.chapters[0].id, 'CH-01');
});

test('portable project file rejects unknown versions', () => {
  assert.throws(() => validatePortableProjectFile({ ...portable(), version: 2 }), /Unsupported project file version/);
});

test('portable project file rejects unsafe paths anywhere in chapter data', () => {
  const unsafe = chapter();
  unsafe.submissions = [{
    id: 'record-1',
    stage: 'abstract',
    sourceRelativePath: 'C:/Users/alice/source.docx',
    effectiveOn: '2026-01-01',
    recordedAt: '2026-01-01T00:00:00.000Z',
    recordedBy: 'local-editor',
    state: 'active',
  }];
  assert.throws(() => validatePortableProjectFile(portable({ chapters: [unsafe] })), /unsafe reference/);
});

test('portable project file enforces all stated count limits', () => {
  assert.throws(() => validatePortableProjectFile(portable({ chapters: Array.from({ length: 51 }, (_, index) => chapter(`CH-${index}`)) })), /at most 50 chapters/);
  const tooManyStageRecords = chapter();
  tooManyStageRecords.submissions = Array.from({ length: 101 }, (_, index) => ({
    id: `record-${index}`,
    stage: 'abstract',
    effectiveOn: '2026-01-01',
    recordedAt: '2026-01-01T00:00:00.000Z',
    recordedBy: 'local-editor',
    state: 'active',
  }));
  assert.throws(() => validatePortableProjectFile(portable({ chapters: [tooManyStageRecords] })), /at most 100 stage records/);
  const activity = Array.from({ length: 5001 }, (_, index): ActivityViewEvent => ({
    id: `a-${index}`,
    actorEmail: 'local-editor',
    action: 'chapter-updated',
    summary: `Updated ${index}`,
    clientAt: '2026-01-01T00:00:00.000Z',
  }));
  assert.throws(() => validatePortableProjectFile(portable({ activity })), /at most 5000 activity records/);
});

test('portable project file enforces the serialized size limit', () => {
  const largeTitle = 'x'.repeat(26 * 1024 * 1024);
  assert.throws(() => serializePortableProjectFile(portable({ chapters: [{ ...chapter(), title: largeTitle }] })), /larger than 25 MiB/);
});

test('portable project file rejects stale project revisions', () => {
  assert.throws(() => assertPortableProjectRevision(portable({ projectRevision: 2 }), 1), /changed since it was opened/);
});

test('portable project file opening preserves the exact original-byte hash for valid formatting variants', async () => {
  const file = portable();
  const minified = JSON.stringify(file);
  const spaced = `${JSON.stringify(file, null, 4)}\n`;

  const openedMinified = await preparePortableProjectOpen(minified);
  const openedSpaced = await preparePortableProjectOpen(spaced);

  assert.deepEqual(openedMinified.file, openedSpaced.file);
  assert.equal(openedMinified.originalHash, await hashPortableProjectContents(minified));
  assert.equal(openedSpaced.originalHash, await hashPortableProjectContents(spaced));
  assert.notEqual(openedMinified.originalHash, openedSpaced.originalHash);
});
