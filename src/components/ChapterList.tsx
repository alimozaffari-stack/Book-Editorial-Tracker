import React, { useState } from "react";
import { Chapter } from "../types";
import {
  Edit,
  ExternalLink,
  CheckSquare,
  History,
  Trash2,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { ChapterIntake } from "./ChapterIntake";
import { deriveChapterProgress } from "../domain/chapterProgress";
import StageSourceActions, { hasStageSourceReference } from "./StageSourceActions";
import CompileManuscriptModal from "./CompileManuscriptModal";

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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(chapters.map((c) => c.id)));
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
    if (!window.confirm(message)) return;
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
      setDeleteMessage(
        `${selectedChapters.length === 1 ? "Chapter" : "Selected chapters"} deleted.`,
      );
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
      {showCompiler && <CompileManuscriptModal chapters={chapters} projectName={projectName} onClose={() => setShowCompiler(false)} />}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Chapters</h1>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowCompiler(true)} disabled={chapters.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
            <BookOpen className="h-4 w-4" /> Compile Manuscript
          </button>
          {canEdit && <ChapterIntake existingChapters={chapters} onCreate={onCreate} />}
        </div>
      </div>

      {canEdit && selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center text-indigo-800 font-medium">
            <CheckSquare className="w-5 h-5 mr-2" />
            {selectedIds.size} chapter{selectedIds.size > 1 ? "s" : ""} selected
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={batchField}
              onChange={(e) => setBatchField(e.target.value as keyof Chapter)}
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
              value={batchValue}
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
              disabled={batchBusy || !batchField || !batchValue}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                {canEdit && (
                  <th className="p-4 w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === chapters.length &&
                        chapters.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                )}
                <th className="p-4">ID</th>
                <th className="p-4">Title & Contributors</th>
                <th className="p-4">Current State</th>
                <th className="p-4">Bio</th>
                <th className="p-4">Contact Person</th>
                <th className="p-4">Word Count</th>
                <th className="p-4">Submission location</th>
                <th className="p-4">Feedback Revision Link</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chapters.map((chapter) => {
                const progress = deriveChapterProgress(chapter);
                return (
                  <tr
                    key={chapter.id}
                    className={`transition-colors ${selectedIds.has(chapter.id) ? "bg-indigo-50/30" : "hover:bg-gray-50"}`}
                  >
                    {canEdit && (
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(chapter.id)}
                          onChange={(e) =>
                            handleSelect(chapter.id, e.target.checked)
                          }
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    <td className="p-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {chapter.id}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => onEdit(chapter)}
                        className="block max-w-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
                        aria-label={`Open chapter ${chapter.id}: ${chapter.title}`}
                      >
                        <span className="block text-sm font-medium text-gray-900 line-clamp-2 hover:text-indigo-700 hover:underline">
                          {chapter.title}
                        </span>
                        <span className="block text-xs text-gray-500 mt-1 line-clamp-1">
                          {chapter.contributorName}
                        </span>
                      </button>
                      {progress.discrepancies.length > 0 && (
                        <div className="mt-1.5 flex items-center">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 cursor-help"
                            title={progress.discrepancies
                              .map((d) => d.message)
                              .join(" | ")}
                          >
                            <AlertTriangle className="w-3 h-3 mr-1 shrink-0 text-amber-600" />
                            {(() => {
                              const blockingCount = progress.discrepancies.filter((d) => d.severity === 'blocking').length;
                              const cleanupCount = progress.discrepancies.length - blockingCount;
                              return blockingCount > 0
                                ? `${blockingCount} conflict${blockingCount === 1 ? '' : 's'}`
                                : `${cleanupCount} cleanup item${cleanupCount === 1 ? '' : 's'}`;
                            })()}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 whitespace-nowrap">
                        {progress.currentStage.label}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge
                        label="Bio"
                        status={chapter.biographicalStatement || "No"}
                      />
                    </td>
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                      {chapter.leadEditor || "-"}
                    </td>
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                      {progress.currentWordCount?.toLocaleString() ?? "-"}
                    </td>
                    <td className="p-4">
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
                          className="text-xs text-gray-400 italic"
                          title={chapter.folderUrl || "No URL provided"}
                        >
                          {chapter.folderUrl
                            ? "Folder reference only"
                            : "No URL provided"}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
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
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onEdit(chapter)}
                          className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
                            className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
    </div>
  );
}

function isExternalUrl(value: string | undefined): value is string {
  return Boolean(value && /^https?:\/\/[^\s]+$/i.test(value));
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  const normalized = typeof status === "string" ? status : "";
  const isYes = normalized.toLowerCase() === "yes";
  const isNo = normalized.toLowerCase() === "no";
  let colorClass = "bg-gray-100 text-gray-600";
  if (isYes) colorClass = "bg-emerald-100 text-emerald-700";
  if (isNo) colorClass = "bg-rose-100 text-rose-700";

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-gray-500">{label}:</span>
      <span
        className={`px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${colorClass}`}
      >
        {normalized || "N/A"}
      </span>
    </div>
  );
}
