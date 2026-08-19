import { ChapterStage } from '../types';

export type ProjectStageProposal = { stage: ChapterStage; roundNumber?: number };

export function chapterIdFromFolder(name: string): string | undefined {
  if (/^CH00_C\d+(?:-\d+)?$/i.test(name)) return undefined;
  const match = /(?:^|[_ -])C(?:H)?(\d{1,2})(?:$|[_ -])/i.exec(` ${name} `);
  return match ? `CH${match[1].padStart(2, '0')}` : undefined;
}

export function proposalFromStageFolder(name: string): ProjectStageProposal | undefined {
  const label = name.toUpperCase();
  if (label.includes('ABSTRACT')) return { stage: 'abstract' };
  if (label.includes('FEEDBACK')) {
    const explicitRound = /(?:ROUND|REV(?:ISION)?)[ _-]?(\d+)/i.exec(name)?.[1];
    const stagePrefixRound = /^\d+[ _-]+(\d+)(?:[ _-]|$)/.exec(name)?.[1];
    const round = explicitRound ?? stagePrefixRound;
    return { stage: 'feedback-sent', roundNumber: round === undefined ? undefined : Number(round) };
  }
  if (label.includes('1ST MANUSCRIPT') || label.includes('INITIAL MANUSCRIPT')) return { stage: 'initial-manuscript' };
  if (label.includes('REVISION')) { const round = /(\d+)/.exec(name)?.[1]; return { stage: 'revision', roundNumber: round ? Number(round) : undefined }; }
  if (label.includes('FINAL MANUSCR')) return { stage: 'final-manuscript' };
  if (label.includes('PUBLISHER')) return { stage: 'publisher-submission' };
  if (label.includes('TYPESET')) return { stage: 'typeset-submission' };
  return undefined;
}
