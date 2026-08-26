import { BackendKind, TrackerBackend } from './TrackerBackend';
import { LocalFileTrackerBackend, LocalFileTrackerBackendOptions } from './LocalFileTrackerBackend';
import { SharedFolderTrackerBackend, SharedFolderTrackerBackendOptions } from './SharedFolderTrackerBackend';

export interface BackendFactoryOptions {
  localFile?: LocalFileTrackerBackendOptions;
  sharedFile?: SharedFolderTrackerBackendOptions;
}

export function createBackend(kind: BackendKind = 'local-file', options: BackendFactoryOptions = {}): TrackerBackend {
  switch (kind) {
    case 'local-file':
      if (!options.localFile) throw new Error('Local project file options are required.');
      return new LocalFileTrackerBackend(options.localFile);
    case 'shared-folder':
      if (!options.sharedFile) throw new Error('Shared-folder project file options are required.');
      return new SharedFolderTrackerBackend(options.sharedFile);
  }
}
