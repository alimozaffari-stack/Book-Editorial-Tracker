import { useState, FormEvent } from 'react';
import { ProjectState, TeamRole } from '../types';

type ProjectChoice = 'import-csv-json' | 'restore-json-backup' | 'scan-existing-folder';

interface Props {
  project: ProjectState | null;
  chapterCount: number;
  stageRecordCount: number;
  jsonBackupExportedAt: string;
  storageMode: 'local-file' | 'shared-folder';
  sharedFolderMessage: string;
  onCreateProject: (name: string) => Promise<ProjectState>;
  onStartNewProject: (name: string) => Promise<ProjectState>;
  onChoose: (choice: ProjectChoice) => void;
}

export function ProjectHelpView({
  project,
  chapterCount,
  stageRecordCount,
  jsonBackupExportedAt,
  storageMode,
  sharedFolderMessage,
  onCreateProject,
  onStartNewProject,
  onChoose,
}: Props) {
  const [name, setName] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const canStartBlank = chapterCount === 0;
  const canStartNewProject = Boolean(jsonBackupExportedAt && resetConfirmation === 'RESET' && name.trim());

  const submitProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!canStartBlank) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const nextProject = await onCreateProject(name);
      setStatus(`Tracker setup for "${nextProject.name}".`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nothing was changed. Try a different project name.');
    } finally {
      setSaving(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!project || !canStartNewProject) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const nextProject = await onStartNewProject(name);
      setStatus(`Tracker reset to "${nextProject.name}".`);
      setName('');
      setResetConfirmation('');
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : 'Nothing was deleted. A chapter changed after review; reload and start again.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="mx-auto max-w-5xl p-6">
    <h1 className="text-2xl font-semibold text-gray-900">Project &amp; Help</h1>
    {storageMode === 'shared-folder' && (
      <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Shared-folder mode is for one editor at a time. Folder synchronization is not a live database. If two people edit independently, the later save is blocked rather than merged.
        {sharedFolderMessage && <p className="mt-1 text-xs">{sharedFolderMessage}</p>}
      </section>
    )}
    {project ? (
      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-medium text-gray-900">Project identity</h2>
        <p className="mt-1 text-sm text-gray-600">{project.name}</p>
        <p className="text-xs text-gray-500 mt-1">Generation {project.generationId}</p>
        <p className="text-xs text-gray-500">Started {new Date(project.startedAt).toLocaleString()}</p>
        <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <h2 className="text-base font-semibold">Danger Zone: start new project</h2>
          <p className="mt-1">Current project: <span className="font-semibold">{project.name}</span></p>
          <p className="mt-1">Current chapter count: {chapterCount}</p>
          <p className="mt-1">Current stage-record count: {stageRecordCount}</p>
          <form className="mt-3 space-y-2" onSubmit={submitReset}>
            <p className="text-sm">Type <span className="font-semibold">RESET</span> after confirming counts to create a fresh project.</p>
            <p className="text-sm">Require successful JSON backup this session: <span className="font-semibold">{jsonBackupExportedAt ? new Date(jsonBackupExportedAt).toLocaleString() : 'no'}</span></p>
            <label className="block text-sm text-gray-700">
              New project name
              <input value={name} onChange={event => setName(event.target.value)} className="mt-1 block w-full rounded border p-2" maxLength={120} required />
            </label>
            <label className="block text-sm text-gray-700">
              Confirmation
              <input value={resetConfirmation} onChange={event => setResetConfirmation(event.target.value)} className="mt-1 block w-full rounded border p-2" placeholder="Type RESET to continue" required />
            </label>
            <button
              disabled={saving || !canStartNewProject}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Start new project
            </button>
            {!jsonBackupExportedAt && <p className="mt-2 text-sm text-red-700">A successful JSON backup is required before starting a new project.</p>}
            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
            {status && <p className="mt-2 text-sm text-emerald-700">{status}</p>}
          </form>
        </section>
      </section>
    ) : (
      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-medium text-gray-900">Set up this tracker</h2>
        <p className="mt-1 text-sm text-gray-600">Give this tracker a short project name, then choose one setup path.</p>
        <form className="mt-3 space-y-2" onSubmit={submitProject}>
          <label className="block text-sm text-gray-700">
            Project name
            <input value={name} onChange={event => setName(event.target.value)} className="mt-1 block w-full rounded border p-2" maxLength={120} required />
          </label>
          <button disabled={saving || !canStartBlank} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">Start blank</button>
          {!canStartBlank && <p className="mt-2 text-sm text-amber-700">This tracker already contains chapters. A populated tracker must use the backup-confirmed reset flow in Stage 3 before starting blank.</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => onChoose('import-csv-json')} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Import CSV/JSON</button>
            <button type="button" onClick={() => onChoose('restore-json-backup')} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Restore JSON backup</button>
            <button type="button" onClick={() => onChoose('scan-existing-folder')} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Scan an existing folder</button>
          </div>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          {status && <p className="mt-2 text-sm text-emerald-700">{status}</p>}
        </form>
      </section>
    )}
    <section className="mt-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-medium text-gray-900">Help</h2>
      <ul className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
        <li>Stage records are review-first; inspect a Word file before adding it.</li>
        <li>Source opening uses project-relative references, never absolute file system paths.</li>
        <li>Voiding a stage keeps its historical trail and marks a reason for audits.</li>
        <li>Export backups include chapters, team users, and activity for portability.</li>
        <li>Roles are admin, editor, and viewer with admin-managed team membership.</li>
        <li>Feedback round 0 is allowed only when the stage explicitly uses round 0.</li>
        <li>Storage mode is currently {storageMode === 'shared-folder' ? 'shared-folder mode' : 'local file mode'}.</li>
        {storageMode === 'shared-folder' && <li>Shared-folder mode is for one editor at a time. Folder synchronization is not a live database. If two people edit independently, the later save is blocked rather than merged.</li>}
        <li>Do not write source document paths into Firestore or activity records.</li>
        <li>The application never modifies selected source documents or source folders.</li>
      </ul>
    </section>
  </div>;
}
