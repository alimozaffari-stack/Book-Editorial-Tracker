import React, { useState } from 'react';
import { FileJson, FolderSync } from 'lucide-react';

interface StorageModeChooserProps {
  busy: boolean;
  message: string;
  error: string | null;
  onCreateLocalProject: (editorLabel: string, projectName: string) => Promise<void>;
  onOpenLocalProject: (editorLabel: string) => Promise<void>;
  onOpenSharedProject: (editorLabel: string) => Promise<void>;
}

export function StorageModeChooser({
  busy,
  message,
  error,
  onCreateLocalProject,
  onOpenLocalProject,
  onOpenSharedProject,
}: StorageModeChooserProps) {
  const [editorLabel, setEditorLabel] = useState('');
  const [projectName, setProjectName] = useState('');

  const label = editorLabel.trim();
  const name = projectName.trim();

  return (
    <div className="min-h-screen pt-8 bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900">Choose storage</h1>
        <p className="mt-2 text-sm text-gray-600">Public beta projects start from an explicit storage choice.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-4">
            <FileJson className="h-5 w-5 text-emerald-700" />
            <div className="mt-3 font-semibold text-gray-900">Local project file</div>
            <div className="mt-1 text-sm text-gray-600">one editor at a time</div>
            <div className="mt-4 space-y-2">
              <input value={editorLabel} onChange={event => setEditorLabel(event.target.value)} placeholder="Local editor label" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <p className="text-xs text-gray-600">Used only to identify changes in this project; it does not create an account.</p>
              <input value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="New project name" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button type="button" disabled={busy || !label || !name} onClick={() => void onCreateLocalProject(label, name)} className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Create local file</button>
              <button type="button" disabled={busy || !label} onClick={() => void onOpenLocalProject(label)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">Open local file</button>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <FolderSync className="h-5 w-5 text-gray-500" />
            <div className="mt-3 font-semibold text-gray-900">Shared-folder project</div>
            <div className="mt-1 text-sm text-gray-600">one editor at a time</div>
            <p className="mt-2 text-xs text-gray-600">Shared-folder mode is for one editor at a time.</p>
            <p className="mt-2 text-xs text-gray-700">Open an existing shared-project file from a synced or shared folder.</p>
            <div className="mt-3 space-y-2">
              <input value={editorLabel} onChange={event => setEditorLabel(event.target.value)} placeholder="Shared editor label" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <p className="text-xs text-gray-600">Used only to identify changes in this project; it does not create an account.</p>
              <button type="button" disabled={busy || !label} onClick={() => void onOpenSharedProject(label)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">Open shared project file</button>
            </div>
            <p className="mt-2 text-xs text-gray-600">If two people edit independently, the later save is blocked rather than merged.</p>
          </div>
        </div>

        {busy && <p className="mt-4 text-sm text-gray-600">Working...</p>}
        {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
