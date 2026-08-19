import { BackendKind } from './TrackerBackend';

export function shouldRunFirebaseBackendLifecycle(
  storageKind: BackendKind | null,
  runtimeReady: boolean,
): boolean {
  return storageKind === 'firebase' && runtimeReady;
}

export function shouldClearBackendOnStorageChange(storageKind: BackendKind | null): boolean {
  return storageKind !== 'local-file' && storageKind !== 'shared-folder';
}
