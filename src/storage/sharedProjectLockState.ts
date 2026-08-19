import { BackendKind } from './TrackerBackend';

export type SharedProjectLockState = {
  canEdit: boolean;
  fileToken: string;
  lock: { editorLabel: string; acquiredAt: string; heartbeatAt: string } | null;
};

export function buildSharedProjectLockStateForPortableMode(
  mode: Extract<BackendKind, 'local-file' | 'shared-folder'>,
  fileToken: string,
  canEdit: boolean,
  sharedLock: SharedProjectLockState['lock'] = null,
): SharedProjectLockState {
  if (mode !== 'shared-folder') {
    return { canEdit: false, fileToken: '', lock: null };
  }
  return { canEdit, fileToken, lock: sharedLock };
}
