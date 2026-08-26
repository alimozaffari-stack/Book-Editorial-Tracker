import type { Chapter, ChapterStage, ChapterStageRecord } from '../types';
import { chapterStageRank } from './chapterStageHistory';

export const compilerStageOptions: Array<{ value: ChapterStage; label: string }> = [
  { value: 'abstract', label: 'Abstract' },
  { value: 'initial-manuscript', label: 'Initial manuscript' },
  { value: 'feedback-sent', label: 'Feedback sent' },
  { value: 'revision', label: 'Revision' },
  { value: 'final-manuscript', label: 'Final manuscript' },
  { value: 'publisher-submission', label: 'Publisher submission' },
  { value: 'typeset-submission', label: 'Typeset submission' },
];

export const defaultCompilerStages: ChapterStage[] = [
  'initial-manuscript',
  'revision',
  'final-manuscript',
  'publisher-submission',
  'typeset-submission',
];

const chapterCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function compareChaptersBySequence(left: Chapter, right: Chapter): number {
  return chapterCollator.compare(left.id, right.id)
    || chapterCollator.compare(left.title, right.title);
}

function compareStageRecords(left: ChapterStageRecord, right: ChapterStageRecord): number {
  return chapterStageRank(right) - chapterStageRank(left)
    || right.effectiveOn.localeCompare(left.effectiveOn)
    || right.recordedAt.localeCompare(left.recordedAt)
    || right.id.localeCompare(left.id);
}

export function latestCompilerSource(
  chapter: Chapter,
  selectedStages: ReadonlySet<ChapterStage>,
): ChapterStageRecord | undefined {
  return (chapter.submissions ?? [])
    .filter(record => record.state === 'active'
      && selectedStages.has(record.stage)
      && Boolean(record.sourceRelativePath || record.sourceSha256))
    .sort(compareStageRecords)[0];
}

export function buildCompileManuscriptRequest(
  chapters: Chapter[],
  projectName: string,
  format: CompileManuscriptFormat,
  selectedStages: ReadonlySet<ChapterStage>,
  includeAbstracts: boolean,
  includeMetadata: boolean,
): CompileManuscriptRequest {
  const totalAbstractLength = chapters.reduce((acc, c) => acc + (c.abstractText?.length || 0), 0);
  if (chapters.length > 100) throw new Error('Maximum compiler limit is 100 chapters.');
  if (totalAbstractLength > 500000) throw new Error('Aggregate abstract length exceeds 500,000 characters limit.');

  return {
    format,
    projectName,
    includeAbstracts,
    includeMetadata,
    chapters: chapters
      .slice()
      .sort(compareChaptersBySequence)
      .flatMap(chapter => {
        const source = latestCompilerSource(chapter, selectedStages);
        if (!source) return [];
        return [{
          id: chapter.id,
          title: chapter.title,
          contributorName: includeMetadata ? chapter.contributorName : undefined,
          contributorEmail: includeMetadata ? chapter.contributorEmail : undefined,
          institutionalAffiliation: includeMetadata ? chapter.institutionalAffiliation : undefined,
          abstractText: includeAbstracts ? chapter.abstractText : undefined,
          source: {
            stage: source.stage,
            roundNumber: source.roundNumber,
            effectiveOn: source.effectiveOn,
            sourceFileName: source.sourceFileName,
            sourceRelativePath: source.sourceRelativePath,
            sourceSha256: source.sourceSha256,
          },
        }];
      }),
  };
}

// Sanitize filenames to prevent issues on Windows filesystems
export function sanitizeFilename(name: string): string {
  if (!name) return 'unnamed';
  // Remove invalid Windows characters: < > : " | ? * \
  return name.replace(/[<>:"|?*\\/]/g, '').trim() || 'unnamed';
}
