import assert from 'node:assert/strict';
import test from 'node:test';
import { activityEventsToCsv, filterActivityEvents } from '../src/domain/activityView';

const events = [
  { id: '1', actorEmail: 'Editor@Example.com', action: 'chapter-updated', chapterId: 'CH04', summary: 'Updated "title"', clientAt: '2026-08-13T00:00:00Z' },
  { id: '2', actorEmail: 'admin@example.com', action: 'team-changed', summary: 'Added team member' },
  { id: '3', actorEmail: 'admin@example.com', action: 'chapter-imported', chapterIds: ['CH05', 'CH06'], summary: 'Imported chapters' },
];

test('filters activity case-insensitively by person, chapter, and action', () => {
  assert.equal(filterActivityEvents(events, { person: 'editor', chapter: 'ch04', action: 'updated' }).length, 1);
});

test('chapter filtering includes batch and import summary events', () => {
  assert.equal(filterActivityEvents(events, { person: '', chapter: 'ch06', action: '' }).length, 1);
});

test('filters project activity from supplied events without live Firestore state', () => {
  const projectAware = filterActivityEvents(
    [
      { id: '1', actorEmail: 'editor@example.com', action: 'chapter-updated', chapterId: 'CH04', summary: 'Updated CH04', clientAt: '2026-08-12T10:00:00Z' },
      { id: '2', actorEmail: 'editor@example.com', action: 'chapter-updated', chapterId: 'CH04', summary: 'Updated CH04 earlier', clientAt: '2026-08-10T10:00:00Z' },
    ],
    { person: '', chapter: '', action: '' },
    '2026-08-11T00:00:00Z',
  ).map(event => event.id);

  assert.deepEqual(projectAware, ['1']);
});

test('exports activity with correct CSV escaping', () => {
  const csv = activityEventsToCsv(events);
  assert.match(csv, /"Updated ""title"""/);
  assert.match(csv, /"CH05; CH06"/);
  assert.equal(csv.split('\r\n').length, 4);
});
