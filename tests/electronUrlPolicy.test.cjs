const assert = require('node:assert/strict');
const test = require('node:test');
const { isFirebaseAuthPopup } = require('../electron/url-policy.cjs');

test('allows only this Firebase project’s HTTPS authentication handler popup', () => {
  assert.equal(
    isFirebaseAuthPopup(
      'https://edotorial-review-tracker.firebaseapp.com/__/auth/handler?apiKey=example',
      'edotorial-review-tracker.firebaseapp.com',
    ),
    true,
  );
  assert.equal(
    isFirebaseAuthPopup('https://accounts.google.com/o/oauth2/auth', 'edotorial-review-tracker.firebaseapp.com'),
    false,
  );
  assert.equal(
    isFirebaseAuthPopup('https://example.com/__/auth/handler', 'edotorial-review-tracker.firebaseapp.com'),
    false,
  );
});
