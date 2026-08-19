export type TeamRole = 'admin' | 'editor' | 'viewer';

export interface AppUser {
  id: string;
  email: string;
  role: TeamRole;
}

export interface Chapter {
  id: string;
  contributorId: string;
  contributorName: string;
  contributorEmail: string;
  title: string;
  folderUrl: string;
  leadEditor: string;
  initialAbstractSubmitted: string;
  updatedAbstractSubmitted: string;
  updatedAbstractDate?: string;
  abstractRevision?: string;
  initialChapterSubmission: string;
  initialChapterDate: string;
  chapterRevision?: string;
  submittedWordCount: string;
  followUpForInitialSubmission: string;
  followUpDate: string;
  feedbackSent: string;
  dateFeedbackSent: string;
  feedbackReceived?: string;
  dateFeedbackReceived?: string;
  feedbackLink: string;
  feedbackRevision?: string;
  revision01Submitted: string;
  dateRevision01Submitted: string;
  manuscriptSubmission?: string;
  manuscriptSubmissionDate?: string;
  publisherSubmission?: string;
  publisherSubmissionDate?: string;
  typesetSubmission?: string;
  typesetSubmissionDate?: string;
  biographicalStatement?: string;
  bioText?: string;
  abstractText?: string;
  institutionalAffiliation?: string;
  contactPerson?: string;
  followUpContacted: string;
  dateFollowUpContacted: string;
  decisionToProceed: string;
  reasonIfNo: string;
  imageListSubmitted: string;
  imagesMeetQc: string;
  indexingTermsSubmitted: string;
  dataRevision?: number;
  updatedAt?: string;
  updatedBy?: string;
  submissions?: ChapterStageRecord[];
}

export type WordCountSource = 'docx-properties' | 'calculated' | 'manual';

export type ChapterStage =
  | 'abstract'
  | 'initial-manuscript'
  | 'feedback-sent'
  | 'revision'
  | 'final-manuscript'
  | 'publisher-submission'
  | 'typeset-submission';

export interface ChapterStageRecord {
  id: string;
  stage: ChapterStage;
  roundNumber?: number;
  sourceFileName?: string;
  sourceRelativePath?: string;
  sourceSizeBytes?: number;
  sourceSha256?: string;
  filesystemCreatedAt?: string;
  filesystemModifiedAt?: string;
  documentCreatedAt?: string;
  documentModifiedAt?: string;
  calculatedWordCount?: number;
  wordCount?: number;
  wordCountSource?: WordCountSource;
  effectiveOn: string;
  recordedAt: string;
  recordedBy: string;
  state: 'active' | 'voided';
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export type DiscrepancySeverity = 'blocking' | 'cleanup';
export type DiscrepancyCode = 'duplicate-active-rank' | 'legacy-abstract-status' | 'missing-abstract-evidence';

export interface ChapterDiscrepancy {
  code: DiscrepancyCode;
  severity: DiscrepancySeverity;
  message: string;
  field: string;
  recordIds?: string[];
}

export interface ProjectState {
  name: string;
  generationId: string;
  startedAt: string;
  startedBy: string;
  updatedAt: string;
}

export interface ActiveStageConflict {
  rank: number;
  stageLabel: string;
  records: ChapterStageRecord[];
}

export interface StageConflict {
  recordId: string;
  chapterId: string;
  stage: ChapterStage;
  rank: number;
  details: string;
}

export type ImportDisposition = 'new' | 'already-present' | 'invalid' | 'ambiguous';

export interface ChapterImportPlanEntry {
  rowNumber: number;
  normalizedId: string;
  disposition: ImportDisposition;
  incoming?: Chapter;
  existing?: Chapter;
  baselineRevision?: number;
  messages: string[];
}

export interface ChapterImportPlan {
  entries: ChapterImportPlanEntry[];
}
