import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePublicUserFirebaseProfile, parseUserFirebaseProfile } from '../src/domain/firebaseProfile';

const validProfile = {
  apiKey: 'AIzaSyA111111111111111111111111111111111',
  authDomain: 'https://sample-project.firebaseapp.com',
  projectId: 'sample-project',
  appId: '1:123456789012:web:abcdef1234567890abcdef',
  firestoreDatabaseId: 'sample-project',
};

test('parseUserFirebaseProfile accepts a valid bounded profile', () => {
  const parsed = parseUserFirebaseProfile({
    ...validProfile,
    projectId: validProfile.projectId.toLowerCase(),
  });
  assert.equal(parsed.projectId, 'sample-project');
});

test('parseUserFirebaseProfile rejects missing required fields', () => {
  assert.throws(() => parseUserFirebaseProfile({ apiKey: validProfile.apiKey, authDomain: validProfile.authDomain, projectId: validProfile.projectId }), {
    message: /missing required fields/,
  });
});

test('parseUserFirebaseProfile rejects unknown keys and control characters', () => {
  assert.throws(() => parseUserFirebaseProfile({
    ...validProfile,
    storageBucket: 'bucket',
  }), {
    message: /unknown field/,
  });
  assert.throws(() => parseUserFirebaseProfile({
    ...validProfile,
    apiKey: 'bad\u0000key',
  }), {
    message: /invalid/i,
  });
});

test('parseUserFirebaseProfile validates authDomain as HTTPS hostname without a path', () => {
  assert.throws(() => parseUserFirebaseProfile({
    ...validProfile,
    authDomain: 'https://sample-project.firebaseapp.com/setup',
  }), { message: /invalid/i });

  assert.throws(() => parseUserFirebaseProfile({
    ...validProfile,
    authDomain: 'http://sample-project.firebaseapp.com',
  }), { message: /invalid/i });
});

test('parsePublicUserFirebaseProfile rejects the owner project id', () => {
  assert.throws(() => parsePublicUserFirebaseProfile({ ...validProfile, projectId: 'owner-project-id' }, 'owner-project-id'), {
    message: /owner project/,
  });
});

test('parseUserFirebaseProfile accepts optional bounded firestore database IDs', () => {
  const parsed = parseUserFirebaseProfile({
    ...validProfile,
    firestoreDatabaseId: undefined,
  });
  assert.equal(parsed.firestoreDatabaseId, undefined);

  const withDatabase = parseUserFirebaseProfile({
    ...validProfile,
    firestoreDatabaseId: 'sample-project-db',
  });
  assert.equal(withDatabase.firestoreDatabaseId, 'sample-project-db');
});
