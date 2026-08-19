import React, { useRef, useState, useEffect } from 'react';
import { Chapter, ChapterStageRecord, ProjectState, TeamRole } from './types';
import { Dashboard } from './components/Dashboard';
import { ChapterList } from './components/ChapterList';
import { ChapterDetail } from './components/ChapterDetail';
import { TasksView } from './components/TasksView';
import { BiosView } from './components/BiosView';
import { AbstractsView } from './components/AbstractsView';
import { UsersView } from './components/UsersView';
import { ActivityView } from './components/ActivityView';
import { FirebaseSetupView, buildBackToStorageChoicesState } from './components/FirebaseSetupView';
import { StorageModeChooser } from './components/StorageModeChooser';
import { LayoutDashboard, List, CheckSquare, Users, FileText, LogOut, Shield, ClipboardList, CircleHelp } from 'lucide-react';
import editorialMark from './assets/editorial-review-tracker-mark.png';
import {
  clearFirebaseRuntime,
  getFirebaseAuth,
  getFirebaseDb,
  initializeAuthPersistence,
  loginWithGoogle,
  loginWithPassword,
  logout,
  requestPasswordReset,
  selectTeamFirebaseRuntime,
  setFirebaseRuntime,
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BackupIntakeView } from './components/BackupIntakeView';
import { BackendKind, TrackerBackend } from './storage/TrackerBackend';
import { createBackend } from './storage/backendFactory';
import { shouldClearBackendOnStorageChange, shouldRunFirebaseBackendLifecycle } from './storage/backendLifecycle';
import { authErrorMessage } from './utils/authMessage';
import { buildProjectBackup, chaptersToCsv, timestampedBackupFilename } from './utils/backupExport';
import { rolePolicy } from './domain/rolePolicy';
import { ProjectImportPlan, ProjectImportResult } from './domain/projectImportPlan';
import { ActivityViewEvent } from './domain/activityView';
import { effectiveTrackerRole } from './domain/roleAccess';
import { ProjectHelpView } from './components/ProjectHelpView';
import { ReviewedResetInput } from './utils/projectWrites';
import { parseUserFirebaseProfile, UserFirebaseProfile } from './domain/firebaseProfile';
import { hashPortableProjectContents, parsePortableProjectFile, PortableProjectFile, preparePortableProjectOpen, serializePortableProjectFile } from './storage/projectFileFormat';
import { SharedFolderTrackerBackend } from './storage/SharedFolderTrackerBackend';
import { buildSharedProjectLockStateForPortableMode } from './storage/sharedProjectLockState';

type ActiveTab = 'dashboard' | 'project' | 'chapters' | 'tasks' | 'bios' | 'abstracts' | 'users' | 'activity' | 'backups';
type ProjectSetupFocus = 'import-csv-json' | 'restore-json' | 'scan-folder' | null;

function AppContent() {
  const SHARED_OWNERSHIP_LOST_MESSAGE = 'Shared editing access was lost. No further shared saves are permitted until this file is reopened and a lock is acquired.';
  const isPublicBuild = import.meta.env.VITE_APP_VARIANT === 'public';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [currentRole, setCurrentRole] = useState<TeamRole | null | undefined>(undefined);
  const [listenerAttempt, setListenerAttempt] = useState(0);
  const [accessFailed, setAccessFailed] = useState(false);
  const [accessAttempt, setAccessAttempt] = useState(0);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [authInitializationError, setAuthInitializationError] = useState(false);
  const [project, setProject] = useState<ProjectState | null>(null);
  const [projectSetupFocus, setProjectSetupFocus] = useState<ProjectSetupFocus>(null);
  const [jsonBackupExportedAt, setJsonBackupExportedAt] = useState('');
  const [activity, setActivity] = useState<ActivityViewEvent[]>([]);
  const [backend, setBackend] = useState<TrackerBackend | null>(null);
  const [storageKind, setStorageKind] = useState<BackendKind | null>(isPublicBuild ? null : 'firebase');
  const [localEditorLabel, setLocalEditorLabel] = useState('');
  const [projectRevision, setProjectRevision] = useState(0);
  const [runtimeReady, setRuntimeReady] = useState(!isPublicBuild);
  const [isRuntimeConfiguring, setIsRuntimeConfiguring] = useState(isPublicBuild);
  const [setupMessage, setSetupMessage] = useState('');
  const [profileInputError, setProfileInputError] = useState<string | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [localSaveNeedsCopy, setLocalSaveNeedsCopy] = useState(false);
  const [sharedProjectLock, setSharedProjectLock] = useState<{
    editorLabel: string;
    acquiredAt: string;
    heartbeatAt: string;
  } | null>(null);
  const [sharedProjectCanEdit, setSharedProjectCanEdit] = useState(false);
  const [sharedProjectFileToken, setSharedProjectFileToken] = useState('');
  const [sharedForceUnlockText, setSharedForceUnlockText] = useState('');
  const sharedLockHeartbeatMs = window.editorialTracker?.sharedProjectLockHeartbeatMs ?? 60 * 1000;
  const sharedHeartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sharedInstanceId = useRef<string>(
    (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `shared-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  );

  const isLocalMode = storageKind === 'local-file';
  const isSharedMode = storageKind === 'shared-folder';
  const isFileMode = isLocalMode || isSharedMode;
  const actorLabel = isFileMode ? localEditorLabel : user?.email || '';
  const FILE_STALE_SAVE_MESSAGE = isSharedMode
    ? 'Nothing was saved. The shared project file changed on disk or revision. Use Save As conflict copy to keep your changes.'
    : 'Nothing was saved. The local project file changed on disk. Use Save As to keep your changes.';

  const isFileProjectStaleSave = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    return /changed on disk/i.test(message) || /revision/i.test(message) || /stale/i.test(message);
  };

  const markFileSaveConflict = (error: unknown) => {
    if (!isFileMode || !isFileProjectStaleSave(error)) return false;
    setRuntimeError(FILE_STALE_SAVE_MESSAGE);
    setLocalSaveNeedsCopy(true);
    return true;
  };

  const buildCurrentLocalProjectFile = async (): Promise<string> => {
    if (!project) {
      throw new Error('A local project must be loaded before saving.');
    }
    const contents = serializePortableProjectFile({
      format: 'book-editorial-tracker-project',
      version: 1,
      projectRevision,
      savedAt: new Date().toISOString(),
      savedBy: localEditorLabel,
      project,
      chapters,
      activity,
    });
    await hashPortableProjectContents(contents);
    return contents;
  };

  const initializeFirebaseRuntime = async () => {
    setIsRuntimeConfiguring(true);
    setRuntimeError(null);

    if (!isPublicBuild) {
      try {
        const viteEnv = import.meta as unknown as { env: { VITE_TEAM_FIREBASE_PROFILE?: unknown; VITE_APP_VARIANT?: string } };
        const ownerFirebaseProfile = parseUserFirebaseProfile(viteEnv.env.VITE_TEAM_FIREBASE_PROFILE);
        selectTeamFirebaseRuntime(ownerFirebaseProfile);
        setRuntimeReady(true);
        setRuntimeError(null);
      } catch (error) {
        setRuntimeError(error instanceof Error ? error.message : 'Firebase runtime failed to initialize.');
        setRuntimeReady(false);
      } finally {
        setIsRuntimeConfiguring(false);
      }
      return;
    }

    try {
      const result = await window.editorialTracker?.loadFirebaseProfile?.();
      if (result?.profile) {
        const profile = parseUserFirebaseProfile(result.profile);
        setFirebaseRuntime(profile);
        setRuntimeReady(true);
      } else {
        setRuntimeReady(false);
      }
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Stored Firebase profile could not be read.');
      setRuntimeReady(false);
      if (window.editorialTracker?.clearFirebaseProfile) {
        await window.editorialTracker.clearFirebaseProfile();
      }
    } finally {
      setIsRuntimeConfiguring(false);
    }
  };

  useEffect(() => {
    if (storageKind === 'firebase') void initializeFirebaseRuntime();
    return () => {
      clearFirebaseRuntime();
      if (shouldClearBackendOnStorageChange(storageKind)) {
        setBackend(null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKind]);

  useEffect(() => {
    if (!shouldRunFirebaseBackendLifecycle(storageKind, runtimeReady)) return;
    try {
      const configuredBackend = createBackend('firebase', { db: getFirebaseDb() });
      setBackend(configuredBackend);
      return () => {
        void configuredBackend.close();
      };
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Firebase backend could not be created.');
      setBackend(null);
      return;
    }
  }, [runtimeReady, storageKind]);

  useEffect(() => {
    if (isFileMode) {
      setIsAuthReady(true);
      setAuthInitializationError(false);
      return;
    }
    if (!runtimeReady) {
      setIsAuthReady(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const init = async () => {
      setIsAuthReady(false);
      setAuthInitializationError(false);
      try {
        await initializeAuthPersistence();
      } catch {
        if (!cancelled) {
          setAuthInitializationError(true);
          setIsAuthReady(true);
        }
        return;
      }
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
      });
    };

    init();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [authAttempt, runtimeReady, isFileMode]);

  useEffect(() => {
    if (isFileMode) {
      setCurrentRole('admin');
      setAccessFailed(false);
      return;
    }
    if (!isAuthReady || !user?.email || !runtimeReady || !backend) {
      setCurrentRole(undefined);
      return;
    }

    let userRole: unknown;
    let roster: unknown;

    const resolve = () => setCurrentRole(effectiveTrackerRole(userRole, user.email!, roster as { members?: unknown } | undefined));

    const db = getFirebaseDb();
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.email), (snapshot) => {
      setAccessFailed(false);
      userRole = snapshot.exists() ? snapshot.data().role : undefined;
      if (roster !== undefined) resolve();
    }, () => {
      setAccessFailed(true);
      setCurrentRole(undefined);
    });

    const unsubscribeRoster = onSnapshot(doc(db, 'teamState', 'roster'), (snapshot) => {
      roster = snapshot.exists() ? snapshot.data() : null;
      resolve();
    }, (error) => {
      if ((error as { code?: string }).code === 'permission-denied') {
        setCurrentRole(null);
        return;
      }
      setAccessFailed(true);
      setCurrentRole(undefined);
    });

    return () => {
      unsubscribeUser();
      unsubscribeRoster();
    };
  }, [isAuthReady, user, runtimeReady, accessAttempt, backend, isFileMode]);

  useEffect(() => {
    const canReadSelectedBackend = isFileMode || Boolean(user && rolePolicy.canRead(currentRole ?? undefined));
    if (!isAuthReady || !backend || !canReadSelectedBackend) {
      setProject(null);
      setChapters([]);
      setActivity([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = backend.subscribe((snapshot) => {
      setProject(snapshot.project);
      setChapters(snapshot.chapters);
      setActivity(snapshot.activity);
      setProjectRevision(snapshot.revision);
      if (isFileMode) setLocalSaveNeedsCopy(false);
      if (isFileMode) setRuntimeError(null);
      setLastRefresh(new Date().toLocaleTimeString());
      setRefreshFailed(false);
      setIsLoading(false);
    }, () => {
      setProject(null);
      setChapters([]);
      setActivity([]);
      setRefreshFailed(true);
    });

    return () => unsubscribe();
  }, [isAuthReady, user, currentRole, listenerAttempt, backend, isFileMode]);

  useEffect(() => {
    return () => {
      void releaseSharedProjectLock();
      clearSharedHeartbeat();
      void backend?.close();
    };
  }, [backend]);

  const fileModeCanEdit = isSharedMode ? sharedProjectCanEdit : true;
  const canEdit = isFileMode ? fileModeCanEdit && !!actorLabel : rolePolicy.canEdit(currentRole ?? undefined);
  const canDelete = canEdit;

  const handleSaveChapter = async (updatedChapter: Chapter) => {
    if (!backend) return;
    const path = `chapters/${updatedChapter.id}`;
    try {
      const expectedRevision = updatedChapter.dataRevision ?? 0;
      const result = await backend.saveChapter(updatedChapter, expectedRevision, actorLabel);
      if (result.kind === 'conflict') throw { kind: 'conflict', current: result.current };
      if (result.kind === 'unchanged') return { chapter: result.current, unchanged: true };
      if (result.kind !== 'ok') throw { kind: 'conflict', current: result.current };
      return { chapter: result.new, unchanged: false };
    } catch (error) {
      markFileSaveConflict(error);
      if ((error as any)?.kind === 'conflict') {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  };

  const handleAppendStageRecord = async (chapterId: string, record: ChapterStageRecord, expectedRevision: number) => {
    if (!backend) return;
    try {
      const result = await backend.appendStageRecord(chapterId, record, expectedRevision, actorLabel);
      if (result.kind === 'conflict') throw { kind: 'conflict', current: result.current };
      if (result.kind === 'duplicate') throw { kind: 'duplicate', current: result.current };
      if (result.kind === 'stage-conflict') throw { kind: 'stage-conflict', current: result.current, conflictingRecords: result.conflictingRecords };
      if (result.kind === 'unchanged') return result.current;
      return result.new;
    } catch (error) {
      markFileSaveConflict(error);
      throw error;
    }
  };

  const handleVoidStageRecord = async (chapterId: string, recordId: string, reason: string, expectedRevision: number) => {
    if (!backend) return;
    try {
      const result = await backend.voidStageRecord(chapterId, recordId, reason, expectedRevision, actorLabel);
      if (result.kind !== 'ok') throw { kind: result.kind, current: result.current };
      return result.new;
    } catch (error) {
      markFileSaveConflict(error);
      throw error;
    }
  };

  const handleBatchUpdate = async (ids: string[], field: keyof Chapter, value: string) => {
    if (!backend) return;
    try {
      await backend.batchUpdateChapterFields(ids, field, value, actorLabel);
    } catch (error) {
      markFileSaveConflict(error);
      handleFirestoreError(error, OperationType.UPDATE, 'chapters');
      throw error;
    }
  };

  const handleCreateChapters = async (newChapters: Chapter[], source: 'manual-entry' | 'csv-import' | 'backup-import' | 'scan-inventory') => {
    if (!backend) throw new Error('Tracker backend is not ready.');
    try {
      if (source === 'scan-inventory') {
        return await backend.createChaptersFromInventory(newChapters, actorLabel);
      }
      return await backend.createChapters(newChapters, actorLabel, source);
    } catch (error) {
      markFileSaveConflict(error);
      handleFirestoreError(error, OperationType.WRITE, 'chapters');
      throw error;
    }
  };

  const handleDeleteChapter = async (selectedChapters: Chapter[]) => {
    if (!backend) return;
    try {
      const result = await backend.deleteChapters(selectedChapters, actorLabel);
      if (result.kind === 'conflict') throw { kind: 'conflict', current: result.current };
    } catch (error) {
      markFileSaveConflict(error);
      handleFirestoreError(error, OperationType.DELETE, 'chapters');
      throw error;
    }
  };

  const handleApplyProject = async (plan: ProjectImportPlan): Promise<ProjectImportResult> => {
    if (!backend) throw new Error('Tracker backend is not ready.');
    return backend.applyProjectImport(plan, actorLabel);
  };

  const handleSetProject = async (name: string) => {
    if (!backend) throw new Error('Tracker backend is not ready.');
    try {
      return await backend.createInitialProject(name, actorLabel);
    } catch (error) {
      markFileSaveConflict(error);
      throw error;
    }
  };

  const saveLocalExport = async (filename: string, contents: string, mimeType: string) => {
    if (window.editorialTracker) {
      return window.editorialTracker.saveLocalExport(filename, contents);
    }
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return { cancelled: false };
  };

  const handleExportBackup = async (format: 'json' | 'csv') => {
    const exportedAt = new Date().toISOString();
    const filename = timestampedBackupFilename(format, new Date(exportedAt));
    let contents: string;
    let mimeType: string;

    if (format === 'json') {
      const isFirebaseBackend = backend?.kind === 'firebase';
      const [users, auditEvents] = isFirebaseBackend
        ? await (async () => {
          const db = getFirebaseDb();
          const [usersSnapshot, auditEventsSnapshot] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'auditEvents')),
          ]);
          return [
            usersSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })),
            auditEventsSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })),
          ];
        })()
        : [[], activity];
      const backup = buildProjectBackup({
        chapters,
        users,
        auditEvents,
        exportedBy: actorLabel,
        exportedAt,
        ...(project ? { project } : {}),
      } as any);
      contents = `${JSON.stringify(backup, null, 2)}\n`;
      mimeType = 'application/json;charset=utf-8';
    } else {
      contents = chaptersToCsv(chapters as any);
      mimeType = 'text/csv;charset=utf-8';
    }

    const result = await saveLocalExport(filename, contents, mimeType);
    if (result.cancelled) return 'Export cancelled.';
    if (format === 'json') setJsonBackupExportedAt(exportedAt);
    return result.filePath ? `Saved to ${result.filePath}` : 'Local export saved.';
  };

  const stageCount = chapters.reduce((total, chapter) => total + ((chapter.submissions?.length ?? 0)), 0);

  const handleStartNewProject = async (nextProjectName: string) => {
    if (!project || !backend) throw new Error('No current project was found.');
    const input: ReviewedResetInput = {
      previousProject: project,
      nextProjectName,
      reviewedChapters: chapters.map(chapter => ({ id: chapter.id, dataRevision: chapter.dataRevision ?? 0 })),
      backupExportedAt: jsonBackupExportedAt,
    };
    try {
      return await backend.startNewProject(input, actorLabel);
    } catch (error) {
      markFileSaveConflict(error);
      throw error;
    }
  };

  const handleProjectChoice = (choice: ProjectSetupFocus) => {
    setActiveTab('backups');
    setProjectSetupFocus(choice);
  };

  const handleRuntimeProfileSubmit = async (profile: UserFirebaseProfile) => {
    setProfileInputError(null);
    setSetupMessage('');
    try {
      if (isPublicBuild) {
        const parsed = parseUserFirebaseProfile(profile);
        const safeProfile = parseUserFirebaseProfile(parsed);
        setFirebaseRuntime(safeProfile);
        if (window.editorialTracker?.saveFirebaseProfile) {
          await window.editorialTracker.saveFirebaseProfile(safeProfile);
        }
        setRuntimeReady(true);
      }
    } catch (error) {
      setProfileInputError(error instanceof Error ? error.message : 'The Firebase profile was not accepted.');
    }
  };

  const clearRuntimeProfile = async () => {
    if (!window.editorialTracker?.clearFirebaseProfile) return;
    await window.editorialTracker.clearFirebaseProfile();
    clearFirebaseRuntime();
    setRuntimeReady(false);
    setSetupMessage('Saved profile cleared.');
  };

  const localFileApi = {
    saveProjectFile: (fileToken: string, expectedHash: string, contents: string) => {
      if (!window.editorialTracker?.saveProjectFile) throw new Error('Local project file saving is unavailable.');
      return window.editorialTracker.saveProjectFile(fileToken, expectedHash, contents);
    },
    saveProjectFileAs: (contents: string) => {
      if (!window.editorialTracker?.saveProjectFileAs) throw new Error('Local project file saving is unavailable.');
      return window.editorialTracker.saveProjectFileAs(contents);
    },
  };

  const sharedFileApi = {
    verifySharedOwnership: (fileToken: string, instanceId: string) => {
      if (!window.editorialTracker?.verifySharedProjectLock) throw new Error('Shared project lock verification is unavailable.');
      return window.editorialTracker.verifySharedProjectLock(fileToken, instanceId);
    },
    saveSharedProjectFile: (fileToken: string, instanceId: string, expectedHash: string, expectedProjectRevision: number, contents: string) => {
      if (!window.editorialTracker?.saveSharedProjectFile) throw new Error('Shared project file saving is unavailable.');
      return window.editorialTracker.saveSharedProjectFile(fileToken, instanceId, expectedHash, expectedProjectRevision, contents);
    },
    saveSharedProjectFileAs: (contents: string) => {
      if (!window.editorialTracker?.saveSharedProjectFileAs) throw new Error('Shared project file saving is unavailable.');
      return window.editorialTracker.saveSharedProjectFileAs(contents);
    },
  };

  const markSharedOwnershipLost = (message = SHARED_OWNERSHIP_LOST_MESSAGE) => {
    clearSharedHeartbeat();
    setSharedProjectCanEdit(false);
    setLocalSaveNeedsCopy(false);
    setRuntimeError(message);
    if (backend instanceof SharedFolderTrackerBackend) {
      backend.setCanEdit(false, message);
    }
  };

  const clearSharedHeartbeat = () => {
    if (sharedHeartbeatTimer.current !== null) {
      clearInterval(sharedHeartbeatTimer.current);
      sharedHeartbeatTimer.current = null;
    }
  };

  const beginSharedHeartbeat = (fileToken: string) => {
    clearSharedHeartbeat();
    sharedHeartbeatTimer.current = setInterval(() => {
      void (async () => {
        const result = await window.editorialTracker?.heartbeatSharedProjectLock?.(fileToken, sharedInstanceId.current);
        if (!result?.ok) {
          markSharedOwnershipLost(result?.message || SHARED_OWNERSHIP_LOST_MESSAGE);
          return;
        }
        if (result.lock) setSharedProjectLock(result.lock);
      })();
    }, sharedLockHeartbeatMs);
  };

  const releaseSharedProjectLock = async () => {
    if (!isSharedMode || !sharedProjectFileToken || !sharedProjectCanEdit) return;
    if (!window.editorialTracker?.releaseSharedProjectLock) return;
    await window.editorialTracker.releaseSharedProjectLock(sharedProjectFileToken, sharedInstanceId.current);
  };

  const openPortableBackend = async (
    mode: 'local-file' | 'shared-folder',
    editorLabel: string,
    contents: string,
    fileToken: string,
    initialHash: string,
    canEdit = true,
    sharedLock?: { editorLabel: string; acquiredAt: string; heartbeatAt: string } | null,
  ) => {
    const parsed = parsePortableProjectFile(contents);
    const normalizedContents = serializePortableProjectFile(parsed);
    await releaseSharedProjectLock();
    clearSharedHeartbeat();
    const configuredBackend = mode === 'local-file'
      ? createBackend('local-file', {
        localFile: {
          fileToken,
          contents: normalizedContents,
          initialHash,
          editorLabel,
          fileApi: localFileApi,
        },
      })
      : createBackend('shared-folder', {
        sharedFile: {
          fileToken,
          contents: normalizedContents,
          initialHash,
          editorLabel,
          instanceId: sharedInstanceId.current,
          fileApi: sharedFileApi,
          canEdit,
          onOwnershipLost: (message) => markSharedOwnershipLost(message),
        },
      });
    setLocalEditorLabel(editorLabel);
    setBackend(configuredBackend);
    setStorageKind(mode);
    setRuntimeReady(true);
    setIsAuthReady(true);
    setCurrentRole('admin');
    setIsLoading(false);
    setProjectRevision(parsed.projectRevision);
    setLocalSaveNeedsCopy(false);
    const sharedState = buildSharedProjectLockStateForPortableMode(mode, fileToken, canEdit, sharedLock ?? null);
    setSharedProjectCanEdit(sharedState.canEdit);
    setSharedProjectFileToken(sharedState.fileToken);
    setSharedProjectLock(sharedState.lock);
    if (mode === 'shared-folder' && canEdit) {
      beginSharedHeartbeat(fileToken);
    }
    return configuredBackend;
  };

  const openLocalProject = async (editorLabel: string, contents: string, fileToken: string, initialHash: string) => {
    const backend = await openPortableBackend('local-file', editorLabel, contents, fileToken, initialHash);
    setSetupMessage('Local project file opened.');
    return backend;
  };

  const handleCreateLocalProject = async (editorLabel: string, projectName: string) => {
    setStorageBusy(true);
    setRuntimeError(null);
    setSetupMessage('');
    try {
      const timestamp = new Date().toISOString();
      const file: PortableProjectFile = {
        format: 'book-editorial-tracker-project',
        version: 1,
        projectRevision: 0,
        savedAt: timestamp,
        savedBy: editorLabel,
        project: { name: projectName.trim(), generationId: globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`, startedAt: timestamp, startedBy: editorLabel, updatedAt: timestamp },
        chapters: [],
        activity: [],
      };
      const contents = serializePortableProjectFile(file);
      const result = await window.editorialTracker?.saveProjectFileAs?.(contents);
      if (!result || result.cancelled) {
        setSetupMessage('Local project file creation cancelled.');
        return;
      }
      const backend = await openLocalProject(editorLabel, contents, result.fileToken!, result.hash!);
      await backend.createInitialProject(projectName, editorLabel);
      setSetupMessage('Local project file created.');
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Local project file could not be created.');
    } finally {
      setStorageBusy(false);
    }
  };

  const handleOpenLocalProject = async (editorLabel: string) => {
    setStorageBusy(true);
    setRuntimeError(null);
    setSetupMessage('');
    try {
      const result = await window.editorialTracker?.chooseProjectFile?.();
      if (!result || result.cancelled) {
        setSetupMessage('Open local project cancelled.');
        return;
      }
      if (!result.contents || !result.fileToken) throw new Error('The selected project file could not be opened.');
      const opened = await preparePortableProjectOpen(result.contents);
      await openLocalProject(editorLabel, result.contents, result.fileToken, opened.originalHash);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Local project file could not be opened.');
    } finally {
      setStorageBusy(false);
    }
  };

  const handleOpenSharedProject = async (editorLabel: string) => {
    setStorageBusy(true);
    setRuntimeError(null);
    setSetupMessage('');
    setSharedForceUnlockText('');
    setSharedProjectLock(null);
    try {
      const result = await window.editorialTracker?.chooseSharedProjectFile?.();
      if (!result || result.cancelled) {
        setSetupMessage('Open shared project cancelled.');
        return;
      }
      if (!result.contents || !result.fileToken) throw new Error('The selected project file could not be opened.');
      const opened = await preparePortableProjectOpen(result.contents);
      const lockResult = await window.editorialTracker.acquireSharedProjectLock?.(
        result.fileToken,
        editorLabel,
        sharedInstanceId.current,
      );
      if (!lockResult) throw new Error('Shared lock service is unavailable.');
      if (!lockResult.ok) {
        const fallback = await window.editorialTracker.readSharedProjectLock?.(result.fileToken);
        const sharedLock = fallback?.ok ? fallback.lock : null;
        if (sharedLock) {
          setSetupMessage('Shared project opened in read-only mode.');
        } else {
          setSetupMessage(lockResult.message);
        }
        await openPortableBackend('shared-folder', editorLabel, result.contents, result.fileToken, opened.originalHash, false, sharedLock);
        return;
      }
      await openPortableBackend('shared-folder', editorLabel, result.contents, result.fileToken, opened.originalHash, true, lockResult.lock ?? null);
      setSetupMessage('Shared project opened for editing.');
      return;
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Shared project file could not be opened.');
    } finally {
      setStorageBusy(false);
    }
  };

  const handleBackToStorageChoices = () => {
    const nextState = buildBackToStorageChoicesState({
      storageKind,
      runtimeReady,
      isRuntimeConfiguring,
      setupMessage,
      profileInputError,
      runtimeError,
    });
    setStorageKind(nextState.storageKind);
    setRuntimeReady(nextState.runtimeReady);
    setIsRuntimeConfiguring(nextState.isRuntimeConfiguring);
    setSetupMessage(nextState.setupMessage);
    setProfileInputError(nextState.profileInputError);
    setRuntimeError(nextState.runtimeError);
  };

  const handleSaveAsAfterLocalStaleSave = async () => {
    if (!backend || !isFileMode) return;
    setStorageBusy(true);
    setRuntimeError(null);
    setSetupMessage('');
    try {
      const contents = await buildCurrentLocalProjectFile();
      const result = backend.kind === 'shared-folder'
        ? await sharedFileApi.saveSharedProjectFileAs(contents)
        : await window.editorialTracker?.saveProjectFileAs?.(contents);
      if (!result || result.cancelled) {
        setSetupMessage('Save As was cancelled.');
        return;
      }
      if (!result.fileToken || !result.hash) throw new Error('The project conflict-copy could not be created.');
      if (backend.kind === 'local-file') {
        await openLocalProject(localEditorLabel, contents, result.fileToken, result.hash);
        setSetupMessage('Created a local conflict-copy and switched to the copied file.');
      } else if (backend.kind === 'shared-folder') {
        const lockResult = await window.editorialTracker?.acquireSharedProjectLock?.(
          result.fileToken,
          localEditorLabel,
          sharedInstanceId.current,
        );
        if (!lockResult?.ok) {
          throw new Error(lockResult?.message || 'The shared conflict-copy could not acquire an editor lock.');
        }
        await openPortableBackend('shared-folder', localEditorLabel, contents, result.fileToken, result.hash, true, lockResult.lock ?? null);
        setSetupMessage('Created a shared conflict-copy and switched to the copied file.');
      }
      setLocalSaveNeedsCopy(false);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'The project conflict-copy could not be created.');
    } finally {
      setStorageBusy(false);
    }
  };

  const handleForceUnlockSharedProject = async () => {
    if (!sharedProjectFileToken || !window.editorialTracker?.forceUnlockSharedProjectLock) return;
    if (sharedForceUnlockText !== 'FORCE UNLOCK') {
      setRuntimeError('Type FORCE UNLOCK to remove the shared lock.');
      return;
    }
    setStorageBusy(true);
    setRuntimeError(null);
    setSetupMessage('');
    try {
      const result = await window.editorialTracker.forceUnlockSharedProjectLock(
        sharedProjectFileToken,
        sharedInstanceId.current,
        sharedForceUnlockText,
      );
      if (!result.ok) throw new Error(result.message);
      setSharedProjectLock(null);
      setSetupMessage('The shared lock was removed. Reopen this file to acquire a new editor lock.');
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'The shared lock could not be removed.');
    } finally {
      setStorageBusy(false);
    }
  };

  if (isPublicBuild && !storageKind) return (
    <StorageModeChooser
      isPublicBuild={isPublicBuild}
      busy={storageBusy}
      message={setupMessage}
      error={runtimeError}
      onChooseFirebase={() => { setStorageKind('firebase'); setRuntimeReady(false); setIsRuntimeConfiguring(true); }}
      onCreateLocalProject={handleCreateLocalProject}
      onOpenLocalProject={handleOpenLocalProject}
      onOpenSharedProject={handleOpenSharedProject}
    />
  );
  if (storageKind === 'firebase' && isPublicBuild && isRuntimeConfiguring) return <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50">Loading setup...</div>;
  if (storageKind === 'firebase' && runtimeError && isPublicBuild && !runtimeReady) return <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50"><div className="max-w-md rounded-xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold">Firebase setup failed</h1><p className="mt-2 text-sm text-gray-600">{runtimeError}</p><button onClick={() => void initializeFirebaseRuntime()} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-white">Try again</button></div></div>;
  if (storageKind === 'firebase' && isPublicBuild && !runtimeReady) return (
    <FirebaseSetupView
      onSubmit={handleRuntimeProfileSubmit}
      onClear={clearRuntimeProfile}
      onBack={handleBackToStorageChoices}
      error={profileInputError}
    />
  );

  if (!isAuthReady) {
    return <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  if (authInitializationError) {
    return <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50"><div className="max-w-md rounded-xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold">Sign-in storage could not be prepared</h1><p className="mt-2 text-sm text-gray-600">The tracker did not start sign-in because this device could not enable persistent authentication. Nothing was changed.</p><button onClick={() => setAuthAttempt(value => value + 1)} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-white">Try again</button></div></div>;
  }

  if (!user && !isFileMode) {
    return (
      <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <img src={editorialMark} alt="Book Editorial Tracker" className="w-12 h-12 mx-auto mb-4 rounded-lg" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Book Editorial Tracker</h1>
          <p className="text-gray-600 mb-6">Please sign in to access the tracker.</p>
          <form className="space-y-3" onSubmit={async (event) => {
            event.preventDefault();
            setLoginError(null);
            setPasswordResetMessage(null);
            try {
              await loginWithPassword(email, password);
            } catch (error) {
              setLoginError(authErrorMessage(error));
            }
          }}>
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" required className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" required className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
            <button type="submit" className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">Sign in</button>
          </form>
          <button
            type="button"
            onClick={async () => {
              setLoginError(null);
              setPasswordResetMessage(null);
              try {
                await requestPasswordReset(email);
                setPasswordResetMessage('Password-reset email sent. Check your inbox and spam folder.');
              } catch (error) {
                setLoginError(authErrorMessage(error));
              }
            }}
            className="mt-3 text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Forgot password?
          </button>
          {passwordResetMessage && <p className="mt-2 text-sm text-emerald-700">{passwordResetMessage}</p>}
          <button
            onClick={() => loginWithGoogle().catch(error => setLoginError(authErrorMessage(error)))}
            className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Sign in with Google (optional)
          </button>
        </div>
      </div>
    );
  }

  if (accessFailed) return <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50"><div className="max-w-md rounded-xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold">Tracker access could not be checked</h1><p className="mt-2 text-sm text-gray-600">Nothing was changed. Check your connection, then try again.</p><div className="mt-5 flex justify-center gap-3"><button onClick={() => setAccessAttempt(value => value + 1)} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Try again</button><button onClick={logout} className="rounded-lg border px-4 py-2">Sign in again</button></div></div></div>;
  if (currentRole === undefined) return <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50">Checking tracker access...</div>;
  if (currentRole === null) return <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50"><div className="max-w-md rounded-xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold">Tracker access has not been set up</h1><p className="mt-2 text-sm text-gray-600">Ask an administrator to add your already-provisioned email to Manage Team, then sign in again.</p><button onClick={logout} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-white">Sign in again</button></div></div>;

  return (
    <div className="min-h-screen pt-8 bg-gray-50 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-100">
          <img src={editorialMark} alt="Book Editorial Tracker" className="w-10 h-10 rounded-lg" />
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Book Editorial<br/>Tracker</h1>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <button
            onClick={() => setActiveTab('project')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'project'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <CircleHelp className="w-5 h-5" />
            <span>Project & Help</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('chapters')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'chapters'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <List className="w-5 h-5" />
            <span>Chapters</span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'tasks'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            <span>Tasks</span>
          </button>
          <button
            onClick={() => setActiveTab('bios')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'bios'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Bios</span>
          </button>
          <button
            onClick={() => setActiveTab('abstracts')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'abstracts'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Abstracts</span>
          </button>
          {backend?.kind === 'firebase' && (
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Manage Team</span>
            </button>
          )}
          <button onClick={() => setActiveTab('activity')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'activity' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><ClipboardList className="w-5 h-5" /><span>Activity</span></button>
          <button onClick={() => setActiveTab('backups')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'backups' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><FileText className="w-5 h-5" /><span>Backups & intake</span></button>
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-2">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
          <div className="pt-1 text-center text-xs text-gray-400">Version {appVersion}</div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="px-6 pt-3 text-xs text-gray-500" role="status">{refreshFailed ? <span>Data could not refresh - <button className="font-medium text-indigo-700 underline" onClick={() => { setIsLoading(true); setListenerAttempt(value => value + 1); }}>Try again</button></span> : lastRefresh ? `Last refreshed ${lastRefresh}` : 'Loading live data...'}</div>
        {isFileMode && localSaveNeedsCopy && (
          <div className="px-6 pt-3">
            <p className="text-sm text-red-700">{FILE_STALE_SAVE_MESSAGE}</p>
            <button
              onClick={() => void handleSaveAsAfterLocalStaleSave()}
              disabled={storageBusy}
              className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Save As conflict copy
            </button>
          </div>
        )}
        {isSharedMode && !sharedProjectCanEdit && sharedProjectLock && (
          <div className="px-6 pt-3">
            <p className="text-sm text-amber-800">Current shared lock owner: {sharedProjectLock.editorLabel} (acquired {new Date(sharedProjectLock.acquiredAt).toLocaleString()})</p>
            <p className="mt-2 text-xs text-amber-900">This editor mode is read-only. Use FORCE UNLOCK only for confirmed abandoned locks.</p>
            <label className="mt-2 block text-xs text-amber-900">
              Type FORCE UNLOCK
              <input
                className="mt-1 block w-full rounded border border-amber-300 p-2 text-xs"
                value={sharedForceUnlockText}
                onChange={event => setSharedForceUnlockText(event.target.value)}
              />
            </label>
            <button
              onClick={() => void handleForceUnlockSharedProject()}
              disabled={storageBusy}
              className="mt-2 rounded-lg border border-amber-700 bg-white px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
            >
              Force unlock shared project
            </button>
          </div>
        )}
        {runtimeError && <div className="px-6 pt-2 text-xs text-red-700">{runtimeError}</div>}
        {setupMessage && <div className="px-6 pt-2 text-xs text-emerald-700">{setupMessage}</div>}
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">Loading data...</div>
        ) : (
          <>
            {activeTab === 'project' && <ProjectHelpView
              project={project}
              userRole={currentRole}
              chapterCount={chapters.length}
              stageRecordCount={stageCount}
              jsonBackupExportedAt={jsonBackupExportedAt}
              storageMode={storageKind ?? 'firebase'}
              sharedFolderMessage={sharedProjectLock ? `Shared-folder lock held by ${sharedProjectLock.editorLabel} since ${new Date(sharedProjectLock.acquiredAt).toLocaleString()}.` : ''}
              onCreateProject={handleSetProject}
              onStartNewProject={handleStartNewProject}
              onChoose={(choice) => handleProjectChoice(choice === 'import-csv-json' ? 'import-csv-json' : choice === 'restore-json-backup' ? 'restore-json' : 'scan-folder')}
            />}
            {activeTab === 'dashboard' && <Dashboard chapters={chapters} project={project} />}
            {activeTab === 'chapters' && <ChapterList chapters={chapters} onEdit={setEditingChapter} onBatchUpdate={handleBatchUpdate} onCreate={handleCreateChapters} onDelete={handleDeleteChapter} canEdit={canEdit} canDelete={canDelete} />}
            {activeTab === 'tasks' && <TasksView chapters={chapters} />}
            {activeTab === 'bios' && <BiosView chapters={chapters} />}
            {activeTab === 'abstracts' && <AbstractsView chapters={chapters} />}
            {activeTab === 'users' && backend?.kind === 'firebase' && <UsersView />}
            {activeTab === 'activity' && <ActivityView
              project={project}
              events={activity}
              onRetry={() => { setIsLoading(true); setListenerAttempt(value => value + 1); }}
              syncError={refreshFailed ? 'Activity could not refresh. Existing results remain visible.' : ''}
            />}
            {activeTab === 'backups' && <BackupIntakeView
              chapters={chapters}
              onCreate={handleCreateChapters}
              onExport={handleExportBackup}
              onApplyProject={handleApplyProject}
              onViewChapters={() => setActiveTab('chapters')}
              userEmail={actorLabel}
              canEdit={canEdit}
              projectSetupFocus={projectSetupFocus}
              onProjectSetupFocusHandled={() => setProjectSetupFocus(null)}
            />}
          </>
        )}
      </main>

      {editingChapter && (
        <ChapterDetail
          chapter={editingChapter}
          onClose={() => setEditingChapter(null)}
          onSave={handleSaveChapter}
          onAppendStageRecord={handleAppendStageRecord}
          onVoidStageRecord={handleVoidStageRecord}
          userEmail={user?.email}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="app-titlebar" aria-hidden="true" />
      <AppContent />
    </ErrorBoundary>
  );
}
