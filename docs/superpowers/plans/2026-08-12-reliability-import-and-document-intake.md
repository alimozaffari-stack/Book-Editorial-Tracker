# Book Editorial Tracker Reliability, Import, and Document Intake Implementation Plan

> **Historical specification:** The lighter, user-focused execution plan is `2026-08-13-reliability-completion-plan-v2-small-team.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Firestore the single reliable live tracker, make all panels interpret chapter progress consistently, replace destructive imports and Drive overwrite sync with reviewed operations, persist the application login safely, and add low-friction `.docx` submission intake without moving or uploading manuscript files.

**Architecture:** Put progress derivation, import planning, submission-ledger updates, and folder-intake classification behind four small domain interfaces. Firestore remains authoritative; local and Drive JSON files are snapshots that must pass through the same import-preview seam. Word documents remain in the user's existing project folders; the app stores only confirmed metadata, hashes, relative references, and editorial dates.

**Tech Stack:** Electron 40, React 19, TypeScript 5.8, Vite 6, Firebase Authentication and Firestore, Node.js standard libraries in the Electron main process, Web Crypto, and `jszip` as the one new direct runtime dependency for bounded OOXML inspection.

## Global Constraints

- Work only in `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker` unless a user-initiated file or folder chooser explicitly selects another location.
- Treat Firestore `chapters` as the only live shared tracker. A JSON file is a backup/import source, never a second live database.
- Preserve the existing 13 chapter records and every existing flat field during migration.
- Before any production write or release installation, save a timestamped JSON backup and CSV export to a user-chosen location.
- Do not silently pull, push, delete, overwrite, rename, move, copy, or upload manuscript files.
- Remove the 1.5-second whole-file Drive auto-sync path. Do not replace it with a background watcher.
- Never persist Google OAuth access tokens, passwords, absolute local paths, or document contents in Firestore, local storage, logs, audit events, or JSON backups.
- Persist only the Firebase-authenticated session and non-secret UI preferences. A Drive operation, if retained for legacy import, must reacquire and validate a fresh grant.
- Support `.docx` manuscript intake only. Report `.doc`, `.docm`, `.gdoc`, `.epub`, `.md`, feedback letters, and research notes as unsupported or ambiguous; do not infer them into a manuscript stage.
- A filesystem creation timestamp and a DOCX internal creation timestamp are provenance, not submission dates. The user must confirm `submittedOn` before a submission record is written.
- Store local references relative to the selected project root. Never store `G:\...` or another device-specific absolute path in shared data.
- Initial folder intake is read-only until the user approves a preview. It must classify matched, unmatched, ambiguous, duplicate, unsupported, and failed items.
- A non-empty abstract or bio is evidence that the content is on file. The UI must show discrepancies with legacy flags rather than calling present content missing.
- All writes that can collide with another editor must use a Firestore transaction or a field-specific atomic update and increment `dataRevision`.
- Preserve unrelated working-tree changes, including the existing untracked `scripts/` directory.
- Every new or changed behaviour requires a failing test first, then implementation, then a passing focused test and the full suite.
- Keep the explicit `package.json` test command synchronized with every new test file named in this plan; a passing command that omits a test is a release failure.
- All shell commands in this plan are prefixed with `rtk`.
- This is a routing-only execution overlay: it changes neither task scope, file list, acceptance criteria, tests, nor release gates.

## Model and Effort Routing Overlay

The executor must not change the selected model or effort automatically. At each marked gate, it must stop before the first implementation action, tell the user why the change is needed, and ask the user to make the selected model/effort change in Codex. It must wait for the user's confirmation before proceeding. Once the marked task's acceptance criterion and focused verification pass, it must stop again and ask the user to restore the lighter profile before starting the following task.

| Profile | Model | Effort | Use |
|---|---|---|---|
| **Standard** | `gpt-5.6-terra` | `high` | Bounded UI/domain work, import preview, tests, documentation, and routine verification. |
| **Critical** | `gpt-5.6-sol` | `xhigh` | Cross-process persistence, concurrent Firestore writes, destructive-sync retirement/migration, binary document parsing, and reconciliation/release judgement. |

Use the Standard profile for Tasks 2, 3, 7, and 8. Use the Critical profile for Task 1, the contiguous Tasks 4-6 safety cluster, and Task 9. Before each Critical phase, issue this exact approval request:

> **Model-routing checkpoint:** Task N changes live-data, authentication, migration, or document-intake safety boundaries. Please switch this Codex task to **gpt-5.6-sol** at **xhigh** effort and confirm when the change is active. I will not begin Task N until you confirm.

After the Critical phase's final acceptance criterion and focused verification pass, and before moving to a Standard-profile task, issue this exact return request:

> **Model-routing checkpoint:** Task N is verified. Please switch this Codex task back to **gpt-5.6-terra** at **high** effort for the next bounded implementation task and confirm when active.

Task 10 is verification-only routing: begin with the Standard profile. If a defect implicates any Critical task boundary, stop, ask the user to switch to the Critical profile, repair and re-verify only that task boundary, then ask to return to Standard before resuming the smoke matrix. Do not route to OpenRouter or change providers as part of this plan; that requires a separate user decision.

---

## Final Product Decisions

1. **Live collaboration:** Firestore real-time listeners are the sync mechanism.
2. **JSON:** local or Drive-mounted JSON is a user-directed backup/import file selected through Windows dialogs.
3. **Google Drive API:** retire the current whole-file collaboration UI. Google sign-in may remain for Firebase authentication, but it no longer requests Drive scopes for normal use.
4. **Document intake:** manual `.docx` attachment is the normal ongoing workflow; one-time folder scan is an optional reviewed accelerator.
5. **Submission history:** add an append-oriented metadata ledger to each chapter; do not add fixed `revision02`, `revision03`, and later fields.
6. **Legacy compatibility:** keep current flat status/date fields, project confirmed ledger entries into those fields where an existing field exists, and derive all panels through one resolver.
7. **Dates:** show filesystem and DOCX dates as detected metadata; prefill but require confirmation of the editorial submission date.
8. **Word count:** prefer the DOCX extended property `Words`; calculate from `word/document.xml` when absent; keep the detected count visible and allow a confirmed manual correction.

## Data Contracts

Add these types to `src/types.ts` and use these exact property names throughout the implementation:

```ts
export type SubmissionStage =
  | 'initial'
  | 'revision'
  | 'final-manuscript'
  | 'publisher'
  | 'typeset';

export type WordCountSource = 'docx-properties' | 'calculated' | 'manual';

export interface SubmissionRecord {
  id: string; // `${stage}:${revisionNumber ?? 0}:${sourceSha256}`
  stage: SubmissionStage;
  revisionNumber?: number;
  sourceFileName: string;
  sourceRelativePath?: string;
  sourceSizeBytes: number;
  sourceSha256: string;
  filesystemCreatedAt?: string;
  filesystemModifiedAt: string;
  documentCreatedAt?: string;
  documentModifiedAt?: string;
  documentTitle?: string;
  documentCreator?: string;
  calculatedWordCount: number;
  wordCount: number;
  wordCountSource: WordCountSource;
  submittedOn: string; // YYYY-MM-DD, confirmed by the user
  recordedAt: string;
  recordedBy: string;
  state: 'active' | 'voided';
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface Chapter {
  // existing properties remain unchanged
  submissions?: SubmissionRecord[];
  dataRevision?: number;
  updatedAt?: string;
  updatedBy?: string;
}
```

The following pure module interfaces are the seams used by UI callers and tests:

```ts
export interface ChapterProgress {
  abstractOnFile: boolean;
  bioOnFile: boolean;
  initialSubmissionOnFile: boolean;
  revisionWorkOnFile: boolean;
  latestRevisionNumber: number;
  latestWordCount: number;
  productionState: 'not-started' | 'in-progress' | 'submitted' | 'finalized';
}

export interface ChapterDiscrepancy {
  chapterId: string;
  field: keyof Chapter;
  currentValue: string;
  evidence: string;
  proposedValue?: string;
}

export type ImportDisposition = 'new' | 'duplicate' | 'invalid' | 'ambiguous';
export type DuplicateStrategy = 'skip' | 'fill-blanks' | 'replace-selected-fields';

export interface ChapterImportPlanEntry {
  rowNumber: number;
  normalizedId: string;
  disposition: ImportDisposition;
  incoming?: Chapter;
  existing?: Chapter;
  baselineRevision?: number;
  messages: string[];
}

export interface ChapterImportPlan { entries: ChapterImportPlanEntry[]; }

export interface ImportResolution {
  normalizedId: string;
  strategy: DuplicateStrategy;
  selectedFields?: (keyof Chapter)[];
}

export interface ChapterWriteSet {
  creates: Chapter[];
  updates: Array<{
    chapterId: string;
    baselineRevision: number;
    fields: Partial<Chapter>;
  }>;
}

export interface LocalDocumentCandidate {
  candidateId: string;
  fileName: string;
  relativePath?: string;
  extension: string;
  sizeBytes: number;
  sha256: string;
  filesystemCreatedAt?: string;
  filesystemModifiedAt: string;
}

export interface FolderScan {
  rootLabel: string;
  scannedAt: string;
  candidates: LocalDocumentCandidate[];
  unsupported: Array<{ relativePath: string; extension: string; reason: string }>;
  failures: Array<{ relativePath: string; reason: string }>;
}

export interface DocxInspection {
  documentCreatedAt?: string;
  documentModifiedAt?: string;
  documentTitle?: string;
  documentCreator?: string;
  calculatedWordCount: number;
  wordCount: number;
  wordCountSource: Exclude<WordCountSource, 'manual'>;
}

export interface ConfirmedSubmissionInput {
  candidate: LocalDocumentCandidate;
  inspection: DocxInspection;
  stage: SubmissionStage;
  revisionNumber?: number;
  submittedOn: string;
  confirmedWordCount: number;
  wordCountSource: WordCountSource;
  actor: string;
  recordedAt: string;
}

export type FolderIntakeDisposition =
  | 'matched'
  | 'unmatched'
  | 'ambiguous'
  | 'duplicate'
  | 'unsupported'
  | 'failed';

export interface FolderIntakePreviewItem {
  candidateId?: string;
  relativePath: string;
  disposition: FolderIntakeDisposition;
  proposedChapterId?: string;
  proposedStage?: SubmissionStage;
  proposedRevisionNumber?: number;
  messages: string[];
}

export interface FolderIntakePreview {
  items: FolderIntakePreviewItem[];
  counts: Record<FolderIntakeDisposition, number>;
}

deriveChapterProgress(chapter: Chapter): ChapterProgress
findChapterDiscrepancies(chapter: Chapter): ChapterDiscrepancy[]

buildChapterImportPlan(csv: string, existing: Chapter[]): ChapterImportPlan
applyChapterImportPlan(plan: ChapterImportPlan, resolutions: ImportResolution[]): ChapterWriteSet

inspectDocx(candidate: LocalDocumentCandidate, bytes: Uint8Array): Promise<DocxInspection>

appendSubmission(chapter: Chapter, input: ConfirmedSubmissionInput): Chapter
voidSubmission(chapter: Chapter, submissionId: string, actor: string, reason: string): Chapter

buildFolderIntakePreview(chapters: Chapter[], scan: FolderScan): FolderIntakePreview
```

---

### Task 1: Freeze evidence and add concurrency protection

**Model-routing gate:** Before Step 1, request the Critical profile and wait for user confirmation. After the acceptance criterion and focused verification pass, request return to the Standard profile before Task 2.

**Files:**
- Modify: `package.json`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `src/utils/auditEvents.ts`
- Create: `src/utils/chapterWrites.ts`
- Create: `tests/chapterWrites.test.ts`

**Interfaces:**
- Consumes: existing Firestore `chapters/{chapterId}` documents.
- Produces: `saveChapterWithRevision(db, incoming, expectedRevision, actor)` and `updateChapterFields(db, chapterId, fields, actor)`.

- [ ] **Step 1: Save the production evidence before deployment work**

Use the current Dashboard to save one JSON backup and one CSV export. Record their exact paths and SHA-256 values in the implementation log. Do not run `Load Initial Data`, Drive pull, Drive push, or auto-sync.

- [ ] **Step 2: Write transaction tests**

Add tests proving that legacy chapters start at revision `0`, a successful save increments the revision, a stale save returns a conflict without writing, and a general form save preserves `submissions` added by another transaction.

```ts
assert.equal(result.kind, 'conflict');
assert.equal(result.current.dataRevision, 3);
assert.deepEqual(result.current.submissions, concurrentlyAddedSubmissions);
```

- [ ] **Step 3: Implement revision-aware writes**

Use `runTransaction`. Read the current document, compare `current.dataRevision ?? 0` with the modal's captured revision, merge only editable form fields, preserve server-current `submissions`, increment `dataRevision`, and set ISO `updatedAt` and `updatedBy`.

- [ ] **Step 4: Add an explicit conflict state to the chapter modal**

On conflict, keep the modal open and show: `This chapter changed after you opened it. Review the latest version before saving again.` Provide `Reload latest` and `Cancel`; do not provide a force-overwrite button in this release.

- [ ] **Step 5: Extend audit actions**

Add `chapter_save_conflict`, `submission_added`, `submission_voided`, `import_previewed`, `import_applied`, and `consistency_repaired` to `AuditAction`. Audit details may contain chapter IDs, counts, hashes, stages, and revision numbers, but never paths, tokens, passwords, or document text.

- [ ] **Step 6: Verify**

Add `tests/chapterWrites.test.ts` to the explicit `npm test` command. Run `rtk npm test` and `rtk npm run lint`.

**Acceptance:** Two editors cannot silently replace each other's chapter form edits or submission history.

---

### Task 2: Create the canonical progress and discrepancy module

**Files:**
- Create: `src/domain/chapterProgress.ts`
- Create: `tests/chapterProgress.test.ts`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/TasksView.tsx`
- Modify: `src/components/ChapterList.tsx`
- Modify: `src/components/ChapterDetail.tsx`

**Interfaces:**
- Consumes: `Chapter`, including optional `submissions`.
- Produces: `ChapterProgress` and `ChapterDiscrepancy[]` through the two interfaces in Data Contracts.

- [ ] **Step 1: Write the progress matrix tests**

Cover these exact cases:

| Evidence | Expected result |
|---|---|
| `abstractText` non-empty, flag `No` | abstract on file; discrepancy present |
| abstract blank, flag `Yes` | abstract reported; discrepancy present |
| `bioText` non-empty, biographical flag `No` | bio on file; discrepancy present |
| confirmed initial ledger record, legacy initial flag `No` | initial submission on file; discrepancy present |
| revision number 2 ledger record | revision work complete; latest revision is 2 |
| no evidence and flag `No` | task remains open |
| values ` yes `, `YES`, and `Yes` | normalized identically |

- [ ] **Step 2: Implement the pure resolver**

Define `isAffirmative`, `hasText`, active-submission selection, latest-word-count fallback, status distribution, and discrepancy detection in this module only.

- [ ] **Step 3: Replace duplicated panel logic**

Dashboard, Tasks, and Chapter List must call `deriveChapterProgress`. Rename the dashboard metric to `Abstracts on file`, and calculate latest word counts from the latest active submission record with `submittedWordCount` as the legacy fallback.

- [ ] **Step 4: Surface discrepancies in the chapter editor**

Show a compact warning beside inconsistent fields, such as `Abstract text is present but workflow status is No`. Do not mutate the record merely by opening it.

- [ ] **Step 5: Verify**

Run `rtk npm test` and `rtk npm run lint`.

**Acceptance:** All four screens return identical progress conclusions for the same chapter object.

---

### Task 3: Replace CSV rejection with a reviewed append/merge plan

**Files:**
- Modify: `src/utils/chapterImport.ts`
- Create: `src/domain/chapterImportPlan.ts`
- Create: `src/components/ImportPreview.tsx`
- Modify: `src/components/ChapterIntake.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/chapterImport.test.ts`
- Create: `tests/chapterImportPlan.test.ts`

**Interfaces:**
- Consumes: CSV text and the latest Firestore chapters.
- Produces: row classifications and an approved write set containing `creates` and field-level `updates`.

- [ ] **Step 1: Write classification tests**

Prove that a CSV containing CH00-CH13 against existing CH00-CH12 produces 1 new row and 13 duplicates; invalid rows do not block valid new rows; `ch01` and `CH01` collide after normalization; and duplicate IDs inside the CSV are ambiguous.

- [ ] **Step 2: Correct defaults for new records**

When a new CSV row contains abstract text, set `initialAbstractSubmitted` to `Yes`. When it contains bio text, set `biographicalStatement` to `Yes`. Never apply new-record defaults to an existing chapter.

- [ ] **Step 3: Implement only the required duplicate strategies**

Support `skip` and `fill-blanks`. Add `replace-selected-fields` for individually checked fields. Do not add full-record replacement.

- [ ] **Step 4: Build the import preview**

Display new, duplicate, invalid, ambiguous, and failed counts; list every chapter ID; require a resolution for each duplicate; and disable Apply while any ambiguity remains.

- [ ] **Step 5: Apply through a Firestore transaction**

Re-read affected chapters, compare their `dataRevision` with the preview baseline, abort the whole import if a record changed, and write no partial results. Increment revisions and add one `import_applied` audit event after success.

- [ ] **Step 6: Verify**

Run `rtk npm test` and `rtk npm run lint`.

**Acceptance:** Existing IDs never prevent valid new chapters from being appended, and existing values are never reset by default values.

---

### Task 4: Stabilize Firebase authentication across application launches

**Model-routing gate:** Before Step 1, request the Critical profile and wait for user confirmation. Retain it through the Task 6 acceptance criterion and focused verification; do not request a return between Tasks 4, 5, and 6.

**Files:**
- Modify: `electron/local-server.cjs`
- Modify: `electron/main.cjs`
- Modify: `src/firebase.ts`
- Modify: `src/App.tsx`
- Modify: `tests/localServer.test.cjs`
- Create: `tests/authPersistence.test.ts`

**Interfaces:**
- Consumes: the packaged local application and Firebase browser persistence.
- Produces: a stable `http://localhost:43119` origin and `initializeAuthPersistence(): Promise<void>`.

- [ ] **Step 1: Write stable-origin tests**

Tests must prove that production requests bind to `127.0.0.1:43119`, test calls can still request port `0`, and a port collision fails closed with a readable startup log rather than choosing a different origin.

- [ ] **Step 2: Enforce one application instance**

Use Electron's single-instance lock before starting the local server. Focus the existing window when a second launch occurs.

- [ ] **Step 3: Initialize Firebase persistence before observing auth state**

Call `setPersistence(auth, browserLocalPersistence)` and await it before registering the application-level `onAuthStateChanged` observer. Do not store email/password credentials separately.

- [ ] **Step 4: Separate Google sign-in from Drive authorization**

Remove Drive scopes from ordinary Google Firebase sign-in. Remove the in-memory `cachedAccessToken` interface once the legacy Drive overwrite surface is retired in Task 5.

- [ ] **Step 5: Verify restart behaviour**

Package and launch twice using the same Windows profile. Confirm that an authenticated Firebase session returns without re-entering a password and that Sign Out clears it.

- [ ] **Step 6: Verify**

Run `rtk npm test`, `rtk npm run lint`, and `rtk npm run make`.

**Acceptance:** Authentication state is origin-stable and persistent; no raw credential is introduced.

---

### Task 5: Retire destructive Drive JSON sync and provide controlled backup import

**Model-routing gate:** Continue with the already confirmed Critical profile from Task 4. Do not change model or effort at this task boundary.

**Files:**
- Create: `src/components/BackupIntakeView.tsx`
- Create: `src/domain/backupImport.ts`
- Create: `tests/backupImport.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/utils/backupExport.ts`
- Modify: `tests/backupExport.test.ts`
- Delete after the pre-deployment evidence gate succeeds: `src/components/GDriveSyncView.tsx`
- Delete after the pre-deployment evidence gate succeeds: `src/utils/googleDrive.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: versioned tracker backup JSON or the legacy bare `Chapter[]` format.
- Produces: `parseBackup(contents): BackupParseResult`, then the Task 3 import preview.

- [ ] **Step 1: Add backup compatibility tests**

Accept backup version 1, the new version 2, and legacy bare chapter arrays. Reject unrelated JSON, oversized files, duplicate chapter IDs, and objects without required chapter identifiers.

- [ ] **Step 2: Version the backup envelope**

Version 2 must include `format`, `version`, `exportedAt`, `exportedBy`, and `collections`. Submission metadata remains embedded in chapter records; document contents and absolute paths must not appear.

- [ ] **Step 3: Build Backups & Intake**

Replace the sidebar label `Google Drive Sync` with `Backups & Intake`. Provide `Save JSON backup`, `Export CSV`, `Preview JSON import`, `Initial folder intake`, and the existing working-folder reporting entry point.

- [ ] **Step 4: Use Windows file dialogs for location choice**

`Save JSON backup` must use the existing Save As handler so the user can select any location, including `G:\My Drive\...`. `Preview JSON import` uses a hidden `.json` file input and `File.text()`; it never writes before the import preview is approved and never needs the absolute source path.

- [ ] **Step 5: Remove whole-file live sync**

Remove auto-sync, silent push, direct pull, root-only Drive-file creation, and the misleading `Connected to Drive` badge. Preserve the old selected JSON separately before deleting the legacy code paths.

- [ ] **Step 6: Route every JSON import through Task 3**

No JSON import may call `batch.set` directly. It must produce the same new/duplicate/invalid/ambiguous preview and use the same revision checks.

- [ ] **Step 7: Verify**

Run `rtk npm test`, `rtk npm run lint`, and `rtk npm run make`.

**Acceptance:** The user chooses backup location explicitly, and no JSON button can silently overwrite Firestore or a remote file.

---

### Task 6: Add the deep DOCX inspection and submission-ledger modules

**Model-routing gate:** Continue with the already confirmed Critical profile from Task 4. After the acceptance criterion and focused verification pass, request return to the Standard profile before Task 7.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `electron/document-intake.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Create: `src/utils/docxIntake.ts`
- Create: `src/domain/submissionLedger.ts`
- Create: `tests/documentIntake.test.cjs`
- Create: `tests/docxIntake.test.ts`
- Create: `tests/submissionLedger.test.ts`

**Interfaces:**
- Consumes: a user-selected `.docx` or a candidate from a user-selected folder.
- Produces: bounded file metadata and bytes through an opaque candidate ID, then a confirmed `SubmissionRecord`.

- [ ] **Step 1: Add the OOXML dependency**

Run `rtk npm install jszip`. Ensure it is a direct dependency and is bundled into the Vite renderer output; do not require it from the Electron main process because Forge currently excludes `node_modules` from the packaged application.

- [ ] **Step 2: Write Electron adapter tests**

Use temporary directories to prove that the adapter accepts only `.docx`, enforces a 25 MiB compressed-size limit, calculates SHA-256, reports `birthtime` and `mtime`, returns no absolute path to the renderer, rejects arbitrary renderer-supplied paths, and clears its in-memory candidate registry after the intake session.

- [ ] **Step 3: Implement opaque candidate handling**

Expose only these preload methods:

```ts
chooseDocx(): Promise<LocalDocumentCandidate | null>
chooseProjectFolder(): Promise<FolderScan | null>
readDocumentCandidate(candidateId: string): Promise<Uint8Array>
clearDocumentCandidates(): Promise<void>
```

The Electron main process owns the map from random candidate ID to validated real path. Logs contain counts, candidate IDs, sizes, hashes, failures, and durations, but no absolute manuscript paths.

- [ ] **Step 4: Write DOCX inspection tests with in-memory ZIP fixtures**

Construct DOCX fixtures in the test with `jszip`. Cover `docProps/app.xml` word count, calculated fallback from `word/document.xml`, `docProps/core.xml` title/creator/dates, malformed ZIP, missing document XML, XML above 10 MiB, and manual word-count correction.

- [ ] **Step 5: Implement bounded DOCX inspection**

Read only `word/document.xml`, `docProps/app.xml`, and `docProps/core.xml`. Never execute macros or embedded content. Prefer a positive integer `<Words>` value; otherwise count normalized text from `w:t` nodes. Return both `calculatedWordCount` and the selected `wordCount` source.

- [ ] **Step 6: Write ledger tests**

Prove deterministic IDs, same-chapter SHA duplicate rejection, revision numbers above 1 without fixed extra fields, latest active record selection, void-with-reason behaviour, legacy-field projection, and preservation of detected versus manually confirmed word counts.

- [ ] **Step 7: Implement ledger rules**

Projection rules are exact:

| Confirmed ledger stage | Legacy projection |
|---|---|
| initial | `initialChapterSubmission=Yes`, `initialChapterDate`, latest `submittedWordCount` |
| revision 1 | `revision01Submitted=Yes`, `dateRevision01Submitted`, latest `submittedWordCount` |
| revision 2+ | `chapterRevision=RevNN`, latest `submittedWordCount`; no new fixed flag |
| final-manuscript | `manuscriptSubmission=Yes`, `manuscriptSubmissionDate` |
| publisher | `publisherSubmission=Yes`, `publisherSubmissionDate` |
| typeset | `typesetSubmission=Yes`, `typesetSubmissionDate` |

All new records store `submittedOn` as ISO `YYYY-MM-DD`; legacy projection formats it as `DD/MM/YYYY`.

- [ ] **Step 8: Verify**

Run `rtk npm test`, `rtk npm run lint`, and `rtk npm run build`.

**Acceptance:** DOCX complexity is hidden behind one inspection interface and one ledger interface; callers never parse XML, hash files, or edit legacy flags themselves.

---

### Task 7: Add manual submission intake to the chapter editor

**Files:**
- Create: `src/components/SubmissionLedger.tsx`
- Create: `src/components/SubmissionIntakeDialog.tsx`
- Create: `src/domain/submissionIntake.ts`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `src/App.tsx`
- Create: `tests/submissionIntake.test.ts`

**Interfaces:**
- Consumes: Task 6 DOCX inspection and ledger interfaces.
- Produces: one reviewed Firestore transaction per added or voided submission.

- [ ] **Step 1: Write interaction-state tests**

Test the pure `submissionIntake` state module without introducing a React test framework. Cover selection cancellation, invalid DOCX, duplicate hash, detected metadata, edited word count, required stage, required revision number for `revision`, required confirmed submission date, save conflict, successful append, and void requiring a reason. Exercise the rendered controls in the packaged-app smoke test.

- [ ] **Step 2: Replace fixed Submission Versions controls with a ledger**

Keep existing legacy fields visible under `Legacy workflow fields` during the transition. Add a chronological table with stage/revision, submitted date, filename, word count, source metadata, hash prefix, recorded by, and state.

- [ ] **Step 3: Add `Attach submission file`**

After selection, show filesystem-created, filesystem-modified, DOCX-created, DOCX-modified, detected word count, size, and filename. Prefill `submittedOn` from filesystem modified date but label it `Proposed submission date` and require confirmation.

- [ ] **Step 4: Preserve user control**

Allow correction of stage, revision number, submission date, and word count. Store detected values separately. Do not offer file move, rename, upload, or background tracking.

- [ ] **Step 5: Append transactionally**

Re-read the chapter, reject an existing SHA on that chapter, call `appendSubmission`, increment `dataRevision`, and record `submission_added`. A failed transaction leaves the modal open with no partial write.

- [ ] **Step 6: Verify**

Run `rtk npm test` and `rtk npm run lint`.

**Acceptance:** A second revision can be added without creating new hard-coded form fields, and its metadata updates every consuming panel consistently.

---

### Task 8: Add reviewed one-time project-folder intake

**Files:**
- Create: `src/domain/folderIntake.ts`
- Create: `src/components/FolderIntake.tsx`
- Modify: `src/audit/auditEngine.ts`
- Modify: `src/components/WorkingFolderAudit.tsx`
- Modify: `src/components/BackupIntakeView.tsx`
- Modify: `tests/auditEngine.test.ts`
- Create: `tests/folderIntake.test.ts`

**Interfaces:**
- Consumes: the Electron folder scan, current chapters, DOCX inspection, and ledger append interfaces.
- Produces: a preview plus CSV ledger and Markdown discrepancy report.

- [ ] **Step 1: Correct the current false ambiguity behaviour**

The existing audit type includes `ambiguous`, but `auditFiles` always returns `matched` when candidates exist. Write a failing test that expects `ambiguous` for equal-ranked candidates, then implement the classification.

- [ ] **Step 2: Encode conservative folder suggestions**

Suggest `C01_*` to `CH01`, through `C12_*` to `CH12`. Mark `CH00_C01-03` ambiguous because it contains a composite identifier. Suggestions are never writes.

- [ ] **Step 3: Encode conservative stage suggestions**

Recognize initial-submission folders and `REVISIONNN SUBMISSION` folders. Recognize the existing misspelling `FINAL MANUSCRUPT SUBMISSION` only as a suggestion. Treat any folder or filename containing `feedback`, `review letter`, or research-note extensions as non-manuscript unless the user manually reclassifies it.

- [ ] **Step 4: Add exclusions and bounds**

Exclude `node_modules`, the obsolete nested application tree, `.git`, `dist`, `out`, `audit-reports`, `audit-events`, and `desktop.ini`. Scan metadata for all remaining files, inspect bytes only for selected DOCX candidates, and show processed/matched/unmatched/ambiguous/duplicate/unsupported/failed counts.

- [ ] **Step 5: Build the mapping preview**

Require explicit chapter and stage confirmation for every proposed import. Multiple DOCX candidates for one chapter/stage remain ambiguous until exactly one is selected. `.gdoc` pointers cannot satisfy a DOCX intake record.

- [ ] **Step 6: Produce durable reports without mutating the manuscript root**

Generate a CSV ledger and Markdown discrepancy report in memory. Escape CSV quotes/newlines and Markdown pipes/newlines in untrusted filenames. Save the reports only through a user-confirmed Save As dialog. Include matched, unmatched, ambiguous, duplicate, unsupported, and failed items.

- [ ] **Step 7: Apply confirmed records with one transaction per chapter**

Use Task 6 and Task 7 interfaces. A chapter failure must not corrupt another chapter; the final result reports successful and failed chapter IDs. Do not retry silently.

- [ ] **Step 8: Verify against the known project shape**

Use synthetic fixtures representing C05 DOCX/GDOC duplication, C07 same-name different-size files, C08 mixed draft/notes/review letter, C09 feedback-only candidates, C03 EPUB, the C01 feedback-folder naming variation, `CH00_C01-03` ambiguity, a hash already attached to a different chapter, and filenames containing commas, quotes, pipes, and newlines.

- [ ] **Step 9: Verify**

Run `rtk npm test`, `rtk npm run lint`, and `rtk npm run build`.

**Acceptance:** The initial scan accelerates intake without guessing, moving files, writing into the working folder, or silently accepting ambiguous evidence.

---

### Task 9: Add reviewed consistency repair and complete the transition

**Model-routing gate:** Before Step 1, request the Critical profile and wait for user confirmation. After the acceptance criterion and focused verification pass, request return to the Standard profile before Task 10.

**Files:**
- Create: `src/domain/chapterReconciliation.ts`
- Create: `src/components/ConsistencyReview.tsx`
- Create: `tests/chapterReconciliation.test.ts`
- Modify: `src/components/BackupIntakeView.tsx`
- Modify: `src/App.tsx`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/RELEASE_NOTES_v0.1.4.md`

**Interfaces:**
- Consumes: `findChapterDiscrepancies` and the current Firestore snapshot.
- Produces: a reviewed, additive repair set; it never proposes changing `Yes` to `No` or deleting content.

- [ ] **Step 1: Write repair proposal tests**

Propose `initialAbstractSubmitted=Yes` for non-empty abstract text, `biographicalStatement=Yes` for non-empty bio text, and legacy projection from confirmed ledger records. Do not infer chapter submission merely from a positive word count or folder name.

- [ ] **Step 2: Build Consistency Review**

Show chapter ID, field, current value, evidence, proposed value, and reason. Let the editor deselect any proposal. Require a JSON backup created in the current session before Apply is enabled.

- [ ] **Step 3: Apply selected repairs transactionally**

Re-read revisions, abort changed chapters, update only selected fields, increment revisions, and record `consistency_repaired` with counts and chapter IDs.

- [ ] **Step 4: Update documentation**

Document Firestore as live sync; Backups & Intake; JSON preview semantics; manual DOCX intake; optional folder intake; date provenance; word-count limitations; relative-path privacy; conflict behaviour; and recovery from a rejected import.

- [ ] **Step 5: Verify**

Run `rtk npm test`, `rtk npm run lint`, and `rtk npm run make`.

**Acceptance:** The current live dataset can be brought into visible consistency through a reviewed, backup-gated operation.

---

### Task 10: Release verification and production smoke test

**Model-routing gate:** Start with the Standard profile. If verification finds a defect that touches a Critical task boundary, stop and request the Critical profile before repairing it; request the Standard profile again before resuming this task's smoke matrix.

**Files:**
- Modify only if verification reveals a defect: task-related files listed above.
- Produce: timestamped test log, data-reconciliation CSV ledger, and Markdown discrepancy report.

- [ ] **Step 1: Run the complete automated gate**

First compare `rg --files tests` with the explicit test paths in `package.json`; add any omitted test before running the suite.

Run:

```powershell
rtk npm test
rtk npm run lint
rtk npm run build
rtk npm run make
```

Expected: every command exits `0`; the installer is produced under `out\make`.

- [ ] **Step 2: Verify protected-data invariants**

Hash the sampled manuscript files before and after testing. Confirm no manuscript was moved, renamed, overwritten, or uploaded and no unexpected report appeared under the manuscript root.

- [ ] **Step 3: Run the packaged-app smoke matrix**

Verify sequentially:

1. Email/password login survives a normal app restart.
2. Sign Out removes the persistent session.
3. Dashboard, Chapters, Tasks, Abstracts, and Bios agree on CH02 and CH04.
4. A CSV with existing and new IDs adds only approved new rows.
5. A stale chapter modal cannot overwrite a newer edit.
6. A manually selected DOCX shows both detected dates, word count, hash, and confirmation controls.
7. Revision 02 appends to the ledger and updates latest word count without adding a fixed field.
8. Re-selecting identical content is rejected as a duplicate.
9. Folder intake reports the known ambiguous and unsupported patterns without writing.
10. JSON backup location is user-selected; JSON import cannot bypass preview.

- [ ] **Step 4: Reconcile counts**

Produce a CSV ledger and Markdown report comparing pre-update and post-update chapter IDs, progress states, word counts, and submission-record counts. Report matched, unmatched, ambiguous, changed, and failed items.

- [ ] **Step 5: Release only after review**

Install v0.1.4 over v0.1.3, reopen the app, repeat the restart/login and CH02/CH04 checks, and retain the pre-update backup until the user accepts the result.

**Acceptance:** The release is reversible, evidence-backed, and proves the exact workflows reported broken.

---

## Hostile Review Findings and Resolutions

| Attack | Failure if ignored | Final resolution |
|---|---|---|
| Firestore and Drive JSON both presented as live truth | Last writer silently destroys newer work | Firestore is the only live truth; JSON is reviewed backup/import only |
| Random localhost port | Auth/local storage appears to vanish between launches | Stable port `43119`, single-instance lock, fail closed on collision |
| Persisting Drive access token | Expired credential and secret leakage | No token persistence; ordinary login requests no Drive scope |
| Whole-chapter `setDoc` from a stale modal | Concurrent edits and submissions disappear | `dataRevision` plus Firestore transaction and reload-on-conflict |
| Existing CSV ID aborts the whole file | New chapters never append | Row-level preview; valid new rows proceed |
| CSV defaults overwrite current state | Flags reset to `No` | Defaults apply only to new records; duplicate updates are field-selected |
| Abstract/bio text and flags disagree | Tasks and Dashboard lie | One resolver plus reviewed consistency repair |
| Fixed revision fields | Revision 02+ cannot be represented cleanly | Append-oriented submission ledger with numeric revision |
| Filesystem creation date treated as submission date | Copied files acquire false editorial dates | Store provenance separately; confirm `submittedOn` |
| Word count presented as exact Word output | OOXML property may be stale; fallback differs from Word | Record detection method and calculated value; allow confirmed correction |
| Absolute `G:\...` path stored in Firestore | Privacy leak and unusable colleague links | Store only filename and project-relative path |
| Background folder watcher | Drive placeholders, partial sync, renames, and duplicates create brittle state | User-initiated bounded scan only |
| Folder names treated as authoritative | `CH00_C01-03`, C01 naming, and misspellings map incorrectly | Suggestions plus mandatory preview; ambiguous items fail closed |
| `.gdoc` treated as a DOCX | Pointer file yields no manuscript content | `.gdoc` is unsupported and reported |
| Same filename assumed same version | C07 demonstrates same name with different bytes | SHA-256 and size determine identity; filename is descriptive only |
| Scanner reads the nested obsolete app | Huge, irrelevant traversal | Explicit exclusions and scan limits |
| Malicious or malformed DOCX | Memory exhaustion or parser failure | User-selected `.docx`, 25 MiB compressed limit, three allowed XML entries, 10 MiB XML limit, explicit failure |
| Submission bytes saved in Firestore or backup | Database bloat and sensitive manuscript duplication | Metadata and hash only |
| Scan writes reports into manuscript root | Research tree is mutated during inspection | Reports stay in memory until a Save As action |
| Automatic repair changes `Yes` to `No` | Valid historical state is lost | Repair is additive only and backup-gated |

## Explicit Non-Goals for v0.1.4

- No continuous folder monitoring.
- No direct manuscript upload to Google Drive, Firebase Storage, or Firestore.
- No automatic file move, rename, copy, or deletion.
- No `.doc`, `.docm`, Google Docs pointer, EPUB, or Markdown manuscript parsing.
- No filename-only automatic acceptance.
- No full-record CSV replacement.
- No force-overwrite button for Firestore conflicts.
- No automatic deletion based on absence from a JSON file or folder scan.
- No Google Picker integration; local Google Drive Desktop paths and Windows dialogs cover this release.

## Plan Self-Review

- **Spec coverage:** Import append, auth persistence, JSON location choice, Drive overwrite risk, panel consistency, manual Revision 02 intake, initial folder scan, detected dates, word count, metadata, hostile review, migration, and release proof each map to a task.
- **Placeholder scan:** The plan contains no deferred implementation placeholders; optional behaviour is either explicitly in scope or listed as a non-goal.
- **Type consistency:** `SubmissionRecord`, `dataRevision`, `submittedOn`, `wordCountSource`, candidate IDs, and all domain interface names are used consistently across tasks.
- **Safety:** Every bulk or externally sourced write is previewed, revision-checked, audited, and preceded by a backup. Manuscript bytes never enter shared tracker data.
- **Scope:** The plan adds one parser dependency and no background process. It retires the brittle subsystem instead of layering another sync mechanism over it.
