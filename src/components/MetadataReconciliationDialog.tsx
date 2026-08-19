import { useState } from 'react';

interface MetadataReconciliationDialogProps {
  chapterIds: string[];
  onConfirm: (chapterIds: string[]) => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

export function MetadataReconciliationDialog({ chapterIds, onConfirm, onClose, onSuccess }: MetadataReconciliationDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(chapterIds);
      onSuccess();
    } catch {
      setError('Nothing was changed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="presentation">
    <section className="w-full max-w-lg rounded-xl bg-white shadow-xl p-6" role="dialog" aria-modal="true" aria-labelledby="reconcile-abstract-heading">
      <h2 id="reconcile-abstract-heading" className="text-lg font-semibold text-gray-900">Reconcile imported abstract statuses</h2>
      <p className="mt-2 text-sm text-gray-600">This will set <strong>Abstract Submitted</strong> to <strong>Yes</strong> for the following chapters. It does not change their text or stage history.</p>
      <ul className="mt-3 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800" aria-label="Chapters to reconcile">
        {chapterIds.map(id => <li key={id}>{id}</li>)}
      </ul>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium">Cancel</button>
        <button type="button" onClick={confirm} disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-60">{busy ? 'Reconciling…' : `Reconcile ${chapterIds.length} chapter${chapterIds.length === 1 ? '' : 's'}`}</button>
      </div>
    </section>
  </div>;
}
