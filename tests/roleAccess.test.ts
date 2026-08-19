import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveTrackerRole } from '../src/domain/roleAccess';

test('guides an unrostered editor instead of granting a usable role', () => {
  assert.equal(effectiveTrackerRole('editor', 'editor@example.com', { members: ['admin@example.com'] }), null);
});

test('allows a rostered editor and supports legacy admin bootstrap only before roster creation', () => {
  assert.equal(effectiveTrackerRole('editor', 'editor@example.com', { members: ['editor@example.com'] }), 'editor');
  assert.equal(effectiveTrackerRole('admin', 'admin@example.com', undefined), 'admin');
  assert.equal(effectiveTrackerRole('editor', 'editor@example.com', undefined), null);
});
