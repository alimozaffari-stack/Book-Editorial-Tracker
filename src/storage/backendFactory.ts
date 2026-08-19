import { BackendKind, TrackerBackend } from './TrackerBackend';
import { FirebaseTrackerBackend } from './FirebaseTrackerBackend';
import { Firestore } from 'firebase/firestore';
import { LocalFileTrackerBackend, LocalFileTrackerBackendOptions } from './LocalFileTrackerBackend';
import { SharedFolderTrackerBackend, SharedFolderTrackerBackendOptions } from './SharedFolderTrackerBackend';

export interface BackendFactoryOptions {
  db?: Firestore;
  localFile?: LocalFileTrackerBackendOptions;
  sharedFile?: SharedFolderTrackerBackendOptions;
}

export function createBackend(kind: BackendKind = 'firebase', options: BackendFactoryOptions = {}): TrackerBackend {
  switch (kind) {
    case 'firebase':
      return new FirebaseTrackerBackend({ db: options.db });
    case 'local-file':
      if (!options.localFile) throw new Error('Local project file options are required.');
      return new LocalFileTrackerBackend(options.localFile);
    case 'shared-folder':
      if (!options.sharedFile) throw new Error('Shared-folder project file options are required.');
      return new SharedFolderTrackerBackend(options.sharedFile);
  }
}
