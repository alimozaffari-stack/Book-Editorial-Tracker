import React from 'react';
import { Chapter } from '../types';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { deriveChapterProgress } from '../domain/chapterProgress';

export function getRemainingTasks(chapter: Chapter) {
  const tasks = [];
  const stage = deriveChapterProgress(chapter).currentStage.key;
  if (stage === 'no-confirmed-history') tasks.push('Abstract');
  if (['no-confirmed-history', 'abstract'].includes(stage)) tasks.push('Initial manuscript');
  if (['no-confirmed-history', 'abstract', 'initial-manuscript'].includes(stage)) tasks.push('Send feedback');
  if (['no-confirmed-history', 'abstract', 'initial-manuscript', 'feedback-sent'].includes(stage)) tasks.push('Revision');
  if (chapter.imageListSubmitted !== 'Yes') tasks.push('Images');
  if (chapter.indexingTermsSubmitted !== 'Yes') tasks.push('Indexing Terms');
  return tasks;
}

export function TasksView({ chapters }: { chapters: Chapter[] }) {
  const tasksSummary = [
    { label: 'Abstracts', missing: chapters.filter(c => deriveChapterProgress(c).currentStage.key === 'no-confirmed-history').length },
    { label: 'Chapter Submissions', missing: chapters.filter(c => ['no-confirmed-history', 'abstract'].includes(deriveChapterProgress(c).currentStage.key)).length },
    { label: 'Feedback to Send', missing: chapters.filter(c => ['no-confirmed-history', 'abstract', 'initial-manuscript'].includes(deriveChapterProgress(c).currentStage.key)).length },
    { label: 'Revisions', missing: chapters.filter(c => ['no-confirmed-history', 'abstract', 'initial-manuscript', 'feedback-sent'].includes(deriveChapterProgress(c).currentStage.key)).length },
    { label: 'Images', missing: chapters.filter(c => c.imageListSubmitted !== 'Yes').length },
    { label: 'Indexing Terms', missing: chapters.filter(c => c.indexingTermsSubmitted !== 'Yes').length },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Remaining Tasks</h1>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Volume Tasks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasksSummary.map(task => (
              <div key={task.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <span className="font-medium text-gray-700">{task.label}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-indigo-600">{task.missing}</span>
                  <span className="text-sm text-gray-500">remaining</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Per Chapter Tasks</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {chapters.map(chapter => {
              const remaining = getRemainingTasks(chapter);
              const isComplete = remaining.length === 0;
              
              return (
                <div key={chapter.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{chapter.id}: {chapter.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{chapter.contributorName}</p>
                    </div>
                    {isComplete ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {remaining.length} tasks
                      </span>
                    )}
                  </div>
                  
                  {!isComplete && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {remaining.map(task => (
                        <span key={task} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-gray-200 text-gray-600 shadow-sm">
                          <Circle className="w-3 h-3 mr-1.5 text-gray-400" />
                          {task}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
