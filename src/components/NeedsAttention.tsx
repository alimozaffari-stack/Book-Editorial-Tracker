import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Chapter } from '../types';
import { abstractStatusReconciliationIds, deriveChapterProgress } from '../domain/chapterProgress';
import { MetadataReconciliationDialog } from './MetadataReconciliationDialog';

interface NeedsAttentionProps {
  chapters: Chapter[];
  onOpenChapter: (chapter: Chapter) => void;
  canEdit: boolean;
  onReconcileAbstractStatuses: (chapterIds: string[]) => Promise<void>;
}

export function NeedsAttention({ chapters, onOpenChapter, canEdit, onReconcileAbstractStatuses }: NeedsAttentionProps) {
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [reconciliationMessage, setReconciliationMessage] = useState('');
  const entries = chapters.map(chapter => ({ chapter, discrepancies: deriveChapterProgress(chapter).discrepancies })).filter(entry => entry.discrepancies.length);
  const blocking = entries.map(entry => ({ ...entry, discrepancies: entry.discrepancies.filter(discrepancy => discrepancy.severity === 'blocking') })).filter(entry => entry.discrepancies.length);
  const cleanup = entries.map(entry => ({ ...entry, discrepancies: entry.discrepancies.filter(discrepancy => discrepancy.severity === 'cleanup') })).filter(entry => entry.discrepancies.length);
  const reconciliationIds = abstractStatusReconciliationIds(chapters);
  if (!entries.length) return <p className="text-sm text-emerald-700" role="status">Everything is consistent.</p>;

  const renderChapterChecks = (group: typeof blocking, tone: 'red' | 'amber') => <ul className="mt-3 space-y-3">
    {group.map(({ chapter, discrepancies }) => <li key={chapter.id} className={`rounded-lg border p-3 ${tone === 'red' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex justify-between gap-3"><strong className="text-sm text-gray-900">{chapter.id} — {chapter.title}</strong><button className="shrink-0 underline text-sm font-medium" onClick={() => onOpenChapter(chapter)}>Open chapter</button></div>
      <ul className="mt-2 space-y-1 text-sm text-gray-800">{discrepancies.map(discrepancy => <li key={`${chapter.id}-${discrepancy.code}`}>{discrepancy.message}</li>)}</ul>
    </li>)}
  </ul>;

  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="workflow-checks-heading">
    <h2 id="workflow-checks-heading" className="font-semibold text-amber-900 flex gap-2"><AlertTriangle className="w-5 h-5" />Workflow and data checks</h2>
    {blocking.length > 0 && <div className="mt-4"><h3 className="font-medium text-red-900">Resolve first</h3>{renderChapterChecks(blocking, 'red')}</div>}
    {cleanup.length > 0 && <div className="mt-4"><h3 className="font-medium text-amber-900">Imported metadata to review</h3>{renderChapterChecks(cleanup, 'amber')}
      {canEdit && reconciliationIds.length > 0 && <button type="button" className="mt-3 underline text-sm font-medium text-indigo-700" onClick={() => { setReconciliationMessage(''); setIsReconcileOpen(true); }}>Reconcile imported abstract statuses</button>}
      {reconciliationMessage && <p className="mt-3 text-sm text-emerald-800" role="status">{reconciliationMessage}</p>}
    </div>}
    {isReconcileOpen && <MetadataReconciliationDialog chapterIds={reconciliationIds} onConfirm={onReconcileAbstractStatuses} onClose={() => setIsReconcileOpen(false)} onSuccess={() => { setIsReconcileOpen(false); setReconciliationMessage(`Updated imported abstract status for ${reconciliationIds.length} chapter${reconciliationIds.length === 1 ? '' : 's'}.`); }} />}
  </section>;
}
