import { Chapter } from "../types";
import { applyStageHistoryProjections } from "../domain/chapterStageHistory";
import { deriveChapterProgress } from "../domain/chapterProgress";
import {
  ProjectImportPlan,
  ProjectImportResult,
} from "../domain/projectImportPlan";
import { ChapterStage } from "../types";

interface Props {
  plan: ProjectImportPlan;
  label: string;
  chapters: Chapter[];
  busy: boolean;
  progress: string;
  outcome: ProjectImportResult | null;
  onToggle: (relativePath: string, selected: boolean) => void;
  onClassify: (
    relativePath: string,
    stage?: ChapterStage,
    roundNumber?: number,
  ) => void;
  onRecordChange: (
    relativePath: string,
    changes: {
      stage?: ChapterStage;
      roundNumber?: number;
      effectiveOn?: string;
      wordCount?: number;
    },
  ) => void;
  onInspect: () => void;
  onCancelInspection: () => void;
  onApply: () => void;
  onChangeFolder: () => void;
  onForgetFolder: () => void;
  onViewChapters: () => void;
  onSaveReport: (format: "csv" | "md") => void;
}

export function ProjectImportPreview({
  plan,
  label,
  chapters,
  busy,
  progress,
  outcome,
  onToggle,
  onClassify,
  onRecordChange,
  onInspect,
  onCancelInspection,
  onApply,
  onChangeFolder,
  onForgetFolder,
  onViewChapters,
  onSaveReport,
}: Props) {
  const counts = plan.entries.reduce<Record<string, number>>(
    (all, entry) => ({
      ...all,
      [entry.disposition]: (all[entry.disposition] ?? 0) + 1,
    }),
    {},
  );
  const selectedForInspection = plan.entries.filter(
    (entry) =>
      entry.selected && !entry.inspected && entry.file.extension === ".docx",
  ).length;
  const selectedForApply = plan.entries.filter(
    (entry) => entry.selected && entry.inspected && entry.record,
  ).length;
  const importComplete = Boolean(outcome) && selectedForApply === 0;
  const affected = new Set(
    plan.entries
      .filter((entry) => entry.selected && entry.record)
      .map((entry) => entry.chapterId),
  );
  const projected = chapters.map((chapter) => {
    const additions = plan.entries
      .filter(
        (entry) =>
          entry.selected && entry.record && entry.chapterId === chapter.id,
      )
      .map((entry) => entry.record!);
    return additions.length
      ? applyStageHistoryProjections(chapter, [
          ...(chapter.submissions ?? []),
          ...additions,
        ])
      : chapter;
  });
  const estimatedWords = projected.reduce(
    (sum, chapter) =>
      sum + (deriveChapterProgress(chapter).currentWordCount ?? 0),
    0,
  );
  return (
    <section className="mt-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Import existing project: {label}</h2>
          <p className="mt-1 text-sm text-gray-600">
            The scan reads metadata only. Select Word files, then inspect them
            explicitly. Google Drive for desktop may download cloud-only
            selected files.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <button
            onClick={onChangeFolder}
            disabled={busy || importComplete}
            className="underline"
          >
            Change folder
          </button>
          <button
            onClick={onForgetFolder}
            disabled={busy}
            className="underline"
          >
            Forget folder
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {Object.entries(counts).map(([name, count]) => (
          <span key={name}>
            {name}: {count}
          </span>
        ))}
      </div>
      <div className="mt-4 max-h-80 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th>Select</th>
              <th>Chapter</th>
              <th>Stage folder / file</th>
              <th>Review details</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {plan.entries.map((entry) => {
              const eligible = Boolean(
                entry.chapterId &&
                entry.proposal &&
                entry.file.extension === ".docx" &&
                (entry.disposition === "Ready" ||
                  entry.disposition === "Needs review"),
              );
              const changeStage = (stage?: ChapterStage) =>
                entry.inspected
                  ? onRecordChange(entry.file.relativePath, { stage })
                  : onClassify(
                      entry.file.relativePath,
                      stage,
                      entry.proposal?.roundNumber,
                    );
              return (
                <tr
                  key={entry.file.relativePath}
                  className="border-b align-top"
                >
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={entry.selected}
                      disabled={busy || !eligible}
                      onChange={(event) =>
                        onToggle(entry.file.relativePath, event.target.checked)
                      }
                      aria-label={`Select ${entry.file.relativePath}`}
                    />
                  </td>
                  <td>{entry.chapterId ?? "—"}</td>
                  <td className="max-w-xs break-all">
                    {entry.file.relativePath}
                  </td>
                  <td>
                    {entry.file.extension === ".docx" && entry.chapterId ? (
                      <div className="space-y-1">
                        <select
                          value={entry.proposal?.stage ?? ""}
                          disabled={busy}
                          onChange={(event) =>
                            changeStage(
                              event.target.value
                                ? (event.target.value as ChapterStage)
                                : undefined,
                            )
                          }
                          className="max-w-40 rounded border p-1"
                        >
                          <option value="">Choose stage</option>
                          {[
                            "abstract",
                            "initial-manuscript",
                            "feedback-sent",
                            "revision",
                            "final-manuscript",
                            "publisher-submission",
                            "typeset-submission",
                          ].map((stage) => (
                            <option key={stage} value={stage}>
                              {stage.replaceAll("-", " ")}
                            </option>
                          ))}
                        </select>
                        {(entry.proposal?.stage === "revision" ||
                          entry.proposal?.stage === "feedback-sent") && (
                          <input
                            type="number"
                            min={entry.proposal.stage === 'feedback-sent' ? 0 : 1}
                            value={entry.proposal.roundNumber ?? ""}
                            disabled={busy}
                            onChange={(event) =>
                              entry.inspected
                                ? onRecordChange(entry.file.relativePath, {
                                    roundNumber: event.target.value
                                      ? Number(event.target.value)
                                      : undefined,
                                  })
                                : onClassify(
                                    entry.file.relativePath,
                                    entry.proposal?.stage as ChapterStage,
                                    event.target.value
                                      ? Number(event.target.value)
                                      : undefined,
                                  )
                            }
                            aria-label="Round"
                            className="ml-1 w-16 rounded border p-1"
                          />
                        )}
                        {entry.record && (
                          <div className="flex gap-1">
                            <input
                              type="date"
                              value={entry.record.effectiveOn}
                              disabled={busy}
                              onChange={(event) =>
                                onRecordChange(entry.file.relativePath, {
                                  effectiveOn: event.target.value,
                                })
                              }
                              aria-label="Effective date"
                              className="rounded border p-1"
                            />
                            <input
                              type="number"
                              min="0"
                              value={entry.record.wordCount ?? 0}
                              disabled={busy}
                              onChange={(event) =>
                                onRecordChange(entry.file.relativePath, {
                                  wordCount: Number(event.target.value),
                                })
                              }
                              aria-label="Word count"
                              className="w-24 rounded border p-1"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span>{entry.disposition}</span>
                    <span className="block text-xs text-gray-500">
                      {entry.message}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
        <p>
          Chapters affected: {affected.size} · Stage records selected:{" "}
          {selectedForApply} · Estimated current-volume words:{" "}
          {estimatedWords.toLocaleString()}
        </p>
        {estimatedWords > 200000 && (
          <p className="mt-1 font-medium text-amber-700">
            The estimated current volume is above 200,000 words.
          </p>
        )}
      </div>
      {progress && (
        <p className="mt-3 text-sm" role="status">
          {progress}
        </p>
      )}
      {outcome && (
        <div
          className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900"
          role="status"
        >
          <p>
            {outcome.chaptersChanged} chapters changed;{" "}
            {outcome.stageRecordsAdded} stage records added;{" "}
            {outcome.alreadyRecorded} already recorded; {outcome.excluded}{" "}
            excluded; {outcome.unsupported} unsupported; {outcome.failed}{" "}
            failed.
          </p>
          <button
            onClick={onViewChapters}
            className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white"
          >
            View chapters
          </button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          onClick={() => onSaveReport("csv")}
          disabled={busy}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Save scan CSV
        </button>
        <button
          onClick={() => onSaveReport("md")}
          disabled={busy}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Save scan Markdown
        </button>
        {busy && selectedForInspection > 0 ? (
          <button
            onClick={onCancelInspection}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel after current file
          </button>
        ) : (
          <button
            onClick={onInspect}
            disabled={busy || selectedForInspection === 0}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
          >
            Inspect {selectedForInspection} selected Word file
            {selectedForInspection === 1 ? "" : "s"}
          </button>
        )}
        {!importComplete && <button
          onClick={onApply}
          disabled={busy || selectedForApply === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy && selectedForInspection === 0
            ? "Adding…"
            : `Add ${selectedForApply} stage record${selectedForApply === 1 ? "" : "s"}`}
        </button>}
      </div>
    </section>
  );
}
