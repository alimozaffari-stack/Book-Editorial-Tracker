import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorageModeChooser } from '../src/components/StorageModeChooser';
import { buildSharedProjectLockStateForPortableMode } from '../src/storage/sharedProjectLockState';
import { shouldClearBackendOnStorageChange } from '../src/storage/backendLifecycle';

test('storage chooser offers local and shared files without cloud account setup', () => {
  const html = renderToStaticMarkup(
    React.createElement(StorageModeChooser, {
      busy: false,
      message: '',
      error: null,
      onCreateLocalProject: async () => {},
      onOpenLocalProject: async () => {},
      onOpenSharedProject: async () => {},
    }),
  );
  assert.match(html, /Create project/);
  assert.match(html, /Open local project/);
  assert.match(html, /Open shared project file/);
  assert.doesNotMatch(html, /Firebase|Sign in|Google Drive/i);
  assert.equal((html.match(/<button[^>]*disabled/g) ?? []).length, 3,
    'Opening requires an editor label and creation also requires a project name');
});

test('storage chooser uses one labeled editor name for all project actions', () => {
  const html = renderToStaticMarkup(
    React.createElement(StorageModeChooser, {
      busy: false,
      message: '',
      error: null,
      onCreateLocalProject: async () => {},
      onOpenLocalProject: async () => {},
      onOpenSharedProject: async () => {},
    }),
  );

  assert.equal((html.match(/id="project-editor-name"/g) ?? []).length, 1);
  assert.match(html, /<label for="project-editor-name"[^>]*>Your name for the edit history<\/label>/);
  assert.match(html, /aria-describedby="project-editor-help"/);
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

test('local and shared modes preserve the backend when storage-kind cleanup runs', () => {
  assert.equal(shouldClearBackendOnStorageChange('local-file'), false);
  assert.equal(shouldClearBackendOnStorageChange('shared-folder'), false);
  assert.equal(shouldClearBackendOnStorageChange(null), true);
});
