import { ArrowRight, CheckCircle2, TriangleAlert } from 'lucide-react';
import type { Chapter, ProjectState } from '../types';
import { deriveChapterProgress } from '../domain/chapterProgress';

interface DashboardProps {
  chapters: Chapter[];
  project?: ProjectState | null;
  onOpenChapter: (chapter: Chapter) => void;
  onViewChapters: () => void;
}

export function Dashboard({ chapters, project, onOpenChapter, onViewChapters }: DashboardProps) {
  const progress = chapters.map(chapter => ({ chapter, ...deriveChapterProgress(chapter) }));
  const flagged = progress
    .filter(item => item.discrepancies.length > 0)
    .map(item => ({
      ...item,
      blocking: item.discrepancies.some(issue => issue.severity === 'blocking'),
    }))
    .sort((left, right) => Number(right.blocking) - Number(left.blocking));
  const wordCounts = progress.flatMap(item => item.currentWordCount === undefined ? [] : [item.currentWordCount]);
  const totalWords = wordCounts.reduce((total, count) => total + count, 0);
  const averageWords = wordCounts.length ? Math.round(totalWords / wordCounts.length) : undefined;
  const stages = new Map<string, number>();
  for (const { currentStage } of progress) {
    stages.set(currentStage.label, (stages.get(currentStage.label) ?? 0) + 1);
  }

  const attentionRows = flagged.map(({ chapter, discrepancies, blocking }) => (
    <li key={chapter.id} className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <button type="button" onClick={() => onOpenChapter(chapter)} className="rounded text-left text-sm font-semibold text-indigo-700 hover:underline">
          {chapter.id} · {chapter.title}
        </button>
        <span className={blocking ? 'text-xs font-semibold text-amber-900' : 'text-xs font-medium text-gray-600'}>
          {blocking ? 'Workflow conflict' : 'Metadata review'}
        </span>
      </div>
      <ul className="mt-1 space-y-1 text-sm text-gray-700">
        {discrepancies.map(issue => <li key={issue.code + (issue.recordIds ?? []).join(',')}>{issue.message}</li>)}
      </ul>
    </li>
  ));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-semibold text-gray-900">{project?.name ?? 'Dashboard'}</h1>
        <button type="button" onClick={onViewChapters} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800">
          {chapters.length ? 'View chapters' : 'Go to chapters'}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <section aria-labelledby="dashboard-attention" className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <h2 id="dashboard-attention" className="flex items-center gap-2 text-base font-semibold text-gray-900">
            {flagged.length > 0
              ? <TriangleAlert aria-hidden="true" className="h-5 w-5 text-amber-700" />
              : chapters.length > 0 && <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-700" />}
            Needs attention
          </h2>
          {!chapters.length && <p className="mt-2 text-sm text-gray-600">Add or import chapters to begin tracking editorial progress.</p>}
          {chapters.length > 0 && flagged.length === 0 && <p className="mt-2 text-sm text-gray-600">No workflow conflicts or metadata checks for these chapters.</p>}
          {flagged.length > 0 && (
            <>
              <p className="mt-2 text-sm text-gray-600">{flagged.length} {flagged.length === 1 ? 'chapter needs' : 'chapters need'} review. Select a chapter to open its record.</p>
              <ul className="mt-2 divide-y divide-gray-200">{attentionRows.slice(0, 3)}</ul>
              {flagged.length > 3 && (
                <details className="border-t border-gray-200 py-3">
                  <summary className="cursor-pointer rounded text-sm font-medium text-indigo-700">Show {flagged.length - 3} more</summary>
                  <ul className="divide-y divide-gray-200">{attentionRows.slice(3)}</ul>
                </details>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="dashboard-progress" className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <h2 id="dashboard-progress" className="text-base font-semibold text-gray-900">Editorial progress</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-gray-700">Chapters</dt><dd className="font-semibold tabular-nums">{chapters.length.toLocaleString()}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-gray-700">Recorded words</dt><dd className="font-semibold tabular-nums">{wordCounts.length ? totalWords.toLocaleString() : 'Unavailable'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-gray-700">Average words per counted chapter</dt><dd className="font-semibold tabular-nums">{averageWords?.toLocaleString() ?? 'Unavailable'}</dd></div>
          </dl>
          {wordCounts.length < chapters.length && (
            <p className="mt-3 text-sm text-gray-600">Word counts recorded for {wordCounts.length.toLocaleString()} of {chapters.length.toLocaleString()} chapters.</p>
          )}
          {stages.size > 0 && (
            <>
              <h3 className="mt-4 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-900">Chapters by current stage</h3>
              <dl className="mt-2 space-y-2 text-sm">
                {[...stages].map(([label, count]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-gray-700">{label}</dt>
                    <dd className="font-semibold tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
