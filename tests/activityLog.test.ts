import assert from 'node:assert/strict';
import test from 'node:test';
import { writeActivityEvent } from '../src/domain/activityLog';

test('writes a privacy-safe immutable activity event through the transaction', () => {
  const writes: Array<{ ref: { id: string }; data: Record<string, unknown> }> = [];
  writeActivityEvent({ set: (ref: { id: string }, data: Record<string, unknown>) => writes.push({ ref, data }) } as any, {
    ref: { id: 'event-1' } as any,
    actorEmail: 'editor@example.com',
    action: 'chapter-updated',
    summary: 'Updated CH01',
    chapterId: 'CH01',
    changedFields: ['title', 'abstractText'],
    revisionBefore: 1,
    revisionAfter: 2,
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.actorEmail, 'editor@example.com');
  assert.deepEqual(writes[0].data.changedFields, ['title', 'abstractText']);
  assert.equal('abstractText' in writes[0].data, false);
  assert.equal('absolutePath' in writes[0].data, false);
});
