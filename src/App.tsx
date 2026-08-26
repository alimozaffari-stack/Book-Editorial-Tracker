import React, { useRef, useState, useEffect } from 'react';
import { Chapter, ChapterStageRecord, ProjectState } from './types';
import { Dashboard } from './components/Dashboard';
import { ChapterList } from './components/ChapterList';
import { ChapterDetail } from './components/ChapterDetail';
import { TasksView } from './components/TasksView';
import { BiosView } from './components/BiosView';
import { AbstractsView } from './components/AbstractsView';
import { ActivityView } from './components/ActivityView';
import { StorageModeChooser } from './components/StorageModeChooser';
import { LayoutDashboard, List, CheckSquare, FileText, LogOut, ClipboardList } from 'lucide-react';
import editorialMark from './assets/editorial-review-tracker-mark.png';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BackupIntakeView } from './components/BackupIntakeView';
import { BackendKind, TrackerBackend } from './storage/TrackerBackend';
import { createBackend } from './storage/backendFactory';
import { buildProjectBackup, chaptersToCsv, timestampedBackupFilename } from './utils/backupExport';
import { ProjectImportPlan, ProjectImportResult } from './domain/projectImportPlan';
import { ActivityViewEvent } from './domain/activityView';
import { ProjectHelpView } from './components/ProjectHelpView';
import { hashPortableProjectContents, preparePortableProjectOpen, PortableProjectFile, serializePortableProjectFile } from './storage/projectFileFormat';
import { SharedFolderTrackerBackend } from './storage/SharedFolderTrackerBackend';

type ActiveTab = 'dashboard' | 'project' | 'chapters' | 'tasks' | 'bios' | 'abstracts' | 'activity' | 'backups';
type ProjectSetupFocus = 'import-csv-json' | 'restore-json' | 'scan-folder' | null;

function AppContent() {
  const SHARED_OWNERSHIP_LOST_MESSAGE = 'Shared editing access was lost. No further shared saves are permitted until this file is reopened and a lock is acquired.';
  const isPublicBuild = import.meta.env.VITE_APP_VARIANT === 'public';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [project, setProject] = useState<ProjectState | null>(null);
  const [projectSetupFocus, setProjectSetupFocus] = useState<ProjectSetupFocus>(null);
  const [jsonBackupExportedAt, setJsonBackupExportedAt] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityViewEvent[]>([]);

  const [storageKind, setStorageKind] = useState<BackendKind | null>(null);
  const [localEditorLabel, setLocalEditorLabel] = useState('');
  const [backend, setBackend] = useState<TrackerBackend | null>(null);
  const backendRef = useRef(backend);
  useEffect(() => { backendRef.current = backend; }, [backend]);

  const [projectRevision, setProjectRevision] = useState(0);

  const [setupMessage, setSetupMessage] = useState('');
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
  const actorLabel = localEditorLabel.trim();
  const FILE_STALE_SAVE_MESSAGE = isSharedMode
    ? 'Nothing was saved. The shared project file changed on disk or revision. Use Save As conflict copy to keep your changes.'
    : 'Nothing was saved. The local project file changed on disk. Use Save As to keep your changes.';

  const isFileProjectStaleSave = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    return /changed on disk|project revision|stale project file/i.test(message);
  };

  const clearSharedHeartbeat = () => {
    if (sharedHeartbeatTimer.current !== null) {
      clearInterval(sharedHeartbeatTimer.current);
      sharedHeartbeatTimer.current = null;
    }
  };

  const markSharedOwnershipLost = (message = SHARED_OWNERSHIP_LOST_MESSAGE) => {
    clearSharedHeartbeat();
    setSharedProjectCanEdit(false);
    setLocalSaveNeedsCopy(false);
    setRuntimeError(message);
    if (backendRef.current instanceof SharedFolderTrackerBackend) {
      backendRef.current.setCanEdit(false, message);
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

  const closeCurrentBackend = async () => {
    await releaseSharedProjectLock();
    clearSharedHeartbeat();
    if (backend) {
      await backend.close();
      setBackend(null);
    }
    setProject(null);
    setChapters([]);
    setActivity([]);
    setStorageKind(null);
    setSharedProjectLock(null);
    setSharedProjectCanEdit(false);
    setSharedProjectFileToken('');
    setSetupMessage('');
    setRuntimeError(null);
  };

  useEffect(() => {
    if (!backend) return;

    setIsLoading(true);
    const unsubscribe = backend.subscribe((snapshot) => {
      setProject(snapshot.project);
      setChapters(snapshot.chapters);
      setActivity(snapshot.activity);
      setProjectRevision(snapshot.revision);
      setLocalSaveNeedsCopy(false);
      setRuntimeError(null);
      setLastRefresh(new Date().toLocaleTimeString());
      setRefreshFailed(false);
      setIsLoading(false);
    }, () => {
      setProject(null);
      setChapters([]);
      setActivity([]);
      setRefreshFailed(true);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [backend]);



  useEffect(() => {
    return () => {
      void releaseSharedProjectLock();
      clearSharedHeartbeat();
      void backend?.close();
    };
  }, [backend]);

  const canEdit = isSharedMode ? sharedProjectCanEdit && !!actorLabel : !!actorLabel;
  const canDelete = canEdit;

  const handleSaveChapter = async (updatedChapter: Chapter) => {
    if (!backend) return;
    try {
      const expectedRevision = updatedChapter.dataRevision ?? 0;
      const result = await backend.saveChapter(updatedChapter, expectedRevision, actorLabel);
      if (result.kind === 'conflict') throw { kind: 'conflict', current: result.current };
      if (result.kind === 'unchanged') return { chapter: result.current, unchanged: true };
      if (result.kind !== 'ok') throw { kind: 'conflict', current: result.current };

      setEditingChapter(result.new);
      return { chapter: result.new, unchanged: false };
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };

  const handleBatchUpdateChapterFields = async (chapterIds: string[], field: keyof Chapter, value: string) => {
    if (!backend) return;
    try {
      await backend.batchUpdateChapterFields(chapterIds, field, value, actorLabel);
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };

  const handleApplyProjectImport = async (plan: ProjectImportPlan): Promise<ProjectImportResult> => {
    if (!backend) throw new Error('Tracker backend is not ready.');
    try {
      return await backend.applyProjectImport(plan, actorLabel);
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };

  const handleCreateChaptersFromInventory = async (candidateChapters: Chapter[]): Promise<{ created: string[]; skipped: string[] }> => {
    if (!backend) throw new Error('Tracker backend is not ready.');
    try {
      return await backend.createChaptersFromInventory(candidateChapters, actorLabel);
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };

  const handleAppendStageRecord = async (chapterId: string, record: ChapterStageRecord, expectedRevision: number) => {
    if (!backend) return;
    try {
      const result = await backend.appendStageRecord(chapterId, record, expectedRevision, actorLabel);
      if (result.kind !== 'ok') throw result;
      setEditingChapter(result.new);
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };

  const handleVoidStageRecord = async (chapterId: string, recordId: string, reason: string, expectedRevision: number) => {
    if (!backend) return;
    try {
      const result = await backend.voidStageRecord(chapterId, recordId, reason, expectedRevision, actorLabel);
      if (result.kind !== 'ok') throw result;
      setEditingChapter(result.new);
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };

  const handleCreateChapters = async (chaptersToCreate: Chapter[], source: string): Promise<{ created: string[]; skipped: string[] }> => {
    if (!backend) throw new Error('Tracker backend is not ready.');
    try {
      return await backend.createChapters(chaptersToCreate, actorLabel, source);
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };

  const handleDeleteChapters = async (chaptersToDelete: Chapter[]) => {
    if (!backend) return;
    try {
      await backend.deleteChapters(chaptersToDelete, actorLabel);
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };

  const saveLocalExport = async (filename: string, contents: string, mimeType: string): Promise<{ cancelled: boolean; filePath?: string }> => {
    if (window.editorialTracker?.saveLocalExport) {
      return window.editorialTracker.saveLocalExport(filename, contents);
    }
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { cancelled: false };
  };

  const exportLocalData = async (format: 'csv' | 'json') => {
    const exportedAt = new Date().toISOString();
    const filename = timestampedBackupFilename(exportedAt, format);
    let contents: string;
    let mimeType: string;

    if (format === 'json') {
      const backup = buildProjectBackup({
        chapters,
        users: [],
        auditEvents: activity,
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

  const handleStartNewProject = async (nextProjectName: string) => {
    if (!project || !backend) return;
    try {
      const input = { name: nextProjectName, expectedRevision: projectRevision };
      const result = await backend.resetProjectWithAudit(input, actorLabel);
      setProject(result.project);
      setProjectSetupFocus(null);
      return result.project;
    } catch (error) {
      if (isFileProjectStaleSave(error)) {
        setLocalSaveNeedsCopy(true);
        throw new Error(FILE_STALE_SAVE_MESSAGE);
      }
      throw error;
    }
  };







  const openPortableBackend = async (
    mode: 'local-file' | 'shared-folder',
    editorLabel: string,
    contents: string,
    fileToken: string,
    initialHash?: string,
  ) => {
    await closeCurrentBackend();
    setStorageKind(mode);
    setLocalEditorLabel(editorLabel);

    let canEditShared = true;
    let sharedLock: { editorLabel: string; acquiredAt: string; heartbeatAt: string } | null = null;

    if (mode === 'shared-folder') {
      if (!window.editorialTracker?.acquireSharedProjectLock) {
        throw new Error('Shared project locking API is unavailable.');
      }
      const lockResult = await window.editorialTracker.acquireSharedProjectLock(fileToken, editorLabel, sharedInstanceId.current);
      if (!lockResult.ok) {
        canEditShared = false;
        if (lockResult.lock) sharedLock = lockResult.lock;
        setRuntimeError(lockResult.message || 'Shared project acquired in read-only mode.');
      } else {
        if (lockResult.lock) sharedLock = lockResult.lock;
      }
      setSharedProjectFileToken(fileToken);
      setSharedProjectLock(sharedLock);
      setSharedProjectCanEdit(canEditShared);
    }

    const configuredBackend = createBackend(mode, {
      localFile: mode === 'local-file' ? {
        fileToken,
        contents,
        initialHash,
        editorLabel,
        fileApi: {
          saveProjectFile: (token, expectedHash, nextContents) => {
            if (!window.editorialTracker?.saveProjectFile) throw new Error('Local file saving API is unavailable.');
            return window.editorialTracker.saveProjectFile(token, expectedHash, nextContents);
          },
        },
      } : undefined,
      sharedFile: mode === 'shared-folder' ? {
        fileToken,
        contents,
        initialHash,
        editorLabel,
        instanceId: sharedInstanceId.current,
        canEdit: canEditShared,
        sharedLock,
        onOwnershipLost: (message) => markSharedOwnershipLost(message),
        fileApi: {
          verifySharedOwnership: (token, instanceId) => {
            if (!window.editorialTracker?.verifySharedProjectLock) throw new Error('Shared lock verification is unavailable.');
            return window.editorialTracker.verifySharedProjectLock(token, instanceId);
          },
          saveSharedProjectFile: (token, instanceId, expectedHash, expectedProjectRevision, nextContents) => {
            if (!window.editorialTracker?.saveSharedProjectFile) throw new Error('Shared file saving API is unavailable.');
            return window.editorialTracker.saveSharedProjectFile(token, instanceId, expectedHash, expectedProjectRevision, nextContents);
          },
          saveSharedProjectFileAs: (nextContents) => {
            if (!window.editorialTracker?.saveSharedProjectFileAs) throw new Error('Shared file Save As API is unavailable.');
            return window.editorialTracker.saveSharedProjectFileAs(nextContents);
          },
        },
      } : undefined,
    });

    setBackend(configuredBackend);

    if (mode === 'shared-folder' && canEditShared) {
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



  if (!backend) {
    return (
      <StorageModeChooser
        busy={storageBusy}
        message={setupMessage}
        error={runtimeError}
        onCreateLocalProject={handleCreateLocalProject}
        onOpenLocalProject={handleOpenLocalProject}
        onOpenSharedProject={handleOpenSharedProject}
      />
    );
  }
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
            {activeTab === 'chapters' && <ChapterList chapters={chapters} projectName={project?.name ?? 'Compiled manuscript'} onEdit={setEditingChapter} onBatchUpdate={handleBatchUpdate} onCreate={handleCreateChapters} onDelete={handleDeleteChapter} canEdit={canEdit} canDelete={canDelete} />}
            {activeTab === 'tasks' && <TasksView chapters={chapters} />}
            {activeTab === 'bios' && <BiosView chapters={chapters} />}
            {activeTab === 'abstracts' && <AbstractsView chapters={chapters} />}
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
