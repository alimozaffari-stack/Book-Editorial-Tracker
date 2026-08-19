import { useState } from 'react';
import { ChapterStageRecord } from '../types';
import { deriveCurrentStage } from '../domain/chapterStageHistory';
import StageSourceActions from './StageSourceActions';

interface Props { 
  records?: ChapterStageRecord[]; 
  conflictRecordIds?: string[];
  canEdit?: boolean; 
  onVoid?: (recordId: string, reason: string) => Promise<{ ok: boolean; message?: string }>; 
}

export function StageHistory({ records = [], conflictRecordIds = [], canEdit = false, onVoid }: Props) {
  const current = deriveCurrentStage(records);
  const [voidingId, setVoidingId] = useState<string | null>(null); 
  const [reason, setReason] = useState(''); 
  const [busy, setBusy] = useState(false); 
  const [error, setError] = useState('');
  
  const submitVoid = async () => {
    if (!voidingId || !onVoid) return;
    if (!reason.trim()) { 
      setError('Enter a reason before marking this record as entered by mistake.'); 
      return; 
    }
    setBusy(true); 
    setError('');
    try { 
      const outcome = await onVoid(voidingId, reason.trim()); 
      if (!outcome.ok) { 
        setError(outcome.message ?? 'Nothing was changed. Reload the latest chapter and try again.'); 
        return; 
      } 
      setVoidingId(null); 
      setReason(''); 
    } finally { 
      setBusy(false); 
    }
  };
  
  return (
    <section className="mb-6 rounded-xl border p-4">
      <h3 className="font-semibold">Stage history</h3>
      <p className="mt-1 text-sm text-gray-600">
        Current state: {current ? current.stage.replaceAll('-', ' ') : 'No confirmed stage'}
      </p>
      
      {records.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No stage records yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th>Stage</th>
                <th>Date</th>
                <th>File</th>
                <th>Words</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {[...records]
                .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn))
                .map(record => (
                  <tr key={record.id} className="border-b align-top">
                    <td className="py-2">
                      {record.stage.replaceAll('-', ' ')}
                      {record.roundNumber ? ` ${record.roundNumber}` : ''}
                      {conflictRecordIds.includes(record.id) ? (
                        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Conflict</span>
                      ) : null}
                    </td>
                    <td>{record.effectiveOn}</td>
                     <td>
                       {record.sourceFileName || record.sourceSha256 ? (
                         <StageSourceActions record={record} compact={true} />
                       ) : (
                         '—'
                       )}
                     </td>
                    <td>{record.wordCount ?? record.calculatedWordCount ?? '—'}</td>
                    <td>
                      {record.state}
                      {record.voidReason ? (
                        <span className="block text-xs text-gray-500">{record.voidReason}</span>
                      ) : null}
                    </td>
                    <td>
                      {canEdit && record.state === 'active' && (
                        <button 
                          type="button" 
                          onClick={() => { 
                            setVoidingId(record.id); 
                            setReason(''); 
                            setError(''); 
                          }} 
                          className="text-xs font-medium text-red-700 underline"
                        >
                          Mark as entered by mistake
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
      
      {voidingId && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <label className="block text-sm font-medium text-red-900">
            Reason
            <input 
              autoFocus 
              value={reason} 
              onChange={event => setReason(event.target.value)} 
              disabled={busy} 
              className="mt-1 w-full rounded border bg-white p-2 text-gray-900" 
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>
          )}
          <div className="mt-3 flex gap-3">
            <button type="button" disabled={busy} onClick={() => setVoidingId(null)}>
              Cancel
            </button>
            <button 
              type="button" 
              disabled={busy} 
              onClick={submitVoid} 
              className="rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Confirm mistake'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
