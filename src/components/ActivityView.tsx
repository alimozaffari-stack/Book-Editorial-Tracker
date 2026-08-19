import { useState } from 'react';
import { activityEventsToCsv, ActivityViewEvent, filterActivityEvents } from '../domain/activityView';
import { ProjectState } from '../types';

type ActivityViewProps = {
  project: ProjectState | null;
  events: ActivityViewEvent[];
  syncError?: string;
  onRetry?: () => void;
};

export function ActivityView({ project, events, syncError, onRetry }: ActivityViewProps) {
  const [person, setPerson] = useState('');
  const [chapter, setChapter] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedPath, setSavedPath] = useState('');
  const [message, setMessage] = useState('');
  const [showAllActivity, setShowAllActivity] = useState(false);

  const filtered = filterActivityEvents(events, { person, chapter, action }, showAllActivity ? '' : project?.startedAt);
  const activeError = syncError ?? '';

  const exportActivity = async () => {
    if (!window.editorialTracker) { setMessage('Activity export is available in the desktop app.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await window.editorialTracker.saveLocalExport(`book-editorial-tracker-activity-${new Date().toISOString().slice(0, 10)}.csv`, activityEventsToCsv(filtered));
      if (result.cancelled) { setMessage('Export cancelled.'); return; }
      setSavedPath(result.filePath ?? '');
      setMessage(result.filePath ? `Saved to ${result.filePath}` : 'Activity export saved.');
    } catch { setMessage('Nothing was saved. Choose a destination and try again.'); }
    finally { setBusy(false); }
  };

  return <div className="p-6 max-w-5xl mx-auto">
    <div className="flex flex-wrap justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-gray-500">Tracker changes, newest first.</p>
      </div>
      <div className="flex gap-3">
        <button disabled={busy} className="text-sm text-indigo-700 disabled:opacity-50" onClick={exportActivity}>{busy ? 'Saving...' : 'Export activity CSV'}</button>
        <button onClick={() => setShowAllActivity(value => !value)} className="text-sm text-indigo-700">
          {showAllActivity ? 'Hide old activity' : 'Show all retained activity'}
        </button>
        {savedPath && <button className="text-sm text-indigo-700" onClick={() => window.editorialTracker?.openFolderForFile(savedPath)}>Open folder</button>}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <label className="text-xs text-gray-600">Person<input placeholder="name@example.com" value={person} onChange={event => setPerson(event.target.value)} className="mt-1 block rounded border p-2 text-sm" /></label>
      <label className="text-xs text-gray-600">Chapter<input placeholder="CH04" value={chapter} onChange={event => setChapter(event.target.value)} className="mt-1 block rounded border p-2 text-sm" /></label>
      <label className="text-xs text-gray-600">Action<input placeholder="stage record" value={action} onChange={event => setAction(event.target.value)} className="mt-1 block rounded border p-2 text-sm" /></label>
    </div>
    {(error || activeError) && <p className="mt-3 text-sm text-red-700" role="alert">{error || activeError}{!error && activeError && onRetry && <button onClick={onRetry} className="ml-2 font-medium underline">Try again</button>}</p>}
    {message && <p className="mt-3 text-sm text-gray-700" role="status">{message}</p>}
    {filtered.length ? <ul className="mt-4 divide-y rounded border bg-white">{filtered.map(event => <li key={event.id} className="p-3"><p className="font-medium">{event.summary}</p>{[event.chapterId, ...(event.chapterIds ?? [])].filter((id): id is string => Boolean(id)).length > 0 && <p className="mt-1 text-xs text-gray-600">Affected chapters: {[event.chapterId, ...(event.chapterIds ?? [])].filter((id): id is string => Boolean(id)).join(', ')}</p>}<p className="text-xs text-gray-500">{event.actorEmail} - {event.clientAt ? new Date(event.clientAt).toLocaleString() : 'Time pending'}</p></li>)}</ul> : <p className="mt-4 rounded border bg-white p-5 text-sm text-gray-500">No activity matches these filters.</p>}
  </div>;
}
