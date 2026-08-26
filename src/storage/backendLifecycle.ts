import { BackendKind } from './TrackerBackend';

export function shouldClearBackendOnStorageChange(storageKind: BackendKind | null): boolean {
  return storageKind !== 'local-file' && storageKind !== 'shared-folder';
}
