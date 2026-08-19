import assert from 'node:assert/strict';
import test from 'node:test';
import { renderRendererStartupFailure } from '../src/rendererStartup';

test('renderer startup failures are rendered visibly into the bootstrap root', () => {
  const root = { innerHTML: '' };

  renderRendererStartupFailure(root, new Error('Synthetic renderer startup failure.'));

  assert.match(root.innerHTML, /Renderer startup failed/);
  assert.match(root.innerHTML, /Synthetic renderer startup failure/);
});
