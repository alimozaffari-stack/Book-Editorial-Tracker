type CompileManuscriptFormat = 'md' | 'docx' | 'zip';

interface CompileManuscriptSource {
  stage: import('./types').ChapterStage;
  roundNumber?: number;
  effectiveOn: string;
  sourceFileName?: string;
  sourceRelativePath?: string;
  sourceSha256?: string;
}

interface CompileManuscriptChapter {
  id: string;
  title: string;
  contributorName?: string;
  contributorEmail?: string;
  institutionalAffiliation?: string;
  abstractText?: string;
  source: CompileManuscriptSource;
}

interface CompileManuscriptRequest {
  format: CompileManuscriptFormat;
  projectName: string;
  includeAbstracts: boolean;
  includeMetadata: boolean;
  template?: { fileName: string; bytes: Uint8Array };
  legacyFolderToken?: string;
  chapters: CompileManuscriptChapter[];
}

interface CompileManuscriptResult {
  cancelled: boolean;
  filePath?: string;
  includedChapters: number;
  unavailableSource?: { chapterId: string; source: CompileManuscriptSource };
  unavailableSources?: { chapterId: string; source: CompileManuscriptSource }[];
}

type LocateCompilerSourceResult =
  | { status: 'located'; legacyFolderToken?: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

interface RecentProject { token: string; name: string; folder?: string; mode: 'local' | 'shared' }

interface Window {
  editorialTracker?: {
    saveLocalExport: (filename: string, contents: string) => Promise<{ cancelled: boolean; filePath?: string }>;
    compileManuscript: (request: CompileManuscriptRequest) => Promise<CompileManuscriptResult>;
    locateCompilerSource: (request: Pick<CompileManuscriptSource, 'sourceRelativePath' | 'sourceSha256'>) => Promise<LocateCompilerSourceResult>;
    openFolderForFile: (filePath: string) => Promise<void>;
    selectDocx: () => Promise<SelectedDocx | null>;
    scanProjectFolder: () => Promise<ProjectFolderScan | null>;
    resumeProjectFolder: () => Promise<ProjectFolderScan | null>;
    inspectProjectDocx: (relativePath: string) => Promise<SelectedDocx>;
    forgetProjectFolder: () => Promise<void>;
    openStageSource: (request: StageSourceRequest) => Promise<StageSourceResult>;
    listRecentProjects: () => Promise<RecentProject[]>;
    openRecentProject: (token: string, mode: RecentProject['mode']) => Promise<{ cancelled: boolean; contents: string; fileToken: string }>;
    checkCompilerSources: (request: CompileManuscriptRequest) => Promise<CompileManuscriptResult>;
    chooseProjectFile: () => Promise<{ cancelled: boolean; contents?: string; fileToken?: string }>;
    chooseSharedProjectFile: () => Promise<{ cancelled: boolean; contents?: string; fileToken?: string }>;
    saveProjectFile: (fileToken: string, expectedHash: string, contents: string) => Promise<{ ok: boolean; hash?: string; message: string }>;
    saveProjectFileAs: (contents: string) => Promise<{ cancelled: boolean; fileToken?: string; hash?: string }>;
    saveSharedProjectFile: (fileToken: string, instanceId: string, expectedHash: string, expectedProjectRevision: number, contents: string) => Promise<{ ok: boolean; hash?: string; message: string }>;
    saveSharedProjectFileAs: (contents: string) => Promise<{ cancelled: boolean; fileToken?: string; hash?: string }>;
    acquireSharedProjectLock: (fileToken: string, editorLabel: string, instanceId: string) => Promise<{ ok: boolean; message?: string; lock?: SharedProjectLock }>;
    heartbeatSharedProjectLock: (fileToken: string, instanceId: string) => Promise<{ ok: boolean; message?: string; lock?: SharedProjectLock }>;
    verifySharedProjectLock: (fileToken: string, instanceId: string) => Promise<{ ok: boolean; message?: string; lock?: SharedProjectLock }>;
    releaseSharedProjectLock: (fileToken: string, instanceId: string) => Promise<{ ok: boolean; message?: string }>;
    readSharedProjectLock: (fileToken: string) => Promise<{ ok: boolean; message?: string; lock?: SharedProjectLock }>;
    forceUnlockSharedProjectLock: (fileToken: string, instanceId: string, confirmationText: string) => Promise<{ ok: boolean; message?: string; lock?: SharedProjectLock }>;
    sharedProjectLockHeartbeatMs: number;
  };
}

interface StageSourceRequest {
  sourceRelativePath?: string;
  sourceSha256?: string;
  action: 'open' | 'reveal';
}

interface StageSourceResult {
  ok: boolean;
  message: string;
}

interface ProjectFolderFile { relativePath: string; extension: string; sizeBytes: number; filesystemModifiedAt: string; }
interface ProjectFolderScan { displayLabel: string; chapterFolders: Array<{ name: string; stageFolders: Array<{ name: string; files: ProjectFolderFile[] }> }>; }

interface SelectedDocx {
  fileName: string;
  sizeBytes: number;
  sha256: string;
  filesystemCreatedAt?: string;
  filesystemModifiedAt: string;
  bytes: Uint8Array;
}

interface UserFirebaseProfile {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

interface SharedProjectLock {
  instanceId: string;
  editorLabel: string;
  acquiredAt: string;
  heartbeatAt: string;
}
