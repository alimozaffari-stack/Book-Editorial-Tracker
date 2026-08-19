import { useEffect, useRef, useState } from 'react';
import { ChapterStage, ChapterStageRecord } from '../types';
import { inspectDocx, InspectionResult } from '../utils/docxInspection';
import { createSubmissionRecord } from '../utils/submissionUtils';
import { isCalendarDate } from '../domain/chapterValidation';

const STAGES: Array<{ value: ChapterStage; label: string }> = [
  { value: 'abstract', label: 'Abstract' },
  { value: 'initial-manuscript', label: 'Initial manuscript' },
  { value: 'feedback-sent', label: 'Feedback sent' },
  { value: 'revision', label: 'Revision' },
  { value: 'final-manuscript', label: 'Final manuscript' },
  { value: 'publisher-submission', label: 'Publisher submission' },
  { value: 'typeset-submission', label: 'Typeset submission' },
];

export interface StageIntakeValues { stage: ChapterStage; round: string; effectiveOn: string; wordCount: string; }

export function inferStageFromFileName(fileName: string): { stage: ChapterStage; round?: number } {
  const name = fileName.toLowerCase();
  const roundMatch = /(?:feedback|revision|rev)[ _-]*0*(\d+)/i.exec(fileName)?.[1];
  const round = roundMatch === undefined ? undefined : Number(roundMatch);
  if (name.includes('typeset')) return { stage: 'typeset-submission' };
  if (name.includes('publisher')) return { stage: 'publisher-submission' };
  if (name.includes('final')) return { stage: 'final-manuscript' };
  if (name.includes('feedback')) return { stage: 'feedback-sent', round };
  if (name.includes('revision') || /\brev\s*0*\d+/i.test(fileName)) return { stage: 'revision', round };
  if (name.includes('abstract')) return { stage: 'abstract' };
  return { stage: 'initial-manuscript' };
}

export function validateStageIntake(values: StageIntakeValues): { field?: 'round' | 'effectiveOn' | 'wordCount'; message?: string } {
  if (values.stage === 'revision' && (!/^\d+$/.test(values.round) || Number(values.round) < 1)) return { field: 'round', message: 'Enter a whole-number revision round of 1 or more.' };
  if (values.stage === 'feedback-sent' && (!/^\d+$/.test(values.round) || Number(values.round) < 0)) return { field: 'round', message: 'Enter a whole-number feedback round of 0 or more.' };
  if (!isCalendarDate(values.effectiveOn)) return { field: 'effectiveOn', message: 'Confirm a valid calendar date.' };
  if (!/^\d+$/.test(values.wordCount) || Number(values.wordCount) < 0) return { field: 'wordCount', message: 'Enter a valid whole-number word count.' };
  return {};
}

interface Props {
  onAdd: (record: ChapterStageRecord) => Promise<{ ok: boolean; message?: string }>;
  onClose: () => void;
  recordedBy: string;
}

export function StageIntakeDialog({ onAdd, onClose, recordedBy }: Props) {
  const [file, setFile] = useState<SelectedDocx | null>(null);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [stage, setStage] = useState<ChapterStage>('initial-manuscript');
  const [round, setRound] = useState('');
  const [date, setDate] = useState('');
  const [words, setWords] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const roundRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const wordsRef = useRef<HTMLInputElement>(null);

  const clearAndClose = () => {
    if (busy) return;
    setFile(null);
    setInspection(null);
    onClose();
  };

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) clearAndClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  });

  const choose = async () => {
    if (!window.editorialTracker) { setError('Choose Word document is available in the desktop app only.'); return; }
    setBusy(true); setError(''); setFile(null); setInspection(null);
    try {
      const selected = await window.editorialTracker.selectDocx();
      if (!selected) return;
      const result = await inspectDocx(selected.bytes);
      if (!result.valid) { setError(`Nothing was saved. ${result.errors.join(' ')}`); return; }
      const inferred = inferStageFromFileName(selected.fileName);
      setFile(selected); setInspection(result); setStage(inferred.stage); setRound(inferred.round === undefined ? '' : String(inferred.round));
      setWords(String(result.calculatedWordCount));
      setDate((result.documentModifiedAt ?? selected.filesystemModifiedAt).slice(0, 10));
    } catch {
      setError('Nothing was saved. The selected Word document could not be inspected. Choose another file and try again.');
    } finally { setBusy(false); }
  };

  const add = async () => {
    if (!file || !inspection) { setError('Choose a Word document first.'); return; }
    const validation = validateStageIntake({ stage, round, effectiveOn: date, wordCount: words });
    if (validation.message) {
      setError(validation.message);
      ({ round: roundRef, effectiveOn: dateRef, wordCount: wordsRef }[validation.field!]).current?.focus();
      return;
    }
    setBusy(true); setError('');
    try {
      const outcome = await onAdd(createSubmissionRecord({
        stage, revisionNumber: round ? Number(round) : undefined, sourceFileName: file.fileName,
        sourceSizeBytes: file.sizeBytes, sourceSha256: file.sha256, filesystemCreatedAt: file.filesystemCreatedAt,
        filesystemModifiedAt: file.filesystemModifiedAt, documentCreatedAt: inspection.documentCreatedAt,
        documentModifiedAt: inspection.documentModifiedAt, documentTitle: inspection.documentTitle,
        documentCreator: inspection.documentCreator, calculatedWordCount: inspection.calculatedWordCount,
        wordCount: Number(words), wordCountSource: words === String(inspection.calculatedWordCount) ? inspection.wordCountSource : 'manual',
        submittedOn: date, recordedBy,
      }));
      if (!outcome.ok) { setError(outcome.message ?? 'Nothing was saved — reload the latest chapter and try again.'); return; }
      setFile(null); setInspection(null); onClose();
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="stage-intake-title"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6">
    <h2 id="stage-intake-title" className="text-xl font-semibold">Add stage file</h2><p className="mt-1 text-sm text-gray-600">Choose one Word document, review the detected details, then confirm.</p>
    <button onClick={choose} disabled={busy} className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{busy && !file ? 'Inspecting…' : 'Choose Word document'}</button>
    {file && inspection && <><div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm"><p className="font-medium">{file.fileName}</p><p className="mt-1 text-gray-600">Proposed: {STAGES.find(item => item.value === stage)?.label} · {words} words · {date}</p></div><details className="mt-3 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">File details</summary><dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-gray-600"><dt>Size</dt><dd>{file.sizeBytes.toLocaleString()} bytes</dd><dt>SHA-256</dt><dd className="break-all font-mono text-xs">{file.sha256}</dd><dt>File created</dt><dd>{file.filesystemCreatedAt ?? 'Not available'}</dd><dt>File modified</dt><dd>{file.filesystemModifiedAt}</dd><dt>Document created</dt><dd>{inspection.documentCreatedAt ?? 'Not available'}</dd><dt>Document modified</dt><dd>{inspection.documentModifiedAt ?? 'Not available'}</dd><dt>Creator</dt><dd>{inspection.documentCreator ?? 'Not available'}</dd><dt>Title</dt><dd>{inspection.documentTitle ?? 'Not available'}</dd><dt>Calculated words</dt><dd>{inspection.calculatedWordCount}</dd></dl></details></>}
    <label className="mt-4 block text-sm">Stage<select value={stage} onChange={event => setStage(event.target.value as ChapterStage)} disabled={busy} className="mt-1 w-full border p-2">{STAGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    {(stage === 'revision' || stage === 'feedback-sent') && <label className="mt-3 block text-sm">Round<input ref={roundRef} type="number" min={stage === 'feedback-sent' ? 0 : 1} step="1" value={round} onChange={event => setRound(event.target.value)} disabled={busy} className="mt-1 w-full border p-2" /></label>}
    <label className="mt-3 block text-sm">Effective date<input ref={dateRef} type="date" value={date} onChange={event => setDate(event.target.value)} disabled={busy} className="mt-1 w-full border p-2" /></label><label className="mt-3 block text-sm">Word count<input ref={wordsRef} type="number" min="0" step="1" value={words} onChange={event => setWords(event.target.value)} disabled={busy} className="mt-1 w-full border p-2" /></label>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-3"><button onClick={clearAndClose} disabled={busy}>Cancel</button><button onClick={add} disabled={busy || !file} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{busy && file ? 'Adding…' : 'Add stage record'}</button></div>
  </div></div>;
}
