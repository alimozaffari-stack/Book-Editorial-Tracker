import { useMemo, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { Chapter, ChapterStage } from '../types';
import {
  buildCompileManuscriptRequest,
  compilerStageOptions,
  defaultCompilerStages,
  latestCompilerSource,
} from '../domain/manuscriptCompiler';

interface CompileManuscriptModalProps {
  chapters: Chapter[];
  projectName: string;
  onClose: () => void;
}

export default function CompileManuscriptModal({ chapters, projectName, onClose }: CompileManuscriptModalProps) {
  const [format, setFormat] = useState<CompileManuscriptFormat>('docx');
  const [selectedStages, setSelectedStages] = useState<Set<ChapterStage>>(() => new Set(defaultCompilerStages));
  const [includeAbstracts, setIncludeAbstracts] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const templateInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [savedPath, setSavedPath] = useState('');

  const sourceCount = useMemo(
    () => chapters.filter(chapter => latestCompilerSource(chapter, selectedStages)).length,
    [chapters, selectedStages],
  );

  const toggleStage = (stage: ChapterStage) => {
    setSelectedStages(current => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
    setMessage('');
    setSavedPath('');
  };

  const compile = async () => {
    if (selectedStages.size === 0) {
      setMessage('Select at least one source stage.');
      return;
    }
    if (sourceCount === 0) {
      setMessage('No active source files match the selected stages.');
      return;
    }
    if (!window.editorialTracker?.compileManuscript) {
      setMessage('Manuscript compilation is available in the desktop application only.');
      return;
    }
    setBusy(true);
    setMessage('');
    setSavedPath('');
    try {
      const request = buildCompileManuscriptRequest(
        chapters, projectName, format, selectedStages, includeAbstracts, includeMetadata,
      );
      if (format === 'docx' && templateFile) {
        request.template = { fileName: templateFile.name, bytes: new Uint8Array(await templateFile.arrayBuffer()) };
      }
      const result = await window.editorialTracker.compileManuscript(request);
      if (result.cancelled) {
        setMessage('Save cancelled.');
        return;
      }
      setSavedPath(result.filePath ?? '');
      const omitted = chapters.length - result.includedChapters;
      setMessage(`Compiled ${result.includedChapters} chapter${result.includedChapters === 1 ? '' : 's'}${omitted ? `; ${omitted} without a matching source omitted` : ''}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The manuscript could not be compiled.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="compile-manuscript-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 id="compile-manuscript-title" className="text-xl font-semibold text-gray-900">Compile Manuscript</h2>
            <p className="mt-1 text-sm text-gray-600">Combine the latest active source in the selected stages for each chapter.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close compiler" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-6 px-6 py-5">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-gray-900">Export format</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ['md', 'Combined Markdown', '.md'],
                ['docx', 'Combined Word document', '.docx'],
                ['zip', 'Latest source files', '.zip'],
              ] as const).map(([value, label, extension]) => (
                <label key={value} className={`cursor-pointer rounded-xl border p-3 ${format === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                  <input type="radio" name="compile-format" value={value} checked={format === value} onChange={() => setFormat(value)} className="mr-2" />
                  <span className="text-sm font-medium text-gray-900">{label}</span>
                  <span className="mt-1 block pl-5 text-xs text-gray-500">{extension}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {format === 'docx' && (
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">Word template (optional)</p>
              <input ref={templateInput} type="file" accept=".docx,.dotx" className="hidden" onChange={event => {
                const file = event.target.files?.[0];
                if (!file) return;
                event.target.value = '';
                if (!/\.(docx|dotx)$/i.test(file.name) || file.size > 25 * 1024 * 1024 || file.size < 100) {
                  setMessage('Choose a .docx or .dotx template smaller than 25 MiB. Macro-enabled templates are not supported.');
                  return;
                }
                setTemplateFile(file);
                setMessage('');
              }} />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="button" disabled={busy} onClick={() => templateInput.current?.click()} className="rounded-lg border px-3 py-2 text-sm">
                  Choose template
                </button>
                {templateFile && <>
                  <span className="text-sm text-gray-700">{templateFile.name}</span>
                  <button type="button" disabled={busy} onClick={() => setTemplateFile(null)} className="text-sm underline">Remove</button>
                </>}
              </div>
              <p className="mt-2 text-xs text-gray-600">Applies only to the generated document. Source files are not changed. Word automation and Normal.dotm are not used.</p>
            </div>
          )}
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-gray-900">Eligible source stages</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {compilerStageOptions.map(option => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={selectedStages.has(option.value)} onChange={() => toggleStage(option.value)} className="rounded border-gray-300 text-indigo-600" />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-gray-900">Include</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={includeAbstracts} onChange={event => setIncludeAbstracts(event.target.checked)} /> Chapter abstracts</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={includeMetadata} onChange={event => setIncludeMetadata(event.target.checked)} /> Chapter and source metadata</label>
            </div>
          </fieldset>

          <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {sourceCount} of {chapters.length} chapter{chapters.length === 1 ? '' : 's'} currently have a matching source file.
          </p>
          {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
          {savedPath && window.editorialTracker?.openFolderForFile && (
            <button type="button" onClick={() => void window.editorialTracker?.openFolderForFile(savedPath)} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">Show saved file</button>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
          <button type="button" onClick={compile} disabled={busy || sourceCount === 0} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" /> {busy ? 'Compiling…' : 'Compile and save'}
          </button>
        </div>
      </div>
    </div>
  );
}
