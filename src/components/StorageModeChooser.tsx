import React, { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';

interface StorageModeChooserProps {
  busy: boolean;
  message: string;
  error: string | null;
  onCreateLocalProject: (editorLabel: string, projectName: string) => Promise<void>;
  onOpenLocalProject: (editorLabel: string, recentToken?: string) => Promise<void>;
  onOpenSharedProject: (editorLabel: string, recentToken?: string) => Promise<void>;
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
  const [nameError, setNameError] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  const [recent, setRecent] = useState<RecentProject[]>([]);
  useEffect(() => {
    let active = true;
    window.editorialTracker?.listRecentProjects?.().then(items => { if (active) setRecent(items); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const label = editorLabel.trim();
  const name = projectName.trim();
  const openProject = (open: (editorLabel: string, recentToken?: string) => Promise<void>, token?: string) => {
    if (!label) {
      setNameError(true);
      nameInput.current?.focus();
      return;
    }
    setNameError(false);
    void open(label, token);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 pb-12 pt-10 sm:pt-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-gray-800">
          <BookOpen className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
          Book Editorial Tracker
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Open or create a book project</h1>

        <div className="mt-6">
          <label htmlFor="project-editor-name" className="block text-sm font-medium text-gray-900">Your name for the edit history</label>
          <input ref={nameInput} id="project-editor-name" value={editorLabel} onChange={event => { setEditorLabel(event.target.value); setNameError(false); }} placeholder="Start here — enter your name" aria-describedby="project-editor-help" aria-invalid={nameError} disabled={busy} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <p id="project-editor-help" className="mt-2 text-sm text-gray-600">Start here. Enter your name before opening or creating a project. Tracker records it alongside your edits.</p>
          {nameError && <p role="alert" className="mt-2 text-sm text-red-700">Enter your name to open a project.</p>}
        </div>

        {recent.length > 0 && <section aria-labelledby="recent-heading" className="mt-5">
          <h2 id="recent-heading" className="text-sm font-semibold text-gray-900">Recent projects</h2>
          <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
            {recent.map(item => <li key={item.token}>
              <button type="button" disabled={busy}
                onClick={() => openProject(item.mode === 'shared' ? onOpenSharedProject : onOpenLocalProject, item.token)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-indigo-700 hover:bg-gray-50 disabled:text-gray-600">
                <span className="min-w-0 break-all">{item.name}{item.folder && <span className="block text-xs text-gray-600">{item.folder}</span>}</span>
                <span className="text-xs text-gray-600">{item.mode === 'shared' ? 'Shared' : 'Local'}</span>
              </button>
            </li>)}
          </ul>
        </section>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => openProject(onOpenLocalProject)} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:bg-indigo-50 disabled:text-indigo-800">Open local project</button>
          <button type="button" disabled={busy} onClick={() => openProject(onOpenSharedProject)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:text-gray-500" aria-describedby="shared-project-help">Open shared project file</button>
        </div>
        <p id="shared-project-help" className="mt-2 text-sm text-gray-600">Use shared mode for a project in a shared or synced folder. One editor can save changes at a time.</p>

        <form className="mt-6 border-t border-gray-200 pt-5" onSubmit={event => {
          event.preventDefault();
          if (!busy && label && name) void onCreateLocalProject(label, name);
        }}>
          <label htmlFor="new-book-project" className="block text-sm font-medium text-gray-900">New project name</label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input id="new-book-project" value={projectName} onChange={event => setProjectName(event.target.value)} disabled={busy} className="min-w-40 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy || !label || !name} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:text-gray-500">Create project</button>
          </div>
        </form>
        <p role="status" className={busy || message ? 'mt-4 text-sm text-gray-700' : 'sr-only'}>{busy ? 'Working on your project…' : message}</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </main>
  );
}
