import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FirebaseSetupView, buildBackToStorageChoicesState } from '../src/components/FirebaseSetupView';
import { StorageModeChooser } from '../src/components/StorageModeChooser';
import { buildSharedProjectLockStateForPortableMode } from '../src/storage/sharedProjectLockState';
import { shouldClearBackendOnStorageChange, shouldRunFirebaseBackendLifecycle } from '../src/storage/backendLifecycle';

const editorLabelExplanation = 'Used only to identify changes in this project; it does not create an account.';

test('Back button returns the public Firebase setup flow to the chooser state and clears transient setup state', () => {
  assert.deepEqual(
    buildBackToStorageChoicesState({
      storageKind: 'firebase',
      runtimeReady: true,
      isRuntimeConfiguring: true,
      setupMessage: 'Saved profile loaded.',
      profileInputError: 'Bad profile.',
      runtimeError: 'Setup failed.',
    }),
    {
      storageKind: null,
      runtimeReady: false,
      isRuntimeConfiguring: false,
      setupMessage: '',
      profileInputError: null,
      runtimeError: null,
    },
  );
});

test('Firebase setup renders the Back to storage choices button', () => {
  const html = renderToStaticMarkup(
    React.createElement(FirebaseSetupView, {
      onSubmit: async () => {},
      onBack: () => {},
      error: null,
    }),
  );

  assert.match(html, /Back to storage choices/);
});

test('storage chooser renders the editor-label explanation for local and shared modes', () => {
  const html = renderToStaticMarkup(
    React.createElement(StorageModeChooser, {
      isPublicBuild: true,
      busy: false,
      message: '',
      error: null,
      onChooseFirebase: () => {},
      onCreateLocalProject: async () => {},
      onOpenLocalProject: async () => {},
      onOpenSharedProject: async () => {},
    }),
  );

  assert.equal(html.split(editorLabelExplanation).length - 1, 2);
});

test('local project mode does not retain a shared-project lock token', () => {
  assert.deepEqual(
    buildSharedProjectLockStateForPortableMode('local-file', 'local-token', true, {
      editorLabel: 'Editor',
      acquiredAt: '2026-01-01T00:00:00.000Z',
      heartbeatAt: '2026-01-01T00:00:00.000Z',
    }),
    {
      canEdit: false,
      fileToken: '',
      lock: null,
    },
  );
});

test('shared project mode keeps the shared lock token and edit state', () => {
  const lock = {
    editorLabel: 'Editor',
    acquiredAt: '2026-01-01T00:00:00.000Z',
    heartbeatAt: '2026-01-01T00:00:00.000Z',
  };

  assert.deepEqual(
    buildSharedProjectLockStateForPortableMode('shared-folder', 'shared-token', true, lock),
    {
      canEdit: true,
      fileToken: 'shared-token',
      lock,
    },
  );
});

test('local and shared modes do not run the Firebase backend lifecycle', () => {
  assert.equal(shouldRunFirebaseBackendLifecycle('local-file', true), false);
  assert.equal(shouldRunFirebaseBackendLifecycle('shared-folder', true), false);
  assert.equal(shouldRunFirebaseBackendLifecycle('firebase', true), true);
  assert.equal(shouldRunFirebaseBackendLifecycle('firebase', false), false);
});

test('local and shared modes preserve the backend when storage-kind cleanup runs', () => {
  assert.equal(shouldClearBackendOnStorageChange('local-file'), false);
  assert.equal(shouldClearBackendOnStorageChange('shared-folder'), false);
  assert.equal(shouldClearBackendOnStorageChange('firebase'), true);
  assert.equal(shouldClearBackendOnStorageChange(null), true);
});
