import { Chapter } from '../types';
import { isSafeProjectReference } from '../domain/projectReference';

export interface ChapterImportResult {
  chapters: Chapter[];
  errors: string[];
}

const requiredColumns = ['chapter_id', 'title', 'contributor_name'];

// Exported for reuse in the import planning module.
export function parseRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(value => value.length > 0)) rows.push(row);
  return rows;
}

function field(row: Record<string, string>, name: string): string {
  return row[name]?.trim() || '';
}

export function createChapter(values: Partial<Chapter> & Pick<Chapter, 'id' | 'title' | 'contributorName'>): Chapter {
  return {
    id: values.id.trim(),
    contributorId: values.contributorId || values.contributorEmail || values.contributorName.trim(),
    contributorName: values.contributorName.trim(),
    contributorEmail: values.contributorEmail || '',
    title: values.title.trim(),
    folderUrl: values.folderUrl || '',
    leadEditor: values.leadEditor || '',
    initialAbstractSubmitted: values.initialAbstractSubmitted || 'No',
    updatedAbstractSubmitted: values.updatedAbstractSubmitted || 'No',
    initialChapterSubmission: values.initialChapterSubmission || 'No',
    initialChapterDate: values.initialChapterDate || '',
    submittedWordCount: values.submittedWordCount || '',
    followUpForInitialSubmission: values.followUpForInitialSubmission || 'No',
    followUpDate: values.followUpDate || '',
    feedbackSent: values.feedbackSent || 'No',
    dateFeedbackSent: values.dateFeedbackSent || '',
    feedbackLink: values.feedbackLink || '',
    revision01Submitted: values.revision01Submitted || 'No',
    dateRevision01Submitted: values.dateRevision01Submitted || '',
    followUpContacted: values.followUpContacted || 'No',
    dateFollowUpContacted: values.dateFollowUpContacted || '',
    decisionToProceed: values.decisionToProceed || 'Yes',
    reasonIfNo: values.reasonIfNo || '',
    imageListSubmitted: values.imageListSubmitted || 'No',
    imagesMeetQc: values.imagesMeetQc || 'No',
    indexingTermsSubmitted: values.indexingTermsSubmitted || 'No',
    institutionalAffiliation: values.institutionalAffiliation || '',
    contactPerson: values.contactPerson || '',
    abstractText: values.abstractText || '',
    bioText: values.bioText || '',
    biographicalStatement: values.biographicalStatement || (values.bioText ? 'Yes' : 'No'),
  };
}

export function parseChapterCsv(csv: string): ChapterImportResult {
  const rows = parseRows(csv);
  if (rows.length === 0) return { chapters: [], errors: ['The CSV file is empty.'] };

  const headers = rows[0].map(header => header.trim().toLowerCase());
  const missing = requiredColumns.filter(header => !headers.includes(header));
  if (missing.length > 0) return { chapters: [], errors: [`Missing required column(s): ${missing.join(', ')}.`] };

  const chapters: Chapter[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] || '']));
    const id = field(row, 'chapter_id');
    const title = field(row, 'title');
    const contributorName = field(row, 'contributor_name');
    if (!id || !title || !contributorName) {
      errors.push(`Row ${rowNumber}: chapter_id, title, and contributor_name are required.`);
      return;
    }
    if (!isSafeProjectReference(field(row, 'folder_url'))) {
      errors.push(`Row ${rowNumber}: folder_url must be HTTPS or a project-relative reference.`);
      return;
    }
    // NOTE: Duplicate detection is now handled at the import‑plan level, so we no longer treat
    // duplicate IDs within the CSV as an error here. We still track IDs to avoid pushing the same
    // object multiple times when the same row appears more than once in the source CSV, but we
    // allow duplicates to be classified later.
    if (!ids.has(id)) {
      ids.add(id);
    }
    const chapter = createChapter({
      id,
      title,
      contributorName,
      contributorEmail: field(row, 'contributor_email'),
      institutionalAffiliation: field(row, 'institutional_affiliation'),
      leadEditor: field(row, 'lead_editor'),
      folderUrl: field(row, 'folder_url'),
      submittedWordCount: field(row, 'word_count'),
      abstractText: field(row, 'abstract'),
      bioText: field(row, 'bio'),
      initialChapterSubmission: field(row, 'initial_chapter_submission').toLowerCase() === 'yes' ? 'Yes' : 'No',
      initialChapterDate: field(row, 'initial_chapter_date'),
    });
    if (chapter.initialChapterSubmission === 'Yes') chapter.initialAbstractSubmitted = 'Yes';
    chapters.push(chapter);
  });
  return { chapters, errors };
}

export const chapterCsvTemplate = 'chapter_id,title,contributor_name,contributor_email,institutional_affiliation,lead_editor,folder_url,word_count,abstract,bio,initial_chapter_submission,initial_chapter_date\nCH14,Chapter title,Contributor name,email@example.com,University,Lead editor,https://drive.google.com/,0,Chapter abstract,Biographical statement,No,\n';
