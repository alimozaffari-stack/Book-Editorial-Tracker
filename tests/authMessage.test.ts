import assert from 'node:assert/strict';
import test from 'node:test';
import { authErrorMessage } from '../src/utils/authMessage';

test('explains Firebase sign-in throttling without exposing implementation detail', () => {
  assert.match(authErrorMessage({ code: 'auth/too-many-requests' }), /wait a few minutes/i);
});

test('requires an email address before a reset email can be requested', () => {
  assert.equal(authErrorMessage({ code: 'auth/missing-email' }), 'Enter your email address first.');
});
