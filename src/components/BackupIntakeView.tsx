import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Chapter, ChapterImportPlan } from '../types';
import { backupCollectionCounts, chaptersFromBackup } from '../domain/backupImport';
import { buildBackupImportPlan, buildChapterImportPlan, MAX_CHAPTER_IMPORT_ROWS, selectedNewChapters } from '../domain/chapterImportPlan';
import { chapterCsvTemplate } from '../utils/chapterImport';
import { inspectDocx } from '../utils/docxInspection';
import { ImportPreviewDialog } from './ImportPreviewDialog';
import { ProjectImportPreview } from './ProjectImportPreview';
import {
  buildChapterInventoryRows,
  ChapterInventoryRow,
  chapterInventoryRowsToChapters,
  canCreateFromInventoryRows,
  finalizeAppliedProjectImport,
  markProjectFileInspected,
  planProjectImport,
  projectImportPlanCsv,
  projectImportPlanMarkdown,
  ProjectFolderScan,
  ProjectImportPlan,
  ProjectImportResult,
  recalculateProjectImport,
  setProjectEntrySelected,
  updateProjectEntryProposal,
  updateProjectInspectedRecord,
  validateChapterInventoryRows,
} from '../domain/projectImportPlan';

export const INVENTORY_CREATION_ERROR_EXISTING = 'Nothing was created. A selected chapter already exists; reload the scan and review the inventory again.';
export const INVENTORY_CREATION_ERROR_INVALID = 'Nothing was created. Fix the highlighted inventory fields and try again.';
export const INVENTORY_CREATION_ERROR_UNKNOWN = 'Nothing was created. Check the project file or connection, then try again.';
export const INVENTORY_CREATION_ERROR_BATCH_LIMIT = `Nothing was created. Select at most ${MAX_CHAPTER_IMPORT_ROWS} chapters from the inventory and try again.`;

export function mapInventoryCreateErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/already exists/i.test(message) || /already recorded/i.test(message)) {
    return INVENTORY_CREATION_ERROR_EXISTING;
  }
  if (/invalid/i.test(message) || /safe project reference/i.test(message) || /metadata/i.test(message)) {
    return INVENTORY_CREATION_ERROR_INVALID;
  }
  return INVENTORY_CREATION_ERROR_UNKNOWN;
}

interface Props {
  chapters: Chapter[];
  onCreate: (chapters: Chapter[], source: 'csv-import' | 'backup-import' | 'scan-inventory') => Promise<{ created: string[]; skipped: string[] }>;
  onExport: (format: 'json' | 'csv') => Promise<string>;
  onApplyProject: (plan: ProjectImportPlan) => Promise<ProjectImportResult>;
  onViewChapters: () => void;
  userEmail: string;
  canEdit: boolean;
  projectSetupFocus?: 'import-csv-json' | 'restore-json' | 'scan-folder';
  onProjectSetupFocusHandled?: () => void;
}

export function BackupIntakeView({
  chapters,
  onCreate,
  onExport,
  onApplyProject,
  onViewChapters,
  userEmail,
  canEdit,
  projectSetupFocus,
  onProjectSetupFocusHandled,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const importCsvButton = useRef<HTMLButtonElement>(null);
  const restoreJsonButton = useRef<HTMLButtonElement>(null);
  const scanProjectButton = useRef<HTMLButtonElement>(null);
  const cancelInspection = useRef(false);
  const [plan, setPlan] = useState<ChapterImportPlan | null>(null);
  const [projectPlan, setProjectPlan] = useState<ProjectImportPlan | null>(null);
  const [projectScan, setProjectScan] = useState<ProjectFolderScan | null>(null);
  const [projectLabel, setProjectLabel] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [backupInfo, setBackupInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [projectProgress, setProjectProgress] = useState('');
  const [projectOutcome, setProjectOutcome] = useState<ProjectImportResult | null>(null);
  const [savedPath, setSavedPath] = useState('');
  const [chapterOutcome, setChapterOutcome] = useState<{ created: number; skipped: number } | null>(null);
  const [inventoryRows, setInventoryRows] = useState<ChapterInventoryRow[]>([]);
  const [showInventoryReview, setShowInventoryReview] = useState(false);

  useEffect(() => {
    if (!projectPlan) {
      setInventoryRows([]);
      setShowInventoryReview(false);
      return;
    }
    if (!showInventoryReview) {
      const rows = validateChapterInventoryRows(buildChapterInventoryRows(projectPlan), chapters);
      setInventoryRows(rows);
    }
  }, [projectPlan, chapters, showInventoryReview]);

  useEffect(() => {
    if (!canEdit || typeof window.editorialTracker?.resumeProjectFolder !== 'function') return;
    window.editorialTracker.resumeProjectFolder().then(scan => {
      if (scan) {
        setProjectScan(scan);
        setProjectLabel(scan.displayLabel);
        setProjectPlan(planProjectImport(scan, chapters));
      }
    }).catch(() => undefined);
  }, [canEdit, chapters]);

  useEffect(() => {
    if (!projectScan) return;
    setProjectPlan(current => current ? recalculateProjectImport(current, projectScan, chapters) : current);
  }, [chapters, projectScan]);

  useEffect(() => {
    if (projectSetupFocus === 'import-csv-json') importCsvButton.current?.focus();
    else if (projectSetupFocus === 'restore-json') restoreJsonButton.current?.focus();
    else if (projectSetupFocus === 'scan-folder') scanProjectButton.current?.focus();
    if (projectSetupFocus) onProjectSetupFocusHandled?.();
  }, [projectSetupFocus, onProjectSetupFocusHandled]);

  const chooseImport = (kind: 'csv' | 'json') => {
    if (!input.current) return;
    input.current.accept = kind === 'csv' ? '.csv,text/csv' : '.json,application/json';
    input.current.dataset.kind = kind;
    input.current.click();
  };

  const selectImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const kind = event.target.dataset.kind;
    event.target.value = '';
    if (!file) return;

    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose an import file smaller than 5 MiB.');
      const text = await file.text();
      if (kind === 'csv') {
        setPlan(buildChapterImportPlan(text, chapters));
        setBackupInfo('');
      } else {
        const parsed = JSON.parse(text);
        const counts = backupCollectionCounts(parsed);
        if (counts.chapters > MAX_CHAPTER_IMPORT_ROWS) throw new Error(`Choose a backup with at most ${MAX_CHAPTER_IMPORT_ROWS} chapter records.`);
        setBackupInfo(`${counts.users} team record${counts.users === 1 ? '' : 's'} and ${counts.auditEvents} activity event${counts.auditEvents === 1 ? '' : 's'} are informational and will not be imported.`);
        setPlan(buildBackupImportPlan(chaptersFromBackup(parsed), chapters));
      }
      setName(file.name);
      setMessage('');
      setPreviewError('');
      setChapterOutcome(null);
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'That file is not valid JSON. Nothing was changed. Choose a tracker backup and try again.' : error instanceof Error ? error.message : 'Could not read that import file. Nothing was changed. Choose another file and try again.');
    }
  };

  const confirm = async () => {
    if (!plan) return;
    setBusy(true);
    setPreviewError('');
    try {
      const source = name.toLowerCase().endsWith('.csv') ? 'csv-import' : 'backup-import';
      const selected = selectedNewChapters(plan);
      const result = await onCreate(selected, source);
      if (projectScan && projectPlan) {
        setProjectProgress('Chapter import completed. The project preview will recalculate from the live chapter list.');
      }
      setChapterOutcome({ created: result.created.length, skipped: result.skipped.length });
      setPlan(null);
    } catch {
      setPreviewError('Nothing was changed. Check your connection, then try Add new chapters again.');
    } finally {
      setBusy(false);
    }
  };

  const updateInventoryRow = (index: number, patch: Partial<ChapterInventoryRow>) => {
    setInventoryRows(current => validateChapterInventoryRows(current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row), chapters));
  };

  const createFromInventory = async () => {
    if (!projectPlan) return;
    setBusy(true);
    setMessage('');
    setPreviewError('');
    try {
      const validated = validateChapterInventoryRows(inventoryRows, chapters);
      if (!canCreateFromInventoryRows(validated)) {
        setInventoryRows(validated);
        throw new Error('validation');
      }
      if (validated.filter((row) => row.selected).length > MAX_CHAPTER_IMPORT_ROWS) {
        throw new Error('batch-limit');
      }
      const selected = chapterInventoryRowsToChapters(validated);
      const result = await onCreate(selected, 'scan-inventory');
      setMessage(`${result.created.length} chapter records created. No stage records were added.`);
      setProjectProgress('Chapter inventory import complete. The project preview will recalculate from the live chapter list.');
      setShowInventoryReview(false);
      setChapterOutcome(null);
      if (result.created.length > 0) {
        setInventoryRows(prev => prev.map(row => ({ ...row, selected: false })));
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : undefined;
      const mapped = detail === 'validation'
        ? INVENTORY_CREATION_ERROR_INVALID
        : detail === 'batch-limit'
          ? INVENTORY_CREATION_ERROR_BATCH_LIMIT
          : mapInventoryCreateErrorMessage(error);
      setMessage(mapped);
      setShowInventoryReview(true);
    } finally {
      setBusy(false);
    }
  };

  const runExport = async (format: 'json' | 'csv') => {
    setBusy(true);
    try {
      const result = await onExport(format);
      setMessage(result);
      const match = /^Saved to (.+)$/.exec(result);
      setSavedPath(match?.[1] ?? '');
    } catch {
      setMessage('Nothing was saved. Choose a destination and try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!window.editorialTracker) return setMessage('The chapter-list template is available in the desktop app.');
    const result = await window.editorialTracker.saveLocalExport('book-editorial-tracker-chapter-list-template.csv', chapterCsvTemplate);
    if (!result.cancelled && result.filePath) {
      setSavedPath(result.filePath);
      setMessage(`Saved to ${result.filePath}`);
    }
  };

  const scanProject = async () => {
    if (!window.editorialTracker) return setMessage('Project folder scanning is available in the desktop app only.');
    setBusy(true);
    try {
      const scan = await window.editorialTracker.scanProjectFolder();
      if (!scan) return;
      setProjectScan(scan);
      setProjectLabel(scan.displayLabel);
      setProjectPlan(planProjectImport(scan, chapters));
      setProjectOutcome(null);
      setProjectProgress('Metadata scan complete. No document contents were opened.');
    } catch {
      setMessage('Could not scan the selected project folder. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  const forgetProject = async () => {
    await window.editorialTracker?.forgetProjectFolder();
    setProjectScan(null);
    setProjectPlan(null);
    setProjectLabel('');
    setProjectOutcome(null);
    setProjectProgress('Project folder forgotten on this device.');
  };

  const inspectSelected = async () => {
    if (!projectPlan || !window.editorialTracker) return;
    const paths = projectPlan.entries.filter(entry => entry.selected && !entry.inspected && entry.file.extension === '.docx').map(entry => entry.file.relativePath);
    let next = projectPlan;
    cancelInspection.current = false;
    setBusy(true);
    setProjectOutcome(null);
    try {
      for (let index = 0; index < paths.length; index += 1) {
        if (cancelInspection.current) {
          setProjectProgress(`Inspection stopped after ${index} of ${paths.length} files.`);
          break;
        }
        setProjectProgress(`Inspecting ${index + 1} of ${paths.length}: ${paths[index].split('/').at(-1)}`);
        let selected: SelectedDocx | null = await window.editorialTracker.inspectProjectDocx(paths[index]);
        const inspection = await inspectDocx(selected.bytes);
        next = markProjectFileInspected(next, paths[index], selected, inspection, chapters, userEmail);
        setProjectPlan(next);
        selected = null;
        if (index === paths.length - 1) {
          setProjectProgress(`Inspected ${paths.length} selected Word file${paths.length === 1 ? '' : 's'}. Review the results before adding.`);
        }
      }
    } catch {
      setProjectProgress('Inspection stopped. Nothing was written to the tracker. Review the file and try again.');
    } finally {
      setBusy(false);
    }
  };

  const applyProject = async () => {
    if (!projectPlan) return;
    setBusy(true);
    setProjectProgress('Adding reviewed stage records...');
    try {
      const result = await onApplyProject(projectPlan);
      setProjectPlan(current => current ? finalizeAppliedProjectImport(current, result) : current);
      setProjectOutcome(result);
      setProjectProgress('Project history import complete.');
    } catch (error) {
      setProjectProgress(error instanceof Error ? error.message : 'Nothing was changed. Reload the project preview and try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveProjectReport = async (format: 'csv' | 'md') => {
    if (!projectPlan || !window.editorialTracker) return;
    const contents = format === 'csv' ? projectImportPlanCsv(projectPlan) : projectImportPlanMarkdown(projectPlan, projectLabel);
    const result = await window.editorialTracker.saveLocalExport(`book-editorial-tracker-project-scan-${new Date().toISOString().slice(0, 10)}.${format}`, contents);
    if (!result.cancelled && result.filePath) {
      setSavedPath(result.filePath);
      setMessage(`Saved to ${result.filePath}`);
    }
  };

  return <div className="mx-auto max-w-5xl p-6">
    <h1 className="text-2xl font-semibold text-gray-900">Backups & intake</h1>
    <p className="mt-2 text-gray-600">Exports use Save As. Imports preview first and never overwrite existing chapters or source documents.</p>
    <div className="mt-6 rounded-xl border bg-white p-5">
      <h2 className="font-medium">Back up</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => runExport('json')} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">Save JSON backup</button>
        <button disabled={busy} onClick={() => runExport('csv')} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Export CSV</button>
        {savedPath && window.editorialTracker && <button onClick={() => window.editorialTracker?.openFolderForFile(savedPath)} className="rounded-lg border px-4 py-2 text-sm">Open folder</button>}
      </div>
    </div>
    {canEdit && <>
      <div className="mt-4 rounded-xl border bg-white p-5">
        <h2 className="font-medium">Import chapters</h2>
        <p className="mt-1 text-sm text-gray-600">Choose CSV or JSON, preview new and unchanged IDs, then add only the new chapters.</p>
        <p className="mt-1 text-sm text-gray-700">This imports new chapter records only. Project identity, team members, and activity are not restored.</p>
        <input ref={input} type="file" className="hidden" onChange={selectImport} />
        <div className="mt-3 flex flex-wrap gap-3">
          <button ref={importCsvButton} disabled={busy} onClick={() => chooseImport('csv')} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Choose CSV</button>
          <button ref={restoreJsonButton} disabled={busy} onClick={() => chooseImport('json')} className="rounded-lg border px-4 py-2 text-sm">Choose JSON backup</button>
          <button disabled={busy} onClick={saveTemplate} className="rounded-lg border px-4 py-2 text-sm">Download chapter-list template</button>
        </div>
      </div>
      <div className="mt-4 rounded-xl border bg-white p-5">
        <h2 className="font-medium">Import existing project</h2>
        <p className="mt-1 text-sm text-gray-600">Choose one existing project root. The initial scan reads names, sizes, and dates only and never changes the folder.</p>
        {!projectPlan && <button ref={scanProjectButton} disabled={busy} onClick={scanProject} className="mt-3 rounded-lg border px-4 py-2 text-sm">Choose project folder</button>}
      </div>
    </>}
    {projectPlan && !showInventoryReview && inventoryRows.length > 0 && (
      <div className="mt-4 rounded-xl border bg-white p-5">
        <h2 className="font-medium">Create chapter inventory from scan</h2>
        <p className="mt-1 text-sm text-gray-600">Creates reviewed chapter records only; no source files are changed and no stage records are imported.</p>
        <button onClick={() => setShowInventoryReview(true)} disabled={busy} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create chapter inventory from scan</button>
      </div>
    )}
    {projectPlan && showInventoryReview && (
      <section className="mt-4 rounded-xl border bg-white p-5">
        <h2 className="font-medium">Review unmatched chapter IDs</h2>
        <p className="mt-1 text-sm text-gray-600">Creates reviewed chapter records only; no source files are changed and no stage records are imported.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-600 border-b">
                <th className="pb-2">Create</th>
                <th className="pb-2">Chapter ID</th>
                <th className="pb-2">Title</th>
                <th className="pb-2">Contributor</th>
                <th className="pb-2">Submission reference</th>
                <th className="pb-2">Files</th>
                <th className="pb-2">Validation</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map((row, index) => (
                <tr key={`${row.chapterId || index}`} className="border-b">
                  <td className="py-2 align-top"><input type="checkbox" checked={row.selected} onChange={event => updateInventoryRow(index, { selected: event.target.checked })} /></td>
                  <td className="py-2 align-top">
                    <input value={row.chapterId} onChange={event => updateInventoryRow(index, { chapterId: event.target.value })} className="w-full rounded border p-1" />
                  </td>
                  <td className="py-2 align-top">
                    <input value={row.title} onChange={event => updateInventoryRow(index, { title: event.target.value })} className="w-full rounded border p-1" />
                  </td>
                  <td className="py-2 align-top">
                    <input value={row.contributorName} onChange={event => updateInventoryRow(index, { contributorName: event.target.value })} className="w-full rounded border p-1" />
                  </td>
                  <td className="max-w-52 break-all py-2 align-top">{row.submissionReference || '-'}</td>
                  <td className="py-2 align-top">{row.discoveredFileCount}</td>
                  <td className="py-2 align-top text-red-700">{row.validationError}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button onClick={() => { setShowInventoryReview(false); setMessage(''); }} disabled={busy} className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
          <button onClick={createFromInventory} disabled={busy || !canCreateFromInventoryRows(inventoryRows)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Create selected chapters</button>
        </div>
      </section>
    )}
    {projectPlan && <ProjectImportPreview plan={projectPlan} label={projectLabel} chapters={chapters} busy={busy} progress={projectProgress} outcome={projectOutcome} onToggle={(path, selected) => setProjectPlan(current => current ? setProjectEntrySelected(current, path, selected) : current)} onClassify={(path, stage, roundNumber) => setProjectPlan(current => current ? updateProjectEntryProposal(current, path, stage ? { stage, roundNumber } : undefined) : current)} onRecordChange={(path, changes) => setProjectPlan(current => current ? updateProjectInspectedRecord(current, path, changes) : current)} onInspect={inspectSelected} onCancelInspection={() => { cancelInspection.current = true; }} onApply={applyProject} onChangeFolder={scanProject} onForgetFolder={forgetProject} onViewChapters={onViewChapters} onSaveReport={saveProjectReport} />}
    {message && <p className="mt-4 text-sm text-gray-700" role="status">{message}</p>}
    {chapterOutcome && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900" role="status"><p>{chapterOutcome.created} new chapter{chapterOutcome.created === 1 ? '' : 's'} added; {chapterOutcome.skipped} already in tracker - not changed.</p><button onClick={onViewChapters} className="mt-2 font-medium underline">View chapters</button></div>}
    {plan && <ImportPreviewDialog plan={plan} sourceName={name} busy={busy} information={backupInfo} error={previewError} onCancel={() => setPlan(null)} onConfirm={confirm} />}
  </div>;
}
