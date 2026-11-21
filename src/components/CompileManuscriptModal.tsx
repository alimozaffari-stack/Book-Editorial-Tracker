import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FolderSearch, X } from 'lucide-react';
import type { Chapter, ChapterStage } from '../types';
import {
  buildCompileManuscriptRequest,
  compilerStageOptions,
  defaultCompilerStages,
  latestCompilerSource,
} from '../domain/manuscriptCompiler';

const allCompilerStages = new Set(compilerStageOptions.map(option => option.value));
const formatNames: Record<CompileManuscriptFormat, string> = { docx: 'Word', md: 'Markdown', zip: 'ZIP' };
const formatHelp: Record<CompileManuscriptFormat, string> = {
  docx: 'Combines the selected chapters into one editable Word document.',
  md: 'Combines the selected chapters into one plain-text Markdown file.',
  zip: 'Packages a copy of each selected source document in a ZIP archive.',
};

interface CompileManuscriptModalProps {
  chapters: Chapter[];
  projectName: string;
  onClose: () => void;
}

export default function CompileManuscriptModal({ chapters, projectName, onClose }: CompileManuscriptModalProps) {
  const [format, setFormat] = useState<CompileManuscriptFormat>('docx');
  const [template, setTemplate] = useState<File | null>(null);
  const [selectedStages, setSelectedStages] = useState<Set<ChapterStage>>(() => new Set(defaultCompilerStages));
  const [includeAbstracts, setIncludeAbstracts] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [legacyFolderToken, setLegacyFolderToken] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [unavailableSource, setUnavailableSource] = useState<CompileManuscriptResult['unavailableSource']>(undefined);
  const [missingFiles, setMissingFiles] = useState<NonNullable<CompileManuscriptResult['unavailableSources']>>([]);
  const [savedPath, setSavedPath] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const templateInput = useRef<HTMLInputElement>(null);
  const locateButton = useRef<HTMLButtonElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const focusAfterRecovery = useRef(false);
  const working = busy || locating;

  const omittedChapters = useMemo(
    () => chapters.filter(chapter => !latestCompilerSource(chapter, selectedStages)),
    [chapters, selectedStages],
  );
  const sourceCount = chapters.length - omittedChapters.length;
  const blockedReason = selectedStages.size === 0
    ? 'Select at least one stage under Source and content options.'
    : sourceCount === 0
      ? 'No sources match these stages. Change the stages or attach a Word document to a chapter.'
      : '';
  const hasRecordedHash = /^[a-f0-9]{64}$/i.test(unavailableSource?.source.sourceSha256 ?? '');
  const locateLabel = hasRecordedHash ? 'Locate source file' : 'Choose source folder';
  const saveLabel = sourceCount
    ? `Save ${sourceCount} chapter${sourceCount === 1 ? '' : 's'} as ${formatNames[format]}`
    : 'Save export';
  const [checkVersion, setCheckVersion] = useState(0);
  const checkRequest = useMemo(() => ({ chapters, projectName, selectedStages, legacyFolderToken, checkVersion }),
    [chapters, projectName, selectedStages, legacyFolderToken, checkVersion]);
  const [checked, setChecked] = useState<typeof checkRequest | undefined>(undefined);
  const [checkError, setCheckError] = useState('');
  const checking = !blockedReason && checked !== checkRequest;
  useEffect(() => {
    let active = true;
    setCheckError('');
    setMissingFiles([]);
    setUnavailableSource(undefined);
    if (!blockedReason) {
      const verify = async () => {
        try {
          if (!window.editorialTracker?.checkCompilerSources) throw new Error('Open the desktop app to check source files.');
          const request = buildCompileManuscriptRequest(checkRequest.chapters, checkRequest.projectName, 'docx', checkRequest.selectedStages, false, false);
          const result = await window.editorialTracker.checkCompilerSources({ ...request, legacyFolderToken: checkRequest.legacyFolderToken });
          if (active) {
            setUnavailableSource(result.unavailableSource);
            setMissingFiles(result.unavailableSources ?? []);
          }
        } catch (error) {
          if (active) setCheckError(error instanceof Error ? error.message : 'Source availability could not be checked.');

        } finally {
          if (active) setChecked(checkRequest);
        }
      };
      void verify();
    }
    return () => { active = false; };
  }, [checkRequest, blockedReason]);
  const saveDisabled = working || checking || Boolean(checkError || unavailableSource || blockedReason);
  const saveAppearance = saveDisabled
    ? 'cursor-not-allowed bg-gray-100 text-gray-600'
    : unavailableSource
      ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
      : 'bg-indigo-700 text-white hover:bg-indigo-800';

  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  useEffect(() => {
    if (!focusAfterRecovery.current || checking || locating) return;
    focusAfterRecovery.current = false;
    if (unavailableSource) locateButton.current?.focus();
    else if (!saveDisabled) saveButton.current?.focus();
  }, [unavailableSource, checking, locating, saveDisabled]);

  const close = () => {
    if (working) return;
    dialog.current?.close();
    onClose();
  };

  const clearResult = () => {
    setMessage('');
    setSavedPath('');
  };

  const toggleStage = (stage: ChapterStage) => {
    setSelectedStages(current => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
    clearResult();
    setUnavailableSource(undefined);
  };

  const compile = async () => {
    if (saveDisabled) return;
    if (!window.editorialTracker?.compileManuscript) {
      setMessage('Manuscript compilation is available in the desktop application only.');
      return;
    }
    setBusy(true);
    clearResult();
    setUnavailableSource(undefined);
    try {
      const request = buildCompileManuscriptRequest(
        chapters, projectName, format, selectedStages, includeAbstracts, includeMetadata,
      );
      request.legacyFolderToken = legacyFolderToken;
      if (format === 'docx' && template) {
        request.template = { fileName: template.name, bytes: new Uint8Array(await template.arrayBuffer()) };
      }
      const result = await window.editorialTracker.compileManuscript(request);
      if (result.unavailableSource) {
        setUnavailableSource(result.unavailableSource);
        return;
      }
      if (result.cancelled) {
        setMessage('Save cancelled.');
        return;
      }
      setSavedPath(result.filePath ?? '');
      const omitted = chapters.length - result.includedChapters;
      setMessage(`Saved ${result.includedChapters} chapter${result.includedChapters === 1 ? '' : 's'}. ${omitted ? `${omitted} omitted.` : ''}`.trim());
    } catch (error) {
      const detail = error instanceof Error
        ? error.message.replace(/^Error invoking remote method 'compile-manuscript': (?:Error: )?/, '')
        : '';
      setMessage(detail || 'The manuscript could not be compiled.');
    } finally {
      setBusy(false);
    }
  };

  const locateSource = async () => {
    if (working || !unavailableSource || !window.editorialTracker?.locateCompilerSource) return;
    setLocating(true);
    setMessage('');
    try {
      const { sourceRelativePath, sourceSha256 } = unavailableSource.source;
      const result = await window.editorialTracker.locateCompilerSource({ sourceRelativePath, sourceSha256 });
      if (result.status === 'located') {
        if (result.legacyFolderToken) setLegacyFolderToken(result.legacyFolderToken);
        setMessage('');
        setCheckVersion(value => value + 1);
        setUnavailableSource(undefined);
        focusAfterRecovery.current = true;
      } else if (result.status === 'error') {
        setMessage(result.message);
      }
    } catch {
      setMessage('The source location could not be saved. Try choosing the source again.');
    } finally {
      setLocating(false);
    }
  };

  const recoveryMessage = unavailableSource
    ? `Source unavailable for ${unavailableSource.chapterId}${unavailableSource.source.sourceFileName ? ` · ${unavailableSource.source.sourceFileName}` : ''}.`
    : '';
  const footerMessage = busy ? 'Checking sources and preparing the export…'
    : locating ? 'Checking the selected source…'
      : checking ? 'Checking selected source files…' : checkError || recoveryMessage || blockedReason || message || 'All selected source files are available.';

  return (
    <dialog
      ref={dialog}
      onCancel={event => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-2xl overflow-hidden rounded-2xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-gray-950/50"
      aria-labelledby="compile-manuscript-title"
    >
      <div className="flex max-h-[calc(100dvh_-_2rem)] flex-col">
        <div className="flex shrink-0 items-start justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 id="compile-manuscript-title" className="text-xl font-semibold text-gray-900">Compile Manuscript</h2>
            <p className="mt-1 text-sm text-gray-600">Use the latest linked document from the stages you choose.</p>
          </div>
          <button type="button" onClick={close} disabled={working} aria-label="Close compiler" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><X aria-hidden="true" className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p>{sourceCount} of {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} linked to a source in the selected stages.</p>
            {selectedStages.size > 0 && omittedChapters.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">{omittedChapters.length} chapter{omittedChapters.length === 1 ? '' : 's'} will be omitted</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {omittedChapters.map(chapter => (
                    <li key={chapter.id}>
                      <span className="font-medium">{chapter.id} · {chapter.title}</span>
                      <span className="block text-gray-600">
                        {latestCompilerSource(chapter, allCompilerStages) ? 'Source is in an unselected stage.' : 'No active manuscript source is linked.'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          {missingFiles.length > 1 && <section aria-labelledby="missing-sources-title" className="rounded-lg border border-amber-200 px-4 py-3">
            <h3 id="missing-sources-title" className="text-sm font-semibold text-amber-900">{missingFiles.length} chapter sources to locate</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">{missingFiles.map(file =>
              <li key={file.chapterId}>{file.chapterId} · {file.source.sourceFileName || file.source.sourceRelativePath || 'Word document'}</li>)}</ul>
          </section>}
          <fieldset disabled={working} aria-describedby="export-format-help">
            <legend className="mb-2 text-sm font-semibold text-gray-900">Export format</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ['docx', 'Word document', '.docx'],
                ['md', 'Markdown', '.md'],
                ['zip', 'Source files', '.zip'],
              ] as const).map(([value, label, extension]) => (
                <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${format === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                  <input type="radio" name="compile-format" value={value} checked={format === value} onChange={() => { setFormat(value); clearResult(); }} />
                  <span className="text-sm font-medium text-gray-900">{label} <span className="text-xs font-normal text-gray-600">{extension}</span></span>
                </label>
              ))}
            </div>
            <p id="export-format-help" role="status" className="mt-2 text-sm text-gray-600">{formatHelp[format]}</p>
          </fieldset>

          {format === 'docx' && (
            <fieldset disabled={working} className="rounded-lg border border-gray-200 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-900">Word template (optional)</legend>
              <p className="text-sm text-gray-700">
                Use a .docx or .dotx for page layout and matching Word styles. Chapter-specific styles and direct formatting can carry through.
              </p>
              <input ref={templateInput} type="file" accept=".docx,.dotx" className="hidden" onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                clearResult();
                if (!/^[^\\/]{1,255}\.(docx|dotx)$/i.test(file.name) || file.size < 100 || file.size > 25 * 1024 * 1024) {
                  setMessage('Choose a .docx or .dotx template up to 25 MiB.');
                  return;
                }
                setTemplate(file);
              }} />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => templateInput.current?.click()} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">Choose Word template</button>
                {template && <>
                  <span className="min-w-0 break-all text-sm text-gray-700" role="status">{template.name}</span>
                  <button type="button" onClick={() => { setTemplate(null); clearResult(); }} className="text-sm text-indigo-700 underline">Remove template</button>
                </>}
              </div>
            </fieldset>
          )}

          <details className="rounded-lg border border-gray-200 px-4 py-3">
            <summary className="cursor-pointer rounded text-sm font-semibold text-gray-900">Source and content options</summary>
            <fieldset disabled={working} className="mt-4">
              <legend className="mb-2 text-sm font-medium text-gray-900">Which stages can supply a document?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {compilerStageOptions.map(option => (
                  <label key={option.value} className="flex min-h-7 items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={selectedStages.has(option.value)} onChange={() => toggleStage(option.value)} className="rounded border-gray-300 text-indigo-600" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={working} className="mt-4">
              <legend className="mb-2 text-sm font-medium text-gray-900">Extra content</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={includeAbstracts} onChange={event => { setIncludeAbstracts(event.target.checked); clearResult(); }} /> Chapter abstracts</label>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={includeMetadata} onChange={event => { setIncludeMetadata(event.target.checked); clearResult(); }} /> Chapter and source metadata</label>
              </div>
            </fieldset>
          </details>

        </div>
        <div className="shrink-0 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div id="compile-status" role="status" className={footerMessage ? 'mb-3 max-h-[20dvh] overflow-y-auto break-words text-sm text-gray-700' : 'sr-only'}>
            <p className={unavailableSource && !locating ? 'font-medium text-amber-900' : ''}>{missingFiles.length > 1 && unavailableSource ? `${missingFiles.length} sources missing. ` : ''}{footerMessage}</p>
            {unavailableSource && !locating && (
              <p className="mt-1">{message || (hasRecordedHash
                ? 'Choose the original Word file. Your export settings are kept.'
                : 'Choose the folder containing the chapter subfolders.')}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {checkError && <button type="button" onClick={() => setCheckVersion(value => value + 1)} className="rounded px-3 py-2 text-sm font-medium text-indigo-700">Check again</button>}
            {savedPath && window.editorialTracker?.openFolderForFile && (
              <button type="button" onClick={() => void window.editorialTracker?.openFolderForFile(savedPath)} className="mr-auto text-sm font-medium text-indigo-700 hover:text-indigo-900">Show saved file</button>
            )}
            <button type="button" onClick={close} disabled={working} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
            {unavailableSource && window.editorialTracker?.locateCompilerSource && (
              <button ref={locateButton} type="button" onClick={locateSource} aria-disabled={working} aria-describedby="compile-status" className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 aria-disabled:opacity-60">
                <FolderSearch aria-hidden="true" className="h-4 w-4" /> {locating ? 'Checking source…' : locateLabel}
              </button>
            )}
            <button ref={saveButton} type="button" onClick={compile} disabled={saveDisabled} aria-describedby={footerMessage ? 'compile-status' : undefined} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${saveAppearance}`}>
              <Download aria-hidden="true" className="h-4 w-4" /> {busy ? 'Preparing export…' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
