import { ChapterImportPlan } from '../types';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ImportPreviewDialogProps {
  plan: ChapterImportPlan;
  sourceName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  information?: string;
  error?: string;
}

export function ImportPreviewDialog({ plan, sourceName, busy = false, onCancel, onConfirm, information, error }: ImportPreviewDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { (error ? errorRef.current : closeRef.current)?.focus(); }, [error]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);
  const counts = plan.entries.reduce<Record<string, number>>((result, entry) => {
    result[entry.disposition] = (result[entry.disposition] ?? 0) + 1;
    return result;
  }, {});
  const creatable = counts.new ?? 0;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Import preview">
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
      <header className="flex items-start justify-between border-b p-5"><div><h2 className="text-xl font-semibold">Review import</h2><p className="mt-1 text-sm text-gray-600">{sourceName}: only new chapters will be created. Existing chapters will not be changed.</p></div><button ref={closeRef} onClick={onCancel} disabled={busy} aria-label="Close preview"><X /></button></header>
      <div className="grid grid-cols-2 gap-2 border-b bg-gray-50 p-4 text-sm md:grid-cols-4"><span>New: {creatable}</span><span>Already present: {counts['already-present'] ?? 0}</span><span>Invalid: {counts.invalid ?? 0}</span><span>Ambiguous: {counts.ambiguous ?? 0}</span></div>
      {information && <p className="border-b px-5 py-3 text-sm text-gray-600">{information}</p>}{error && <p ref={errorRef} tabIndex={-1} className="border-b px-5 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="max-h-72 overflow-y-auto p-5"><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="pb-2">Row</th><th className="pb-2">Chapter</th><th className="pb-2">Outcome</th><th className="pb-2">Details</th></tr></thead><tbody>{plan.entries.map((entry) => <tr key={`${entry.rowNumber}-${entry.normalizedId}`} className="border-b align-top"><td className="py-2">{entry.rowNumber}</td><td className="py-2">{entry.incoming?.id ?? '—'}</td><td className="py-2">{entry.disposition}</td><td className="py-2 text-gray-600">{entry.messages.join(' ')}</td></tr>)}</tbody></table></div>
      <footer className="flex justify-end gap-3 border-t bg-gray-50 p-5"><button onClick={onCancel} disabled={busy} className="rounded-lg border bg-white px-4 py-2 text-sm">Cancel</button><button onClick={onConfirm} disabled={busy || creatable === 0} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Importing…' : `Add ${creatable} new chapter${creatable === 1 ? '' : 's'}`}</button></footer>
    </div>
  </div>;
}
