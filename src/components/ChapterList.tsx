import React, { useEffect, useRef, useState } from "react";
import { Chapter } from "../types";
import {
  Edit,
  ExternalLink,
  CheckSquare,
  History,
  Trash2,
  AlertTriangle,
  BookOpen,
  Columns3,
} from "lucide-react";
import { ChapterIntake } from "./ChapterIntake";
import { deriveChapterProgress } from "../domain/chapterProgress";
import StageSourceActions, { hasStageSourceReference } from "./StageSourceActions";
import CompileManuscriptModal from "./CompileManuscriptModal";

const secondaryColumns = [
  ["bio", "Bio"],
  ["contact", "Contact person"],
  ["words", "Word count"],
  ["submission", "Submission location"],
  ["feedback", "Feedback link"],
] as const;
type SecondaryColumn = (typeof secondaryColumns)[number][0];
const chapterColumnPreference = "book-editorial-tracker.hidden-chapter-columns";

function readHiddenColumns(): Set<SecondaryColumn> {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(chapterColumnPreference) ?? "[]");
    return new Set(secondaryColumns.flatMap(([key]) => Array.isArray(stored) && stored.includes(key) ? [key] : []));
  } catch {
    return new Set();
  }
}

interface ChapterListProps {
  chapters: Chapter[];
  onEdit: (chapter: Chapter) => void;
  onBatchUpdate: (
    ids: string[],
    field: keyof Chapter,
    value: string,
  ) => Promise<void>;
  onCreate: (
    chapters: Chapter[],
    source: "manual-entry" | "csv-import" | "backup-import",
  ) => Promise<{ created: string[]; skipped: string[] }>;
  onDelete: (chapters: Chapter[]) => Promise<void>;
  onImportChapters: () => void;
  projectName: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function ChapterList({
  chapters,
  onEdit,
  onBatchUpdate,
  onCreate,
  onDelete,
  onImportChapters,
  projectName,
  canEdit,
  canDelete,
}: ChapterListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchField, setBatchField] = useState<keyof Chapter | "">("");
  const [batchValue, setBatchValue] = useState<string>("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [showCompiler, setShowCompiler] = useState(false);
  const compileButton = useRef<HTMLButtonElement>(null);
  const tableViewport = useRef<HTMLDivElement>(null);
  const [tableOverflows, setTableOverflows] = useState(false);
  const [search, setSearch] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState(readHiddenColumns);

  useEffect(() => {
    try {
      const serialized = JSON.stringify([...hiddenColumns]);
      if (window.sessionStorage.getItem(chapterColumnPreference) !== serialized) {
        window.sessionStorage.setItem(chapterColumnPreference, serialized);
      }
    } catch {
      // Column controls remain usable when local preferences are unavailable.
    }
  }, [hiddenColumns]);
  const query = search.trim().toLowerCase();
  const visibleChapters = query
    ? chapters.filter(chapter =>
        [chapter.id, chapter.title, chapter.contributorName].some(
          value => value?.toLowerCase().includes(query),
        ),
      )
    : chapters;
  const hasVisibleChapters = visibleChapters.length > 0;

  useEffect(() => {
    const viewport = tableViewport.current;
    const table = viewport?.firstElementChild;
    if (!viewport || !table) return;
    const measure = () => setTableOverflows(viewport.scrollWidth > viewport.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(table);
    measure();
    return () => observer.disconnect();
  }, [hasVisibleChapters]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(visibleChapters.map((chapter) => chapter.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleApplyBatch = async () => {
    if (batchField && batchValue && selectedIds.size > 0) {
      setBatchBusy(true);
      setBatchMessage("");
      try {
        await onBatchUpdate(Array.from(selectedIds), batchField, batchValue);
        setSelectedIds(new Set());
        setBatchField("");
        setBatchValue("");
        setBatchMessage("Selected chapters updated.");
      } catch {
        setBatchMessage(
          "Nothing was changed. Check your connection and try again.",
        );
      } finally {
        setBatchBusy(false);
      }
    }
  };

  const handleDeleteSelected = async () => {
    const selectedChapters = chapters.filter((chapter) =>
      selectedIds.has(chapter.id),
    );
    if (!selectedChapters.length) return;
    const message =
      selectedChapters.length === 1
        ? `Delete ${selectedChapters[0].id}: ${selectedChapters[0].title}? This removes its tracker record.`
        : `Delete ${selectedChapters.length} selected chapters? This removes their tracker records.`;
    if (!window.confirm(message + " You can undo this while the project is open.")) return;
    await deleteChapters(selectedChapters);
  };

  const deleteChapters = async (selectedChapters: Chapter[]) => {
    setDeleteBusy(true);
    setDeleteMessage("");
    try {
      await onDelete(selectedChapters);
      setSelectedIds((current) => {
        const next = new Set(current);
        selectedChapters.forEach((chapter) => next.delete(chapter.id));
        return next;
      });
      setDeleteMessage("");
    } catch {
      setDeleteMessage(
        "Nothing was deleted. Reload the latest chapters and try again.",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {showCompiler && <CompileManuscriptModal chapters={chapters} projectName={projectName} onClose={() => {
        setShowCompiler(false);
        compileButton.current?.focus();
      }} />}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Chapters</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button ref={compileButton} type="button" onClick={() => setShowCompiler(true)} disabled={chapters.length === 0} aria-describedby={chapters.length === 0 ? "chapter-list-empty-help" : undefined} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
            <BookOpen className="h-4 w-4" /> Compile Manuscript
          </button>
          {canEdit && <ChapterIntake existingChapters={chapters} onCreate={onCreate} />}
        </div>
      </div>

      {chapters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-2">
          <label className="block w-full max-w-xs text-sm font-medium text-gray-700">
            Find chapters
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedIds(new Set());
              }}
              placeholder="Chapter ID, title or contributor"
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 placeholder:text-gray-600"
            />
          </label>
          <p role="status" className={query ? "pb-2 text-sm text-gray-600" : "sr-only"}>
            {query && `${visibleChapters.length} of ${chapters.length} chapters`}
          </p>
          {visibleChapters.length > 0 && (
            <details className="relative ml-auto">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                <Columns3 aria-hidden="true" className="h-4 w-4" /> Columns
              </summary>
              <fieldset aria-label="Visible chapter columns" className="absolute right-0 z-20 mt-2 grid w-52 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                {secondaryColumns.map(([key, label]) => (
                  <label key={key} className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 text-sm text-gray-800 hover:bg-gray-50">
                    <input type="checkbox" checked={!hiddenColumns.has(key)} onChange={event => {
                      const checked = event.target.checked;
                      setHiddenColumns(current => {
                        const next = new Set(current);
                        if (checked) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }} />
                    {label}
                  </label>
                ))}
              </fieldset>
            </details>
          )}
        </div>
      )}

      {canEdit && selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center text-indigo-800 font-medium">
            <CheckSquare className="w-5 h-5 mr-2" />
            {selectedIds.size} chapter{selectedIds.size > 1 ? "s" : ""} selected
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Field to update"
              value={batchField}
              disabled={batchBusy || deleteBusy}
              onChange={event => {
                setBatchField(event.target.value as keyof Chapter);
                setBatchValue("");
              }}
              className="px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">Select field to update...</option>
              <option value="initialAbstractSubmitted">
                Abstract Submitted
              </option>
              <option value="initialChapterSubmission">
                Chapter Submitted
              </option>
              <option value="feedbackSent">Feedback Sent</option>
              <option value="revision01Submitted">Revision Submitted</option>
              <option value="imageListSubmitted">Images Submitted</option>
              <option value="indexingTermsSubmitted">Indexing Terms</option>
              <option value="biographicalStatement">
                Biographical Statement
              </option>
              <option value="leadEditor">Contact Person</option>
            </select>
            <select
              aria-label="New field value"
              value={batchValue}
              disabled={!batchField || batchBusy || deleteBusy}
              onChange={(e) => setBatchValue(e.target.value)}
              className="px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">Select value...</option>
              {batchField === "leadEditor" ? (
                <>
                  <option value="Ali Mozaffari">Ali Mozaffari</option>
                  <option value="David Harvey">David Harvey</option>
                  <option value="Jeremy Smith">Jeremy Smith</option>
                </>
              ) : (
                <>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="N/A">N/A</option>
                </>
              )}
            </select>
            <button
              onClick={handleApplyBatch}
              disabled={batchBusy || deleteBusy || !batchField || !batchValue}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {batchBusy ? "Updating…" : "Apply to Selected"}
            </button>
            {canDelete && (
              <button
                onClick={handleDeleteSelected}
                disabled={batchBusy || deleteBusy}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}
      {batchMessage && (
        <p className="mb-4 text-sm text-gray-700" role="status">
          {batchMessage}
        </p>
      )}
      {deleteMessage && (
        <p className="mb-4 text-sm text-gray-700" role="status">
          {deleteMessage}
        </p>
      )}

      {visibleChapters.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900">{chapters.length === 0 ? "No chapters yet" : "No matching chapters"}</h2>
          {chapters.length === 0 ? (
            <>
              <p id="chapter-list-empty-help" className="mt-1 text-sm text-gray-600">
                {canEdit ? "Add a chapter by hand or import a chapter list. To compile, attach a Word document to a chapter." : "Compilation requires at least one chapter with a source document."}
              </p>
              {canEdit && (
                <button type="button" onClick={onImportChapters} className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Import chapter list
                </button>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-600">Clear or change your search.</p>
          )}
        </div>
      ) : (
      <>
      {tableOverflows && <p id="chapter-table-scroll" className="mb-2 text-xs text-gray-600">Scroll sideways for more columns. With the table focused, use the left and right arrow keys.</p>}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div ref={tableViewport} role="region" aria-label="Chapter table" aria-describedby={tableOverflows ? "chapter-table-scroll" : undefined} tabIndex={0} className="overflow-x-auto scroll-pl-48 sm:scroll-pl-64 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600">
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th scope="col" className="sticky left-0 z-10 w-48 min-w-40 border-r border-gray-200 bg-gray-50 p-4 sm:w-64 sm:min-w-56">
                  <div className="flex items-center gap-3">
                  {canEdit && (
                    <input
                      type="checkbox"
                      aria-label="Select all visible chapters"
                      checked={visibleChapters.every(chapter => selectedIds.has(chapter.id))}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  )}
                  Chapter and stage
                  </div>
                </th>
                {secondaryColumns.map(([key, label]) => !hiddenColumns.has(key) && (
                  <th key={key} scope="col" className="p-4">{label}</th>
                ))}
                <th scope="col" className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr>*]:border-t [&_tr>*]:border-t-gray-200">
              {visibleChapters.map((chapter) => {
                const progress = deriveChapterProgress(chapter);
                const issueCount = progress.discrepancies.length;
                return (
                  <tr
                    key={chapter.id}
                    className={`group transition-colors ${selectedIds.has(chapter.id) ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                  >
                    <th scope="row" className={`sticky left-0 z-10 border-r border-gray-200 p-4 text-left align-top font-normal ${selectedIds.has(chapter.id) ? "bg-indigo-50" : "bg-white group-hover:bg-gray-50"}`}>
                      <div className="flex items-start gap-3">
                      {canEdit && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${chapter.id}`}
                          checked={selectedIds.has(chapter.id)}
                          onChange={(e) =>
                            handleSelect(chapter.id, e.target.checked)
                          }
                          className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      )}
                      <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onEdit(chapter)}
                        className="block max-w-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
                        aria-label={`Open chapter ${chapter.id}: ${chapter.title}`}
                      >
                        <span className="block text-xs font-semibold text-gray-600">{chapter.id}</span>
                        <span className="block text-sm font-medium text-gray-900 line-clamp-2 hover:text-indigo-700 hover:underline">
                          {chapter.title}
                        </span>
                        <span className="block text-xs text-gray-500 mt-1 line-clamp-1">
                          {chapter.contributorName}
                        </span>
                      </button>
                      <span className="mt-2 inline-block rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800">
                        {progress.currentStage.label}
                      </span>
                      {issueCount > 0 && (
                        <details className="mt-2 max-w-52 text-xs">
                          <summary className="cursor-pointer rounded bg-amber-50 px-2 py-1 font-medium text-amber-900">
                            <AlertTriangle aria-hidden="true" className="mr-1 inline h-3 w-3 align-text-top" />
                            {issueCount} {issueCount === 1 ? "item" : "items"} to review
                          </summary>
                          <ul className="mt-1.5 space-y-1 text-gray-700">
                            {progress.discrepancies.map(issue => <li key={issue.code + (issue.recordIds ?? []).join(",")}>{issue.message}</li>)}
                          </ul>
                        </details>
                      )}
                      </div>
                      </div>
                    </th>
                    {!hiddenColumns.has("bio") && <td className="p-4">
                      <StatusBadge status={chapter.biographicalStatement || "No"} />
                    </td>}
                    {!hiddenColumns.has("contact") && <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                      {chapter.leadEditor || "-"}
                    </td>}
                    {!hiddenColumns.has("words") && <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                      {progress.currentWordCount?.toLocaleString() ?? "-"}
                    </td>}
                    {!hiddenColumns.has("submission") && <td className="p-4">
                      {progress.currentStage.record &&
                      hasStageSourceReference(progress.currentStage.record) ? (
                        <StageSourceActions
                          record={progress.currentStage.record}
                          compact={true}
                        />
                      ) : isExternalUrl(chapter.folderUrl) ? (
                        <a
                          href={chapter.folderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
                          title={chapter.folderUrl}
                        >
                          <ExternalLink className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate max-w-[150px]">
                            {chapter.folderUrl}
                          </span>
                        </a>
                      ) : (
                        <span
                          className="text-xs text-gray-600 italic"
                          title={chapter.folderUrl || "No URL provided"}
                        >
                          {chapter.folderUrl
                            ? "Folder reference only"
                            : "No URL provided"}
                        </span>
                      )}
                    </td>}
                    {!hiddenColumns.has("feedback") && <td className="p-4">
                      {isExternalUrl(chapter.feedbackLink) ? (
                        <a
                          href={chapter.feedbackLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-2 py-0.5 rounded-full font-medium text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors max-w-[150px]"
                          title={chapter.feedbackLink}
                        >
                          <ExternalLink className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">
                            {chapter.feedbackLink}
                          </span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium text-xs bg-rose-100 text-rose-700">
                          No
                        </span>
                      )}
                    </td>}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onEdit(chapter)}
                          className="inline-flex items-center justify-center p-2 text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={canEdit ? "Edit chapter" : "Open chapter"}
                        >
                          {canEdit ? (
                            <Edit className="w-4 h-4" />
                          ) : (
                            <History className="w-4 h-4" />
                          )}
                        </button>
                        {canDelete && (
                          <button
                            onClick={async () => {
                              if (
                                window.confirm(
                                  `Delete ${chapter.id}: ${chapter.title}? This removes its tracker record.`,
                                )
                              )
                                await deleteChapters([chapter]);
                            }}
                            disabled={deleteBusy}
                            className="inline-flex items-center justify-center p-2 text-gray-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete chapter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function isExternalUrl(value: string | undefined): value is string {
  return Boolean(value && /^https?:\/\/[^\s]+$/i.test(value));
}

function StatusBadge({ status }: { status: string }) {
  const normalized = typeof status === "string" ? status : "";
  const isYes = normalized.toLowerCase() === "yes";
  const isNo = normalized.toLowerCase() === "no";
  let colorClass = "bg-gray-100 text-gray-600";
  if (isYes) colorClass = "bg-emerald-100 text-emerald-700";
  if (isNo) colorClass = "bg-rose-100 text-rose-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {normalized || "N/A"}
    </span>
  );
}
