# Book Editorial Tracker Small-Team Reliability Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan sequentially. Do not return to the superseded 2026-08-12 prompts.

**Status:** Final canonical work order after small-team, activity-log, role, scale, and chapter-versus-stage-folder review.

**Goal:** Finish a friendly, dependable tracker for one regular editor and a team of up to five people, without enterprise-style administration or unattended automation.

**Architecture:** Keep four deep modules: revision-safe chapter/history writes with atomic activity events, one chapter-progress resolver, reviewed import planning, and bounded DOCX inspection. Firestore remains the shared live tracker. A chapter is one editorial record; its chapter folder may contain many stage folders, and confirmed files from those folders become many chronological stage-history records under that one chapter. The main UI shows one derived current state. CSV/JSON and initial project import always preview first; exceptions return to the ordinary chapter editor.

**Tech Stack:** Existing Electron 40, React 19, TypeScript 5.8, Firebase Authentication/Firestore, Node test runner, Vite, Electron Forge, and the already-installed `jszip`.

## Verified Starting Point (2026-08-13)

- The repository is a dirty local worktree with user-owned changes and is ahead of its tracked branch. Preserve everything; do not clean, reset, pull, or push.
- The package test script currently reports 31 passing tests but omits four discovered test files. Running all 14 discovered test files produced 41 passes and one failure: manual stage/submission intake is lost because the general chapter save preserves the server's existing `submissions` array over the incoming append.
- Lint, TypeScript/build, and Electron packaging passed in the prior verification after the build/package steps were allowed outside the sandbox.
- Firebase local authentication persistence is already present and must be retained/tested, not replaced with a credentials file.
- Immutable `auditEvents` rules and basic event writes already exist, but several data writes and their events are separate operations; Task 1 makes them atomic and Task 3 makes the history usable.
- The real project root has 13 chapter-level folders, broad stage-folder templates that are mostly empty, and 18 substantive/pointer files. Known ambiguities include a composite CH00 folder, duplicate/pointer candidates, feedback copies, research notes, and unsupported formats. Automated tests must use a synthetic tree; the real root is not selected until the final user-approved gate.

## Small-Team Product Rules

- Optimize for one person doing routine work; collaboration protection must remain invisible until a real conflict occurs.
- Support up to five named team members with three understandable roles: Administrator, Editor, and Viewer.
- Keep a permanent append-only Activity Log showing what changed, who did it, when, and which chapter or team member was affected.
- A common task must have one obvious starting action and no more than three decision steps.
- Use plain labels: `Import chapters`, `Add stage file`, `Import existing project`, `Backups & Intake`, `Needs attention`, `Try again`, and `Open chapter`.
- Show summary first. Put hashes, provenance dates, and technical metadata under an expandable `File details` section.
- Existing chapter IDs are skipped by default during CSV/JSON chapter-list imports and clearly reported as `Already in tracker — not changed`. The separately reviewed initial-project import may append confirmed stage history to those existing chapters.
- Do not offer three merge strategies, field-by-field import replacement, bulk consistency repair, automatic watching, or automatic file movement.
- Do not restore users or audit events from client JSON. These are not everyday editorial workflows.
- `Initial project import` scans a user-selected existing project folder, groups many stage folders under each single chapter, proposes history records only for substantive files, and writes only the rows the editor confirms.
- Every tracker backup, CSV, activity export, or scan report uses Save As and confirms the chosen destination locally. The app never creates an unexplained tracker JSON in Google Drive; exported paths are not written to Firestore or Activity details.
- Inconsistent chapters appear in one `Needs attention` list with an `Open chapter` action. Corrections use the familiar chapter form.
- Preserve the existing visual language, sidebar, typography, cards, badges, and modal style.
- Every dialog must preserve entered data on validation or conflict errors, place keyboard focus on the first problem, support Escape/close safely, and disable duplicate submits while busy.
- Error text must say what happened, whether anything was saved, and the next action. Never show raw Firebase/Google/JSON errors to the editor.
- No import, restore, repair, or file operation may silently overwrite, delete, rename, move, upload, or alter data.
- Firestore's authenticated live listener is the shared-data sync. Show the last successful refresh and a plain `Try again` action after listener/auth failure; do not reintroduce whole-file Push/Pull sync.
- Activity events may include action, actor, chapter/team-member ID, changed field names, status/date/count changes, and revision numbers. They must never contain passwords, tokens, abstract/biography text, document contents, or absolute local paths.

## Engineering Constraints

- Work only in `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker` unless the user chooses a file/folder in the app.
- Preserve the dirty worktree and user-owned `scripts/`; do not reset, clean, push, install, or publish.
- Keep all discovered tests in `npm test`, but add only focused tests through the four deep module interfaces and the eight core user flows.
- Use `rtk proxy npm.cmd ...` for npm commands and `apply_patch` for edits.
- At each acceptance gate, report the scoped diff and verification result. Commit only after the user approves that gate; never push automatically.

## Expected Scale

- Typical edited volume: 10–30 chapters; test with 30 and allow headroom to 50 chapter-like folders.
- Typical compiled manuscript: below 200,000 words. Show the estimated current-volume word count (one latest manuscript version per chapter) and warn above 200,000; do not reject solely on word count.
- Typical team: 1–3 active people, maximum supported roster 5.
- This scale does not justify pagination frameworks, background queues, custom permission builders, or a separate audit database.

## Chapter, Folder, and Current-State Model

```text
one Chapter (CH04)
  -> one chapter folder (for example C04_MOZAFFARI)
      -> zero or more stage folders
          -> zero or more candidate files
  -> many confirmed stage-history records
  -> one current state derived for the main UI
```

- A chapter folder is not a chapter record, and a stage folder is not another chapter.
- Empty stage folders are a filing template only. They create no record and do not advance the current state.
- A substantive file in a stage folder is a candidate, not proof. The preview proposes its chapter, stage, round, date, and word count; a person confirms or corrects it.
- Chapter title, contributor, contact, and other baseline metadata come from the CSV/JSON chapter-list import or manual Add chapter. The folder importer does not invent a chapter from a folder name; it appends history only after a folder maps to one tracker chapter.
- One chapter may receive several confirmed history records in a single initial import: for example initial manuscript, feedback, Revision 01, and Revision 02.
- Supported history stages are `Abstract`, `Initial manuscript`, `Feedback sent`, `Revision`, `Final manuscript`, `Publisher submission`, and `Typeset submission`. Revision and feedback records carry a round number when known.
- The main chapter list, Dashboard, and Tasks show only one current state, derived from the highest confirmed non-voided workflow record. The chapter detail shows the full chronological history.
- The current chapter word count comes from its latest active manuscript-bearing record (`Initial manuscript`, `Revision`, `Final manuscript`, `Publisher submission`, or `Typeset submission`). Volume totals sum one current count per chapter, never all historical revisions.
- Folder names are classification hints, including known variants and misspellings; they are never authoritative by themselves. If two candidates could represent the same stage, the row is `Needs review` and nothing is silently chosen.
- The shared database stores project-relative references only. The selected project-root path may be remembered locally on that Windows device, with `Change folder` and `Forget folder`; it is never synced, exported in activity details, or written to Firestore.

## Eight Core User Flows

1. **Update a chapter:** Chapters -> open chapter -> edit -> Save changes.
2. **Attach a stage file:** Open chapter -> Add stage file -> review detected details -> Confirm.
3. **Import chapters:** Backups & Intake -> Import chapters -> preview new/skipped/errors -> Add new chapters.
4. **Back up:** Backups & Intake -> Save JSON backup or Export CSV -> choose location.
5. **Import existing project:** Backups & Intake -> Import existing project -> review chapters and their stage files -> confirm selected records.
6. **Review activity:** Activity -> see newest changes -> optionally filter by person, chapter, or action.
7. **Manage team:** Manage Team -> add an existing account or change its role -> confirm.
8. **Resume later:** Close and reopen the app -> authenticated session and locally selected project folder resume safely.

---

### Task 1: Restore the chapter editor and make writes safe and traceable

**Files:**
- Modify: `package.json`
- Modify: `src/utils/chapterWrites.ts`
- Create: `src/domain/chapterStageHistory.ts`
- Create: `src/domain/activityLog.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `tests/chapterWrites.test.ts`
- Modify: `tests/manualSubmissionIntegration.test.ts`
- Modify and rename: `tests/submissionLedger.test.ts` -> `tests/chapterStageHistory.test.ts`
- Create: `tests/activityLog.test.ts`
- Remove after replacement passes: `src/utils/auditEvents.ts`
- Remove after replacement passes: `src/utils/submissionLedger.ts`

**Interface:**

```ts
saveChapterWithRevision(db, incoming, expectedRevision, actor): Promise<WriteResult>
appendStageRecordWithRevision(db, chapterId, record, expectedRevision, actor): Promise<WriteResult>

writeActivityEvent(transaction, event: ActivityEventInput): void
```

```ts
type ChapterStage =
  | 'abstract'
  | 'initial-manuscript'
  | 'feedback-sent'
  | 'revision'
  | 'final-manuscript'
  | 'publisher-submission'
  | 'typeset-submission';

interface ChapterStageRecord {
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
  wordCountSource?: 'docx-properties' | 'calculated' | 'manual';
  effectiveOn: string;
  recordedAt: string;
  recordedBy: string;
  state: 'active' | 'voided';
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}
```

The existing Firestore array name `submissions` remains for backward compatibility, but its TypeScript record and all user-facing labels become `ChapterStageRecord` and `Stage history`. This avoids a risky data migration while allowing feedback and abstract evidence as well as manuscript submissions.

- [ ] Add every discovered test file to the explicit `npm test` command and reproduce the current submission-loss failure.
- [ ] Restore the existing Basic Information section: title, contributors, email, affiliation, submission folder/reference, lead editor, and contact person. Retain all current workflow fields.
- [ ] Keep general chapter Save revision-aware and preserve server-current stage history held in the compatibility `submissions` field.
- [ ] Add one dedicated append transaction that reads the chapter, rejects stale revision or a duplicate active SHA, appends one embedded stage record, projects legacy fields, increments `dataRevision`, and writes once.
- [ ] Support many stage records for one chapter. Never create a second chapter record merely because another stage folder or file exists.
- [ ] Derive the one current-state value from active stage history; do not maintain a separately editable current-stage field that can drift.
- [ ] Write one immutable activity event inside the same Firestore transaction as each user-confirmed mutating operation: chapter create/update/delete, batch status change, chapter-list import, project-history import, stage append/void, or team change. A failed transaction must leave no activity event. A batch/import uses one summary event with affected chapter IDs and counts rather than dozens of noisy entries.
- [ ] Record actor email, action, plain-language summary, chapter ID when applicable, changed field names, revision before/after, and client/server timestamps. Store old/new values only for short non-sensitive status, date, role, and word-count fields; for text/path fields store only that the field changed.
- [ ] Route batch status edits through the existing field-update transaction. Bootstrap may only create an absent chapter.
- [ ] Make `Reload latest` actually replace the modal form with the server-current chapter. Keep the modal open and preserve unsaved input until the user chooses Reload or Cancel.
- [ ] Delete the unused top-level Firestore `submissions` helper.
- [ ] Add accessible busy, success, validation, and conflict states using persistent inline messages rather than disappearing notifications.
- [ ] Run focused tests, all tests, and TypeScript checking.

**Acceptance:** Routine editing feels unchanged; every successful user-confirmed mutation produces exactly one immutable, privacy-safe activity event, and a collaborator conflict produces neither a chapter write nor a misleading log entry.

---

### Task 2: Make every screen agree and add one friendly attention list

**Files:**
- Create: `src/domain/chapterProgress.ts`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/TasksView.tsx`
- Modify: `src/components/ChapterList.tsx`
- Create: `src/components/NeedsAttention.tsx`
- Modify: `src/App.tsx`
- Replace: `tests/progressDiscrepancy.test.ts` with `tests/chapterProgress.test.ts`
- Remove after migration: `src/utils/progressDiscrepancy.ts`, `src/utils/consistencyRepair.ts`

**Interface:**

```ts
deriveChapterProgress(chapter: Chapter): ChapterProgress
deriveCurrentStage(chapter: Chapter): DerivedCurrentStage
findChapterDiscrepancies(chapter: Chapter): ChapterDiscrepancy[]
```

- [ ] Test content evidence, active/voided stage records, legacy flags, case/whitespace, latest applicable word count, and contradictory fields through this interface.
- [ ] Implement this explicit precedence: `No confirmed history < Abstract < Initial manuscript < Feedback round 0 < Revision 01 < Feedback round 1 < Revision 02 < Feedback round 2 ... < Final manuscript < Publisher submission < Typeset submission`. Ignore empty folders and voided records. Higher revision/feedback rounds win within the repeating sequence; same-rank contradictions are flagged instead of silently guessed.
- [ ] Make Dashboard, Tasks, Chapters, Abstracts, and Bios consume the same result. Delete local status formulas.
- [ ] Show only the derived current state in the compact chapter list and dashboard. Show the complete chronological Stage history inside the chapter detail.
- [ ] Make dashboard total/average word counts sum the latest active manuscript-bearing record once per chapter. Do not add initial and revision word counts together.
- [ ] Add a compact `Needs attention` panel listing chapter, plain-language issue, and `Open chapter`. Do not add bulk repair or fabricated proposals.
- [ ] Use helpful copy such as `Abstract text is present, but its status is marked No` rather than internal field names.
- [ ] Provide useful empty states: `Everything is consistent` and `No chapters yet — import chapters or add one manually`.
- [ ] Show one unobtrusive live-data status based on the actual Firestore chapter listener: last successful refresh when healthy, and `Data could not refresh — Try again` on failure. Never display `Connected` merely because the user is authenticated.
- [ ] Verify keyboard navigation, visible focus, semantic headings, and status announcements for changed counts.
- [ ] Run focused tests, all tests, and TypeScript checking.

**Acceptance:** Editors see the same truth everywhere and can correct the few exceptions in the ordinary form without learning a repair system.

---

### Task 3: Add small-team roles, persistent sign-in, and a usable Activity page

**Files:**
- Modify: `src/firebase.ts`
- Modify: `src/types.ts`
- Modify: `src/components/UsersView.tsx`
- Create: `src/components/ActivityView.tsx`
- Modify: `src/domain/activityLog.ts`
- Modify: `src/App.tsx`
- Modify: `firestore.rules`
- Create: `tests/teamRoles.test.ts`
- Create: `tests/activityView.test.ts`
- Modify: `tests/firestoreRules.test.mjs`

**Role policy:**

| Role | May read/export/activity | May edit/import/attach | May delete chapters | May manage team |
|---|---:|---:|---:|---:|
| Administrator | Yes | Yes | Yes | Yes |
| Editor | Yes | Yes | No | No |
| Viewer | Yes | No | No | No |

- [ ] Extend the existing role type and Firestore rules from `admin/editor` to `admin/editor/viewer`; use one shared role-policy helper in the UI rather than scattered email checks.
- [ ] Before removing the hard-coded administrator fallback, verify that at least one valid administrator user document exists in the target Firestore database. If none exists, pause and ask the user to provision the initial administrator email in Firebase; do not invent a first-user-wins bootstrap.
- [ ] Remove hard-coded administrator emails and silent creation of three user records only after that gate passes. Existing valid user records remain untouched.
- [ ] Rename `Manage Users` to `Manage Team`. Show the current roster and role descriptions, allow an administrator to add an already-provisioned email or change a role, and enforce a maximum of five active members.
- [ ] State plainly that adding a team record does not create a Firebase Authentication account. Account provisioning remains a separate administrator action; do not build invitations, groups, custom permissions, or SSO.
- [ ] Prevent removing or demoting the last administrator and prevent an administrator from accidentally locking out their own active session.
- [ ] Record team additions, role changes, and removals as atomic privacy-safe activity events.
- [ ] Add an `Activity` page, newest first, with simple filters for person, chapter, and action plus `Load older` and `Export activity CSV`. Show plain-language summaries and the timestamp; hide raw payloads by default.
- [ ] Verify the already-present Firebase `browserLocalPersistence` is initialized before the auth listener. Keep credentials/tokens in Firebase's persistence only; never write passwords, OAuth tokens, or a custom credentials JSON file.
- [ ] Provide a friendly signed-out/expired-session message with `Sign in again`; distinguish it from a data-sync failure.
- [ ] For a clean database with no authorized roster, show a guided `Tracker access has not been set up` screen rather than an empty or broken app.
- [ ] Run focused tests, Firestore rules tests, all tests, and TypeScript checking.

**Acceptance:** A 1–5 person team can be assigned Administrator, Editor, or Viewer access; sign-in survives a normal restart; and every successful data or role change can be found by actor in the immutable Activity page.

---

### Task 4: Build a simple Backups & Intake workspace and safe chapter-list imports

**Files:**
- Create: `src/components/BackupIntakeView.tsx`
- Create: `src/components/ImportPreviewDialog.tsx`
- Modify: `src/domain/chapterImportPlan.ts`
- Create: `src/utils/backupImport.ts`
- Modify: `src/components/ChapterIntake.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/chapterImportPlan.test.ts`
- Create: `tests/backupImport.test.ts`

**Import policy:** New chapter IDs may be selected and added. Existing IDs are always skipped in v0.1.4 and edited through the chapter form. Invalid or repeated rows are reported and never written.

- [ ] Reduce the import planner to four results: `new`, `already-present`, `invalid`, and `ambiguous`. Remove fill-blank and replace-selected-field strategies from types and UI.
- [ ] Add a sidebar `Backups & Intake` page with three primary actions: Save JSON backup, Export CSV, and Import chapters.
- [ ] Keep a `Download chapter-list template` action with required columns and one clearly marked example row. Preserve Unicode and correctly quote commas, quotes, and line breaks on import/export.
- [ ] Use a three-step import flow: choose file; preview summary/table; confirm `Add N new chapters`.
- [ ] Show summary cards for New, Already in tracker, Needs correction, and Repeated ID. Select valid new rows by default.
- [ ] Apply new rows with create-if-absent transactions. If a target appears after preview, report it as skipped rather than overwriting it.
- [ ] Route JSON backup chapters through the same add-missing-only preview. Display user/audit-event counts as informational and do not import them.
- [ ] Keep the preview open after failure and show `Nothing was changed` plus the correction needed.
- [ ] After success, show counts and a single `View chapters` action.
- [ ] After any export, show `Saved to` with the locally chosen destination and an `Open folder` action. Activity events, if recorded for export completion, contain the format and filename only, never the absolute path.
- [ ] Run focused tests, all tests, TypeScript checking, and build.

**Acceptance:** A CSV containing CH00-CH12 plus CH13 clearly shows 13 unchanged and one ready to add; one confirmation adds CH13 and touches nothing else.

---

### Task 5: Make one-file stage attachment clear and bounded

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Replace: `src/utils/docxInspection.ts`
- Modify and rename: `src/components/SubmissionIntakeDialog.tsx` -> `src/components/StageIntakeDialog.tsx`
- Create: `src/components/StageHistory.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `tests/docxInspection.test.ts`
- Create: `tests/stageIntake.test.ts`

**Interface:**

```ts
selectDocx(): Promise<SelectedDocx | null>

interface SelectedDocx {
  fileName: string;
  sizeBytes: number;
  sha256: string;
  filesystemCreatedAt?: string;
  filesystemModifiedAt: string;
  bytes: Uint8Array;
}

inspectDocx(bytes: Uint8Array): Promise<DocxInspection>
```

- [ ] Implement one Electron file chooser that accepts `.docx`, enforces 25 MiB, reads metadata/bytes, and returns no absolute path. Do not build a general candidate registry.
- [ ] Inspect only `word/document.xml`, `docProps/app.xml`, and `docProps/core.xml`, with a 10 MiB limit per XML entry. Prefer DOCX Words and calculate from `w:t` when absent.
- [ ] Replace the browser file input with one `Choose Word document` button under the user-facing action `Add stage file`.
- [ ] After selection, show filename, proposed stage/round, proposed effective date, and word count. Put creation/modification dates, size, hash, creator, and title under `File details`.
- [ ] Offer the seven supported stages. Require round number for Revision and Feedback when the round cannot be inferred; require date confirmation; preserve calculated count when a manual correction is made.
- [ ] Use clear outcomes: `Stage record added`, `This exact file is already recorded for this chapter`, or `Nothing was saved — reload the latest chapter and try again`.
- [ ] Display Stage history as a compact chronological table and show the derived current state above it; use `Mark as entered by mistake` with a required reason instead of deletion.
- [ ] Clear transferred bytes from renderer state when the dialog closes or completes.
- [ ] Run focused tests, all tests, TypeScript checking, build, and package.

**Acceptance:** An editor can attach Revision 02 to the existing chapter without creating another chapter, and the one displayed current state updates from the confirmed history without requiring the editor to understand hashes or metadata.

---

### Task 6: Add reviewed initial-project import and remove obsolete Drive paths

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Create: `src/domain/projectFolderScan.ts`
- Create: `src/domain/projectImportPlan.ts`
- Create: `src/components/ProjectImportPreview.tsx`
- Modify: `src/components/BackupIntakeView.tsx`
- Modify: `src/audit/auditEngine.ts`
- Modify: `tests/auditEngine.test.ts`
- Create: `tests/projectFolderScan.test.ts`
- Create: `tests/projectImportPlan.test.ts`
- Modify: `src/utils/backupExport.ts`
- Modify: `src/utils/chapterImport.ts`
- Delete after tests pass: `src/utils/googleDrive.ts`, `src/components/GDriveSyncView.tsx`, `generateArtifacts.ts`
- Modify: `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`

**Interface:**

```ts
scanProjectFolder(): Promise<ProjectFolderScan | null>
planProjectImport(scan, existingChapters): ProjectImportPlan
applyProjectImport(db, approvedPlan, expectedRevisions, actor): Promise<ProjectImportResult>
```

- [ ] Let the user choose one project root. Scan metadata for one level of chapter folders and their stage subfolders, excluding the nested obsolete app, `node_modules`, hidden/system files, and report folders. Do not follow symlinks, junctions, or reparse points outside the selected root. This first scan is read-only and does not open document contents.
- [ ] Return a non-sensitive display label (the final two folder names) plus project-relative filenames, extension, size, and dates to the renderer. Keep the absolute root in the Electron main process and never send it to Firestore, backups, logs, or activity events.
- [ ] Remember the selected absolute root only in an app-preferences file under Electron's per-user `userData` directory. Show the display label and provide `Change folder` and `Forget folder`; never store credentials there.
- [ ] Group candidates in the preview as `Chapter -> stage folder -> file`. Map `C01`-style chapter folders to one existing chapter, flag the composite `CH00_C01-03`, and never interpret each stage folder as another chapter.
- [ ] Classify known stage-folder variants, including `01_00_1ST MANUSCRIPT FEEDBACK` and the existing `06_FINAL MANUSCRUPT SUBMISSION` misspelling. Folder classification proposes a stage/round but never marks it complete without a substantive file and human confirmation.
- [ ] Ignore empty stage folders. Treat `.docx` as inspectable; show `.gdoc`, `.doc`, `.docm`, `.epub`, `.md`, research notes, and other files as Unsupported or Needs review rather than silently importing them.
- [ ] After the metadata preview, require one explicit `Inspect N selected Word files` action. Explain that Google Drive for desktop may download cloud-only selected files. Do not open or hydrate unselected candidates.
- [ ] Inspect each selected DOCX through the bounded Task 5 inspector and propose creation/modification date, effective date, hash, and word count. Keep bytes out of Firestore and release them after inspection.
- [ ] Process selected files sequentially with a visible `Inspecting N of M` status and a safe Cancel action between files; do not introduce a worker queue.
- [ ] Use five dispositions: `Ready`, `Already recorded`, `Needs review`, `Unsupported`, and `Unmatched chapter`. Select only Ready rows by default. Equal-ranked candidates remain Needs review until the editor chooses one, changes its classification, or excludes it.
- [ ] For `Unmatched chapter`, provide `Import chapter list first` rather than creating a title/contributor guess from the folder. After a chapter-list import, allow the same scan preview to be recalculated without selecting the folder again.
- [ ] Allow several selected stage records for the same chapter. Detect duplicate active hashes within that chapter and suspected duplicate stage/round candidates before confirmation.
- [ ] Before applying, show chapters affected, stage records to add, skipped/unsupported/ambiguous counts, and the estimated current-volume word count after import. Compute that total from the latest manuscript-bearing record per chapter, not the sum of historical revisions. Warn rather than block above 200,000 words.
- [ ] Apply the whole approved plan in one revision-checked Firestore transaction sized for at most 50 chapters. Append selected records to their one owning chapter, recompute legacy projections and current state, increment each changed chapter revision once, and write one import-summary activity event containing affected chapter IDs and per-chapter record counts. Any conflict or validation failure changes nothing.
- [ ] After success, show exact counts for chapters changed, stage records added, already recorded, excluded, unsupported, and failed. Provide `View chapters`; keep the reviewed result available until dismissed.
- [ ] Allow optional CSV/Markdown scan-report download through Save As, with correct escaping. Do not write reports into the scanned project folder.
- [ ] Accept only HTTPS URLs or project-relative folder references in new manual/import data. Block drive letters, UNC, `file:`, traversal, and absolute paths.
- [ ] Remove Drive API code, Drive-sync wording, auto-sync remnants, and instructions. Google sign-in remains authentication only.
- [ ] Replace the unsafe seed-data artifact script with the existing app backup/export actions; do not add a reconciliation CLI.
- [ ] Test with a synthetic 30-chapter tree, many empty stage folders, multiple confirmed stages for one chapter, same-name/different-byte files, duplicate hashes, unsupported pointers, and a total selected word count near 200,000. Do not use the live project for automated tests.
- [ ] Bump version to `0.1.4` only after all Task 6 checks pass.
- [ ] Run focused tests, all tests, TypeScript checking, build, and make.

**Acceptance:** A reviewed initial import can add several historical stages to each of 10–30 chapters while preserving one chapter record and one derived current state; empty folders and ambiguous files change nothing, and the source tree remains untouched.

---

### Task 7: Usability and release gate

**Automated gate:**

- [ ] Confirm every discovered test is in `npm test`; then run tests, TypeScript, build, make, and `git diff --check` sequentially.
- [ ] Verify no blind import overwrite, duplicate chapter-per-stage write, top-level submission write, Drive API call, raw credential, document body, synced absolute path, or fabricated consistency value remains.
- [ ] Verify Firestore rules and UI enforce Administrator/Editor/Viewer consistently, audit events are immutable, and no successful chapter/team mutation can commit without its activity event.
- [ ] Produce the required test log, CSV verification ledger, and Markdown discrepancy report from current evidence. Do not add a permanent reconciliation subsystem.

**User-flow gate:** Pause here and ask the user before launching or touching external state.

- [ ] Present the tested Firestore rules diff and ask separately before deploying it to the live Firebase project. Verify the target project/database first; never infer it from a filename.
- [ ] Capture and inspect the eight core flows in the packaged app at the normal desktop size and at the minimum supported window size.
- [ ] Verify each flow has one obvious primary action, plain-language instructions, disabled double-submit, visible busy state, persistent success/error state, keyboard focus recovery, and no clipped modal content.
- [ ] Verify a valid administrator user document exists before removing the temporary fallback; if not, pause for the user's Firebase provisioning. Then ask the user to sign in, restart once, import a disposable mixed CSV, attach a disposable DOCX as Revision 02, save a backup, and assign a disposable/pre-provisioned account a role. If no second account exists, ask the user to provision one in Firebase Authentication; do not create credentials silently.
- [ ] Ask the user before selecting the real `G:\My Drive\02- WRITING\BOOKS\Heritage and Civilisational Analysis\01_CHAPTERS` root. First perform the metadata preview only; confirm the real folder is unchanged and that CH04-like folders appear once with multiple nested stage candidates. Ask again before DOCX inspection because Google Drive may hydrate selected cloud-only files.
- [ ] Confirm Dashboard/Tasks/Chapters agree on one derived current state and the Activity page shows the test changes with the correct actor.
- [ ] Save a pre-import backup, present the reviewed real-project import summary, and ask separately before applying it to production Firestore. After approval, verify chapter counts, per-chapter history, current states, aggregate word count, and activity events; never move or modify source files.
- [ ] Retain the pre-release backup and ask separately before commit, push, installation, tag, or publication.

**Acceptance:** A regular editor can complete all eight flows without technical guidance; one chapter retains multiple stage records but one current state; the permanent Activity page identifies every successful change and actor; and a second editor cannot silently overwrite current work.

## Explicit Non-Goals

- No background folder watcher or auto-sync.
- No direct manuscript upload or cloud storage.
- No user/audit-event restore from JSON.
- No field-by-field import merge screen.
- No bulk consistency repair and no unreviewed bulk attachment; the reviewed initial-project import is the only multi-file intake path.
- No reconciliation CLI or permanent evidence subsystem.
- No roles beyond Administrator, Editor, and Viewer; no invitations, teams-within-teams, per-chapter permissions, or custom role builder.
- No new UI framework, state-management library, XML parser, or test framework.

## Hostile Review of the Small-Team Plan

| Challenge | Decision |
|---|---|
| Could existing IDs still block append? | No. They are shown and skipped; valid new rows remain selectable. |
| Does a stage folder become another chapter? | No. The importer groups all stage folders beneath one mapped chapter and appends confirmed history records to that single record. |
| Can the folder import build a full chapter database by itself? | No, because folder names do not reliably contain titles, contributors, or contacts. Initial setup uses the reviewed CSV/JSON chapter-list import for those records, then the project-folder import attaches the existing stage history without manual per-file entry. |
| Could empty template folders falsely advance progress? | No. Only a confirmed substantive file or explicit manual record enters history; empty folders are ignored. |
| Is skipping existing CSV data too limited? | CSV/JSON chapter-list imports skip existing IDs, while the purpose-built initial-project import safely appends reviewed stage history to existing chapters. |
| Is concurrency overbuilt for mostly one user? | One revision transaction is retained because it is small and prevents the only serious two-editor failure. Rules engines and admin consoles are excluded. |
| Is the DOCX Electron seam too heavy? | It is reduced to one chooser call because Windows creation time is required; no registry or watcher is added. |
| Is initial-project import too complex? | The complexity is confined to one preview planner. It replaces repetitive manual entry for 10–30 chapters, performs no watching or file movement, and applies only explicitly selected rows. |
| Could scanning unexpectedly download a cloud-only Drive file? | The first scan reads metadata only. DOCX contents are opened only after `Inspect selected Word files` and a warning that Drive may hydrate those selected files. |
| Could a partly applied import leave inconsistent chapters? | No. The approved plan is one revision-checked transaction within the stated 50-chapter bound; a conflict changes nothing. |
| Could folder paths or document text leak into Firestore/activity? | No. Only project-relative references and bounded metadata are shared; the absolute root stays in local Electron preferences and document bodies are never stored or logged. |
| Could the app again claim it is connected when data is stale? | The status is driven by the Firestore data listener and last successful refresh, not authentication alone; failure offers Try again with no raw provider error. |
| Will the app still create a mysterious JSON file? | No tracker-data file is created automatically. Backups/reports use Save As; the only internal local preferences file stores the selected project root and contains no credentials or chapter data. |
| Is a permanent activity log excessive for 1–5 people? | No. It deepens the existing immutable audit collection and uses one simple page, not a separate audit service. It is the minimum needed to answer who changed what. |
| Is the Activity Log a forensic security system? | No. Rules bind each event to the authenticated actor and prevent edits/deletes, while atomic app writes prevent missing events. An authenticated member can still append an event under their own identity; a tamper-proof external audit service is intentionally out of scope. |
| Are three roles excessive? | No. Administrator, Editor, and Viewer cover management, editing, and read-only access without a custom permission system. |
| Could removing the hard-coded owner lock everyone out? | The fallback is not removed until a real administrator document is verified. A clean database stops with guided setup instead of granting the first signer administrator access. |
| Does a 200,000-word volume require heavy processing infrastructure? | No. DOCX files are inspected sequentially with bounds; the total is a warning/summary, not a queued compilation job. |
| Is a consistency repair screen necessary? | No. One attention list plus Open chapter is enough at this scale and avoids false bulk repair. |
| Are hashes and provenance intimidating? | They are hidden under File details; the primary view shows stage, date, and word count. |
| Could confirmations become annoying? | Confirmation occurs only before imports and submission writes, not on ordinary navigation. |
| Could “simple” hide errors? | Every failure states whether anything changed and keeps the user's work on screen. |
| Does reduced testing weaken safety? | Tests concentrate on the four deep module interfaces and eight real flows; redundant shallow-module tests are removed when replaced. |

## Self-Review

- The plan retains every control needed to prevent data loss, stale overwrites, unsafe imports, and path leakage.
- The daily interface exposes eight flows, one Backups & Intake page, one Needs attention list, one stage dialog, one Activity page, and one small Team page.
- The data model explicitly separates one chapter from its many stage folders/history records and derives one current UI state.
- The reviewed initial-project import is justified by the known 10–30 chapter scale; watchers, queues, custom permissions, and enterprise audit infrastructure remain excluded.
- Technical details are progressively disclosed rather than removed.
- External action is limited to two explicit pauses: Task 3 may require the user to provision/verify the initial administrator, and Task 7 requires approval for live rules deployment, authentication tests, real-folder inspection, and any production import.
- This plan supersedes the earlier full-scale completion plan and sequential OpenRouter prompts.
