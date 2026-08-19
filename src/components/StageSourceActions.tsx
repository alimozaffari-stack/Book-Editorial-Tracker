import { useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import type { ChapterStageRecord } from '../types';

interface StageSourceActionsProps {
  record: ChapterStageRecord;
  compact?: boolean;
}

export function hasStageSourceReference(record: Pick<ChapterStageRecord, 'sourceRelativePath' | 'sourceSha256'>): boolean {
  return Boolean(record.sourceRelativePath || record.sourceSha256);
}

export default function StageSourceActions({ record, compact = false }: StageSourceActionsProps) {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hasSourceReference = hasStageSourceReference(record);

  const handleAction = async (action: 'open' | 'reveal') => {
    if (!hasSourceReference || !window.editorialTracker) return;
    setIsPending(true);
    setMessage(null);
    try {
      const result = await window.editorialTracker.openStageSource({
        sourceRelativePath: record.sourceRelativePath,
        sourceSha256: record.sourceSha256,
        action,
      });
      if (!result.ok) setMessage(result.message);
    } catch {
      setMessage('The document could not be opened. Check that it is available on this computer.');
    } finally {
      setIsPending(false);
    }
  };

  if (!hasSourceReference) return null;

  if (compact) {
    return (
      <div className="min-w-0 max-w-[13rem]">
        <div className="flex min-w-0 items-center gap-1">
          <button type="button" onClick={() => handleAction('open')} disabled={isPending} className="inline-flex min-w-0 max-w-[11rem] items-center gap-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50" title="Open document" aria-label={`Open document: ${record.sourceFileName || 'Recorded Word document'}`}>
            <FileText size={16} className="shrink-0" />
            <span className="truncate">{record.sourceFileName || 'Open document'}</span>
          </button>
          <button type="button" onClick={() => handleAction('reveal')} disabled={isPending} className="shrink-0 text-gray-600 hover:text-gray-800 disabled:opacity-50" title="Show in folder" aria-label="Show in folder">
            <FolderOpen size={16} />
          </button>
        </div>
        {message ? <p role="status" className="mt-1 max-w-[13rem] break-words text-xs leading-4 text-red-600">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="max-w-[18rem] truncate text-sm text-gray-700" title={record.sourceFileName || 'Recorded Word document'}>
          {record.sourceFileName || 'Recorded Word document'}
        </span>
        <button type="button" onClick={() => handleAction('open')} disabled={isPending} className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-sm text-blue-700 hover:bg-blue-200 disabled:opacity-50">
          <FileText size={14} /> Open document
        </button>
        <button type="button" onClick={() => handleAction('reveal')} disabled={isPending} className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50">
          <FolderOpen size={14} /> Show in folder
        </button>
      </div>
      {message ? <p role="status" className="max-w-xl break-words text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
