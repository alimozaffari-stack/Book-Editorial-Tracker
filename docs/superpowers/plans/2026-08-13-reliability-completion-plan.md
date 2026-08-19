# Book Editorial Tracker Reliability Completion Implementation Plan

> **Superseded for execution:** Use `2026-08-13-reliability-completion-plan-v2-small-team.md`. This version is retained as the full hostile-review record.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan sequentially in the current working tree. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the unfinished v0.1.4 reliability work without discarding the sound concurrency, stable-origin, authentication, build, or packaging changes already present.

**Architecture:** Keep Firestore `chapters` as the live truth. Put every chapter mutation behind revision-aware transactions, every imported data set behind the same reviewed import planner, every document behind an Electron-owned opaque candidate registry, and every UI metric behind one pure progress resolver. Preserve manuscript files in place and store only reviewed metadata, hashes, and project-relative references.

**Tech Stack:** Electron 40, React 19, TypeScript 5.8, Firebase Authentication and Firestore, Node test runner, Vite, Electron Forge, and the already-added direct dependency `jszip`.

## Global Constraints

- Work only in `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker` unless the user chooses a file or folder through an application dialog.
- Preserve the current dirty worktree. Do not reset, clean, overwrite, or delete user-owned `scripts/` or the existing root evidence files.
- Do not push, install, publish, import production data, scan the real manuscript tree, or apply consistency repairs during Tasks 1-7.
- Firestore `chapters` is the only live shared tracker. JSON is a reviewed backup/import source.
- Never persist or log passwords, OAuth tokens, document bytes, or absolute local paths.
- Never move, rename, copy, upload, overwrite, or delete manuscript files.
- Use failing tests before each behavioral fix. Keep every discovered test in the official `npm test` command.
- Prefix shell commands with `rtk`; use `rtk proxy npm.cmd ...` because the installed RTK has no npm adapter.
- Preserve the current UI visual language; add only controls needed for the approved workflows.
- Use `apply_patch` for edits. Do not use shell redirection or ad-hoc scripts to edit files.
- A task is complete only when its focused tests, `npm test`, and `npm run lint` pass. Run build/make at the task boundaries specified below.
- After each task passes its acceptance gate, make one local task-scoped commit. Do not push. Never stage the user-owned `scripts/` directory or root backup/report artifacts without explicit approval.

## Verified Starting State

- Branch: `codex/desktop-collaboration`, three commits ahead of `origin/main`, with uncommitted implementation work.
- Official suite: 31/31 tests pass, but four discovered test files are omitted.
- Complete discovered suite: 41/42 tests pass; manual submission persistence fails because the incoming submission is discarded.
- TypeScript check passes.
- Vite build and Electron Forge make pass outside the restricted filesystem sandbox.
- Release remains blocked by `docs/verification/2026-08-13-current-implementation-discrepancy-report.md`.

---

### Task 1: Make the test gate truthful and repair the submission transaction seam

**Files:**
- Modify: `package.json`
- Modify: `src/utils/chapterWrites.ts`
- Create: `src/domain/submissionLedger.ts` (canonical pure module; do not use the current Firestore `submissions` collection helper)
- Modify: `src/App.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `firestore.rules`
- Modify: `tests/chapterWrites.test.ts`
- Modify: `tests/manualSubmissionIntegration.test.ts`
- Modify: `tests/submissionLedger.test.ts`
- Create: `tests/firestoreRules.test.mjs`
- Remove after replacement is tested: `src/utils/submissionLedger.ts`

**Interfaces:**

```ts
appendSubmissionWithRevision(
  db: Firestore,
  chapterId: string,
  submission: SubmissionRecord,
  expectedRevision: number,
  actor: string,
): Promise<WriteResult>

voidSubmissionWithRevision(
  db: Firestore,
  chapterId: string,
  submissionId: string,
  reason: string,
  expectedRevision: number,
  actor: string,
): Promise<WriteResult>
```

- [ ] Create a local checkpoint commit containing the current task-related source/tests plus the approved plan and verification artifacts. Explicitly exclude `scripts/` and the root CSV/Markdown/test-log artifacts; do not push the checkpoint.
- [ ] Add all 14 currently discovered test files plus each new test introduced by this plan to the explicit `npm test` command, including `chapterImportPlan`, `manualSubmissionIntegration`, `progressDiscrepancy`, and `submissionUtils`.
- [ ] Run `rtk proxy npm.cmd test` and record the expected pre-fix manual-submission failure.
- [ ] Replace the failing test's new-document shortcut with public-behavior cases for append to an existing chapter, stale revision, duplicate SHA, preservation of concurrent fields, and void-with-reason.
- [ ] Keep `saveChapterWithRevision` for general form fields; it must preserve server-current submissions. Add a dedicated transaction that reads the chapter, verifies `dataRevision`, rejects an active same-SHA record, appends one record, projects the exact legacy status/date/word-count fields, increments the revision, and writes once.
- [ ] Route `SubmissionIntakeDialog -> ChapterDetail -> App` through the dedicated append callback. The modal must stay open on failure or conflict.
- [ ] Restore every basic-information field present before the unfinished rewrite: title, contributor, email, institutional affiliation, folder/reference, lead editor, and contact person. Preserve the approved visual layout and all legacy workflow sections.
- [ ] Make `Reload latest` replace `formData` with the conflict payload and its current revision before clearing the overlay. It must not merely dismiss the warning.
- [ ] Route batch status updates through revision-incrementing field updates and make bootstrap create chapters only when absent. Inventory every `chapters` write and prove no general mutation bypass remains.
- [ ] Tighten chapter update rules so an authenticated editor update must increment `dataRevision` exactly once; retain the legacy-create path with revision `1`. Document that rule deployment is external and defer deployment to Task 8.
- [ ] Add a static rules-contract test for authenticated editor access, create revision `1`, exact single-step update increments, and immutable audit events. The final live proof remains the Task 8 deployment/smoke gate.
- [ ] Delete the unused helper that writes to a top-level Firestore `submissions` collection; submission history remains embedded in its chapter.
- [ ] Run focused transaction/ledger tests, then `rtk proxy npm.cmd test` and `rtk proxy npm.cmd run lint`.

**Acceptance:** The official suite includes every test, a confirmed submission is stored exactly once inside its chapter, a stale editor cannot overwrite it, and a general chapter save cannot erase it.

---

### Task 2: Replace divergent panel rules with one evidence resolver

**Files:**
- Create: `src/domain/chapterProgress.ts`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/TasksView.tsx`
- Modify: `src/components/ChapterList.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `tests/progressDiscrepancy.test.ts` and rename to `tests/chapterProgress.test.ts`
- Remove after consumers migrate: `src/utils/progressDiscrepancy.ts`

**Interfaces:** Use the exact `ChapterProgress`, `ChapterDiscrepancy`, `deriveChapterProgress`, and `findChapterDiscrepancies` contracts from the authoritative 2026-08-12 plan.

- [ ] Write a matrix covering non-empty abstract/bio with `No` flags, active initial/revision/final ledger records, case/whitespace variants, voided records, conflicting legacy flags, and latest active word count.
- [ ] Implement the pure resolver so non-empty content is evidence on file, active ledger records are submission evidence, and conflicting flat flags create discrepancies rather than hiding evidence.
- [ ] Delete Dashboard's local `isYes`/`getChapterStatus` derivation and TasksView's exact `!== 'Yes'` logic. All summary counts, task chips, chapter badges, and charts must consume the resolver.
- [ ] Retain direct content rendering in Abstracts and Bios, but verify their on-file counts equal resolver results for the same chapters.
- [ ] Run focused tests, the official suite, and TypeScript checking.

**Acceptance:** Dashboard, Tasks, Chapters, Abstracts, and Bios reach the same conclusion for every tested chapter object.

---

### Task 3: Complete reviewed CSV and JSON import with revision-safe application

**Files:**
- Modify: `src/domain/chapterImportPlan.ts`
- Create: `src/domain/chapterImportApply.ts`
- Create: `src/utils/backupImport.ts`
- Create: `src/components/ImportPreviewDialog.tsx`
- Create: `src/components/BackupIntakeView.tsx`
- Modify: `src/components/ChapterIntake.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/chapterImportPlan.test.ts`
- Create: `tests/chapterImportApply.test.ts`
- Create: `tests/backupImport.test.ts`

**Interfaces:**

```ts
parseBackup(contents: string): BackupParseResult
applyChapterWriteSet(db: Firestore, writeSet: ChapterWriteSet, actor: string): Promise<ImportApplyResult>
```

- [ ] Expand import-plan tests for `skip`, `fill-blanks`, and `replace-selected-fields`, including selected-field allowlisting, case-insensitive IDs, invalid rows, ambiguous in-file duplicates, and unchanged existing defaults.
- [ ] Render a review dialog with row number, disposition, messages, existing/incoming differences, and explicit duplicate strategy controls. Apply stays disabled while any ambiguous/invalid row is selected or any duplicate lacks a resolution.
- [ ] Add a `Backups & Intake` navigation workspace containing Save JSON backup, Export CSV, and Preview JSON import. Remove the standalone bottom-of-sidebar import button. Task 6 adds folder/report actions and Task 7 adds Consistency Review after those components exist.
- [ ] Re-read every affected chapter inside the apply transaction. Create only if absent; update only if `dataRevision` equals `baselineRevision`; never call blind `batch.set` for an imported chapter.
- [ ] Accept backup v1, v2, and legacy chapter arrays with size/type/schema/duplicate-ID validation. Route backup chapters through the identical preview and apply seam.
- [ ] Treat users and audit events in a backup as read-only recovery evidence in v0.1.4; display their counts but do not overwrite identity or audit collections from the client.
- [ ] Replace the destructive backup `window.confirm` path and remove every direct import `batch.set` call from `App.tsx`.
- [ ] Add tests for a stale revision abort, pre-existing target during create, empty write set, mixed new/duplicate file, unsupported backup, and no writes before approval.
- [ ] Run focused tests, official suite, TypeScript checking, and `rtk proxy npm.cmd run build`.

**Acceptance:** No CSV or JSON file can write before a visible review, valid new rows are not blocked by existing IDs, duplicate behavior is user-selected, and stale/import races cannot overwrite data.

---

### Task 4: Build the bounded Electron DOCX candidate boundary

**Files:**
- Create: `electron/document-intake.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Replace: `src/utils/docxInspection.ts`
- Modify: `tests/docxInspection.test.ts`
- Create: `tests/documentIntake.test.cjs`

**Interfaces:** Use the exact `LocalDocumentCandidate`, `FolderScan`, `DocxInspection`, and four preload methods from the authoritative plan.

- [ ] Add Electron adapter tests proving `.docx` only, 25 MiB compressed limit, SHA-256, `birthtime`/`mtime`, opaque IDs, no absolute renderer path, rejection of renderer-supplied paths, session cleanup, and failure logging without paths.
- [ ] Add in-memory ZIP tests for only `word/document.xml`, `docProps/app.xml`, and `docProps/core.xml`; 10 MiB limit per allowed XML entry; missing/malformed entries; `<Words>` precedence; `w:t` fallback; title, creator, created, and modified metadata.
- [ ] Move file selection and filesystem metadata to Electron main. Keep a session-scoped map from random candidate ID to validated real path and expose only the four approved preload calls.
- [ ] Make renderer inspection accept candidate metadata plus bytes fetched by candidate ID. It must not accept arbitrary paths or persist bytes.
- [ ] Change `save-local-export` logging to record only export type, byte count, success/failure, and duration; never the selected absolute path.
- [ ] Run focused Node/TypeScript tests, official suite, TypeScript checking, build, and Electron Forge package.

**Acceptance:** Renderer and shared data never receive absolute manuscript paths, DOCX metadata/word counts meet the accepted contract, and malformed or oversized input fails closed.

---

### Task 5: Finish manual submission intake and ledger presentation

**Files:**
- Create: `src/domain/submissionIntake.ts`
- Create: `src/components/SubmissionLedger.tsx`
- Modify: `src/components/SubmissionIntakeDialog.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `tests/manualSubmissionIntegration.test.ts`
- Create: `tests/submissionIntake.test.ts`

- [ ] Test selection cancellation, invalid/unsupported document, duplicate hash, all detected metadata, required revision number, valid positive revision, confirmed ISO date, calculated versus property word-count source, manual correction, save conflict, successful append, and void reason.
- [ ] Replace the direct browser `File` path with Task 4's candidate methods. Display filename, size, filesystem/DOCX dates, calculated count, selected count, and count source.
- [ ] Make DOCX required for file-backed intake. Prefill `submittedOn` from filesystem modified time but require explicit user confirmation and label it as proposed rather than factual.
- [ ] Preserve `calculatedWordCount` even when the editor corrects `wordCount`; set `wordCountSource='manual'` only after a manual edit.
- [ ] Render active and voided records chronologically with stage/revision, confirmed date, filename, count/source, hash prefix, actor, and state.
- [ ] Use Task 1 transactions only; do not add another Firestore collection or write seam.
- [ ] Run focused tests, official suite, and TypeScript checking.

**Acceptance:** A Revision 02 DOCX produces one reviewed record with correct provenance and legacy projection, and every consuming panel updates from the same chapter snapshot.

---

### Task 6: Complete conservative folder intake, path privacy, and Drive retirement

**Files:**
- Create: `src/domain/folderIntake.ts`
- Create: `src/components/FolderIntake.tsx`
- Modify: `src/audit/auditEngine.ts`
- Modify: `src/components/WorkingFolderAudit.tsx`
- Modify: `src/components/BackupIntakeView.tsx`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Modify: `src/utils/backupExport.ts`
- Modify: `src/components/ChapterIntake.tsx`
- Modify: `src/utils/chapterImport.ts`
- Modify: `src/components/ChapterList.tsx`
- Modify: `tests/auditEngine.test.ts`
- Create: `tests/folderIntake.test.ts`
- Delete after replacement is verified: `src/utils/googleDrive.ts`, `src/components/GDriveSyncView.tsx`
- Modify: `README.md`

- [ ] Change the equal-ranked audit fixture to expect `ambiguous`; implement deterministic ambiguity detection before accepting a selected file.
- [ ] Implement the exact C01-CH12 suggestions, CH00 composite ambiguity, revision/final-folder suggestions, exclusions, candidate bounds, and known C03/C05/C07/C08/C09 fixtures from the authoritative plan.
- [ ] Require explicit chapter, stage, revision, and candidate confirmation. Inspect bytes only for selected DOCX candidates; never write while building the preview.
- [ ] Escape commas/quotes/newlines in CSV and pipes/newlines/backslashes in Markdown. Add malicious-filename tests.
- [ ] Extend the bounded Save As IPC to `.md` evidence reports with filename and size validation. Save reports only through Electron Save As. Remove `readwrite` directory access, manifest dependence for initial intake, and report creation under the manuscript root.
- [ ] Validate new `folderUrl` values as either HTTPS URLs or normalized project-relative references. Reject drive letters, UNC paths, `file:` URLs, traversal, and absolute POSIX paths in manual, CSV, and JSON flows. Report existing unsafe values for user review; do not rewrite them automatically.
- [ ] Before JSON export, detect unsafe absolute `folderUrl` values. Fail closed with chapter IDs and direct the user to Consistency Review; never serialize an absolute path into a backup.
- [ ] Delete Drive API helper/view remnants and remove Drive API/sync instructions. Keep Google sign-in only for Firebase authentication.
- [ ] Run focused tests, official suite, TypeScript checking, and build.

**Acceptance:** The user can preview a bounded folder scan without mutating it; ambiguous/unsupported items remain unresolved; no new absolute path or Drive-sync code can enter the shared tracker.

---

### Task 7: Replace unsafe consistency repair and generate real reconciliation evidence

**Files:**
- Create: `src/domain/chapterReconciliation.ts`
- Create: `src/components/ConsistencyReview.tsx`
- Modify: `src/utils/consistencyRepair.ts` or remove it after migration
- Modify: `src/App.tsx`
- Create: `tests/chapterReconciliation.test.ts`
- Create: `tools/reconcile-snapshots.mjs`
- Create: `tests/reconcileSnapshots.test.mjs`
- Remove after replacement is verified: `generateArtifacts.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/RELEASE_NOTES_v0.1.4.md`

- [ ] Restrict proposals to direct evidence: non-empty abstract -> abstract flag; non-empty bio -> bio flag; active ledger -> exact legacy projection. Never fabricate word counts, URLs, dates, or submission facts.
- [ ] Require a JSON backup created in the current app session before Apply. Show chapter, field, current value, evidence, proposed value, and selection state.
- [ ] Apply one revision-checked transaction per chapter and report successful, stale, and failed IDs without silent retry.
- [ ] Make unsafe existing absolute paths report-only until the user supplies an HTTPS or project-relative replacement.
- [ ] Replace the static initial-data generator with a standard-library CLI requiring explicit `--before`, `--after`, `--ledger`, `--report`, and `--log` paths. Its log and outputs must contain processed/matched/unmatched/ambiguous/changed/failed counts and never document contents or absolute manuscript paths.
- [ ] Add deterministic snapshot fixtures and prove CSV/Markdown escaping, unchanged chapters, added/removed IDs, progress transitions, word-count changes, and submission-count changes.
- [ ] Update release documentation to match actual Firestore sync, backup/import preview, DOCX intake, folder intake, conflict, privacy, recovery, and known limitations.
- [ ] After every Task 7 gate passes, bump package and lockfile versions together from `0.1.3` to `0.1.4`; do not install, tag, or publish.
- [ ] Run focused tests, official suite, TypeScript checking, build, and make.

**Acceptance:** Consistency changes are truthful, selected, backup-gated, and conflict-safe; release evidence compares explicit before/after snapshots rather than bundled seed data.

---

### Task 8: Independent release gate and user-controlled smoke test

**Files:**
- Produce: timestamped test log, reconciliation CSV ledger, and Markdown discrepancy report in a user-approved evidence location.
- Modify production files only when a reproduced defect requires a scoped repair and its focused regression test is added first.

- [ ] Confirm `rg --files tests` exactly matches the explicit test list in `package.json`.
- [ ] Run sequentially: `rtk proxy npm.cmd test`, `rtk proxy npm.cmd run lint`, `rtk proxy npm.cmd run build`, and `rtk proxy npm.cmd run make`. A sandbox Access Denied result is environmental only if the same command passes outside the sandbox.
- [ ] Confirm `git diff --check` passes and inspect the complete diff against the authoritative plan and the verification ledger.
- [ ] Verify no token, password, absolute path, manuscript content, direct Drive API, top-level submissions write, blind import `batch.set`, or fabricated consistency placeholder remains.
- [ ] Stop and ask the user to participate before launching the packaged application. Ask the user to sign in with the existing test/account credentials, restart once, choose a disposable CSV/JSON fixture, and select the real project folder only for a read-only preview.
- [ ] Ask separately for permission to deploy the reviewed `firestore.rules` before any live write-path smoke case; if not authorised, mark live concurrency enforcement Partial and do not claim release readiness.
- [ ] Run the ten packaged-app smoke cases from the authoritative Task 10. Do not apply a production import or repair during smoke testing.
- [ ] Hash sampled manuscript files before and after the real-folder preview and confirm no file or report was created, moved, renamed, overwritten, or uploaded.
- [ ] Generate the explicit before/after reconciliation artifacts and retain the pre-update backup until the user accepts the release.
- [ ] Only after all gates pass, ask separately for authority to install, commit, push, tag, or publish v0.1.4.

**Acceptance:** Automated and user-controlled evidence covers the broken workflows, the manuscript tree is unchanged, and no material unresolved finding remains.

## Hostile Review of This Completion Plan

| Attack | Risk in a weaker plan | Resolution incorporated here |
|---|---|---|
| Make the failing test green by changing its expectation | Submission loss remains hidden | Task 1 replaces the shortcut test with a dedicated public transaction and exact persistence assertions. |
| Preserve all current code because it compiles | Unsafe duplicate modules and blind writes survive | Each task identifies the seam to keep and the obsolete helper to remove only after focused replacement tests pass. |
| Repair imports before concurrency | Previewed data can still overwrite live edits | Submission/write invariants are repaired first; import applies through revision-aware transactions in Task 3. |
| Treat a domain import planner as a user preview | Users cannot choose duplicate behavior | Task 3 requires rendered row-level differences and explicit strategies before Apply enables. |
| Parse DOCX in the renderer because browser File is convenient | Filesystem provenance and path isolation cannot be enforced | Task 4 establishes the Electron candidate boundary before Task 5 UI work. |
| Keep a conflict button labelled Reload without updating state | The next save repeats stale data | Task 1 requires the server-current conflict payload to replace modal state. |
| Add new workflows without a navigation home | Features exist in code but remain undiscoverable | Task 3 creates Backups & Intake; Tasks 6 and 7 attach their entry points there. |
| Fix only the main Save button | Batch and bootstrap operations still bypass revisions | Task 1 inventories all chapter writes and routes each approved mutation through a revision-aware seam. |
| Auto-clean legacy absolute paths | Historical references are silently destroyed | Task 6 blocks new unsafe paths; Task 7 reports existing ones and requires a user-supplied replacement. |
| Let consistency repair fill missing facts | Tracker gains plausible but false dates, links, and counts | Task 7 permits only direct evidence and explicitly bans fabricated values. |
| Trust `npm test` without inventorying tests | Four suites remain invisible | Tasks 1 and 8 compare the filesystem inventory with the manifest. |
| Treat build/package success as release readiness | Core workflows can still lose data | Task 8 keeps specification, privacy, live workflow, and packaging gates independent. |
| Run against the real `G:` tree too early | A scanner bug could mutate manuscripts | Tasks 4-7 use synthetic fixtures; real folder access occurs only as a final read-only user-controlled preview with before/after hashes. |
| Restore users/audit events from client JSON | Identity or audit history can be overwritten | Task 3 imports chapters only and reports other collection counts as non-importable recovery evidence. |
| Use seed data for release evidence | Reconciliation says nothing about live state | Task 7 requires explicit before/after snapshots and a logged CLI with counts. |
| Ask for external credentials during automated repair | Secrets and production state enter development work | External participation is deferred to Task 8 and requested at the moment it is needed. |

## Self-Review Result

- **Coverage:** All 19 rows in the 2026-08-13 verification ledger map to a task and acceptance gate.
- **Ordering:** Data-write invariants precede import, document, folder, and repair workflows that depend on them.
- **Rollback:** No production mutation occurs before a current-session backup and explicit review; obsolete code is removed only after its replacement passes focused tests.
- **Test truthfulness:** The official suite must equal the discovered suite, and packaged behavior remains a separate gate.
- **External dependency:** No external action is needed for Tasks 1-7. Task 8 explicitly pauses for Firebase sign-in and the real-folder read-only preview.
- **Scope:** The plan completes the approved v0.1.4 behavior and removes incomplete duplicate paths; it adds no watcher, upload service, new database, or new parser dependency.
