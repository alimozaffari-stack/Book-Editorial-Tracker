# Small-Team Corrections, Project Lifecycle, and Public Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the current tracker’s workflow truth and conflict UX, add safe local opening of recorded chapter files, provide a backup-first new-project/reset flow, and then create public local/shared-folder storage modes without weakening the current Firebase team edition.

**Architecture:** Deliver three sequential, independently releasable stages. Stage A changes the existing Firebase desktop application only. Stage B adds a minimal current-project record, help page, and coordinated administrator reset while retaining the existing roster and audit history. Stage C introduces a backend boundary and portable project files; Firebase remains the concurrent backend, while local and shared-folder modes are explicitly non-concurrent.

**Tech Stack:** React 19, TypeScript 5.8, Electron 40, Firebase 12/Cloud Firestore, Node test runner, Vite 6, Electron Forge, Windows 11/PowerShell.

## Global Constraints

- Work only in `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker`.
- Preserve the dirty worktree. Never reset, clean, pull, push, install, deploy, or modify unrelated files.
- Do not stage or commit automatically. The owner decides whether and how to commit the dirty tree.
- Do not rename, move, modify, or delete any original Google Drive document or folder.
- Opening a document is allowed; the tracker itself must perform no write to that document.
- Never sync an absolute local path to Firebase, activity, backup JSON, CSV, or a portable project file.
- Existing HTTPS and project-relative reference validation remains fail-closed.
- Firebase remains the only mode that promises concurrent editing.
- Local and shared-folder modes must say `One editor at a time` in the UI and documentation.
- Do not add packages. Use existing Electron, React, Firebase, Node, and browser APIs.
- Keep verification proportionate: focused tests per task, the existing full suite at release boundaries, and a short manual smoke script.
- Stop for explicit approval before deploying Firestore rules, running a live reset, packaging, installing, or modifying any selected shared-folder project file.
- For the final hostile review, stop and ask the owner to switch the reviewing model/provider before beginning that review.

## Authoritative supporting documents

- `docs/verification/2026-08-15-product-workflow-audit.md`
- `docs/verification/2026-08-15-product-workflow-audit-ledger.csv`
- `docs/verification/2026-08-13-provider-handoff.md`
- `docs/superpowers/plans/2026-08-13-reliability-completion-remainder-handoff.md`

## Required execution method

1. Execute tasks in order; do not parallel-edit shared files.
2. At the beginning of each task, run `rtk git status --short` and preserve every pre-existing change.
3. Use `apply_patch` for source and documentation edits.
4. Run only the focused test named in that task while iterating.
5. End each task with `rtk git diff --check -- <task files>` and inspect the diff.
6. Do not continue when a named file or interface differs materially from this plan. Record the discrepancy and stop instead of inventing an alternative.

## Locked design decisions

These choices are already resolved; an executor must not reopen them without the owner's approval.

1. **File locations:** Do not store absolute paths in Firebase. Resolve a confirmed project-relative stage path from the locally selected root, or resolve a manually selected file from a local SHA-256 index. Storing absolute paths in Firestore was rejected as private and machine-specific; making every legacy folder label clickable was rejected because labels such as `00_1ST MANUSCRIPT SUBMISSION` are ambiguous across chapters.
2. **Click behaviour:** Provide both `Open document` and `Show in folder`. `Show in folder` is the safer action for protected source trees. `Open document` deliberately hands the file to Word/the operating system and must explain that subsequent external edits are outside the tracker.
3. **Conflict resolution:** Preserve stage-history immutability. Resolve a duplicate by voiding the mistaken record with a reason; do not silently overwrite or edit the old record in place.
4. **Project reset:** Keep the current single-project Firestore collections. A coordinated backup-first reset clears bounded chapter records, starts a new project state, and retains roster/activity. Building a commercial multi-project database was rejected as disproportionate.
5. **Public storage:** Firebase is concurrent. Local and shared-folder project files are one-editor-at-a-time. Automatic shared-file merging was rejected.

---

## Gate 0: Baseline and safety record

**Files:**

- Read: `package.json`
- Read: `src/types.ts`
- Read: `src/App.tsx`
- Read: `electron/main.cjs`
- Read: `electron/preload.cjs`
- Read: `firestore.rules`
- Read: the four authoritative documents listed above
- Create after verification: `docs/verification/2026-08-15-corrections-baseline.md`

- [ ] **Step 1: Record the dirty tree without changing it**

Run:

```powershell
rtk git status --short
rtk git diff --stat
```

Copy the output into the baseline document. Do not stage, revert, or repair unrelated entries.

- [ ] **Step 2: Confirm the expected application version and scripts**

Run:

```powershell
rtk read package.json
```

Expected: version `0.1.4`; scripts named `test`, `lint`, `build`, and `make`; Electron entry point `electron/main.cjs`.

- [ ] **Step 3: Run the current non-mutating automated baseline**

Run:

```powershell
rtk npm test
rtk npm run lint
rtk npm run build
```

Expected: all three commands pass. If any fails, record the exact failure and stop before editing.

- [ ] **Step 4: Record protected boundaries**

The baseline document must state:

```text
No package installation, Firebase deployment, installer execution, live reset,
or write to an original Google Drive source folder is authorised by this plan.
```

**Gate 0 acceptance:** baseline commands pass, the dirty-tree inventory is recorded, and no workspace file other than the baseline document changed.

---

# Stage A — Current Firebase app corrections

Stage A is the first releasable boundary. Complete Tasks 1–5 before starting project lifecycle or public storage work.

### Task 1: Safely open or reveal a recorded Word document

**Files:**

- Create: `electron/stage-source-policy.cjs`
- Create: `tests/stageSourcePolicy.test.cjs`
- Create: `src/components/StageSourceActions.tsx`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Modify: `src/components/StageHistory.tsx`
- Modify: `src/components/ChapterList.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `src/App.tsx`
- Modify: `package.json` only to append the new test file to the existing `test` command

**Interfaces:**

```ts
export type StageSourceAction = 'open' | 'reveal';

export interface StageSourceRequest {
  sourceRelativePath?: string;
  sourceSha256?: string;
  action: StageSourceAction;
}

export interface StageSourceResult {
  ok: boolean;
  message: string;
}
```

Add to `window.editorialTracker`:

```ts
openStageSource: (request: StageSourceRequest) => Promise<StageSourceResult>;
```

Renderer components must never receive an absolute file path from this API.

- [ ] **Step 1: Write the path-policy tests**

`tests/stageSourcePolicy.test.cjs` must test these exact cases:

Use these exact Node test names and assertions:

- `resolves a regular project-relative DOCX inside the selected root`: result is `ok`, and the resolved path equals the injected real candidate.
- `rejects traversal and absolute source references`: `../file.docx`, `C:\file.docx`, UNC, and `file:` inputs all return `ok: false`.
- `rejects a junction or real path outside the selected root`: an injected candidate real path outside the injected root returns `ok: false`.
- `rejects non-DOCX and files larger than 25 MiB`: both inputs return `ok: false`.
- `rejects a local-index file whose SHA-256 no longer matches`: result is `ok: false` and message contains `changed`.
- `returns unavailable when neither project root nor local hash index resolves`: result is `ok: false` and message contains `not available on this computer`.

Use dependency injection for `realpathSync`, `lstatSync`, and hashing so tests use synthetic paths and do not touch Google Drive.

- [ ] **Step 2: Run the new test and verify failure**

Run:

```powershell
rtk proxy node --test tests/stageSourcePolicy.test.cjs
```

Expected: FAIL because `electron/stage-source-policy.cjs` does not exist.

- [ ] **Step 3: Implement the pure path policy**

Export these functions from `electron/stage-source-policy.cjs`:

Export exactly `isSha256`, `resolveProjectStageFile`, and `resolveIndexedStageFile` from the CommonJS module. `isSha256(value)` returns a boolean. The two resolver functions return `{ ok: true, filePath }` or `{ ok: false, message }`; they never expose a path in a failure message.

Required algorithm:

1. Accept only a 64-character lowercase/uppercase hexadecimal SHA-256 when a hash is supplied.
2. Accept only a non-empty project-relative reference with no drive, UNC, `file:`, traversal, or absolute prefix.
3. Resolve both the selected root and candidate with `realpathSync`.
4. Require the real candidate to remain inside the real root.
5. Require a regular, non-symbolic-link `.docx` no larger than 25 MiB.
6. When resolving from the local index, calculate the current SHA-256 and require it to equal the requested hash.
7. Return a result object; do not throw raw filesystem errors across IPC.

- [ ] **Step 4: Add a local-only document index in Electron**

In `electron/main.cjs`, store the index at:

```js
path.join(app.getPath('userData'), 'stage-document-index.json')
```

The file format is:

```json
{
  "version": 1,
  "entries": {
    "64-character-sha256": "absolute-path-known-only-to-electron"
  }
}
```

Rules:

- keep at most 500 entries;
- discard invalid JSON and start with an empty index;
- write only under Electron `userData`;
- after `select-docx` and `inspect-project-docx` calculate the hash, record `hash -> real file path` before returning metadata;
- never return the index or absolute path to the renderer.

- [ ] **Step 5: Add the constrained IPC handler**

Add `open-stage-source` in `electron/main.cjs` and expose it in `electron/preload.cjs`.

Resolution order:

1. When `sourceRelativePath` and `selectedProjectRoot` exist, use `resolveProjectStageFile`.
2. Otherwise, when `sourceSha256` exists, use `resolveIndexedStageFile`.
3. If neither resolves, return:

```text
This document is not available on this computer. Choose the project folder in Backups & intake, or select the document again.
```

For `action: 'open'`, call `shell.openPath`. Treat its non-empty returned string as failure. For `action: 'reveal'`, call `shell.showItemInFolder`.

- [ ] **Step 6: Add one reusable renderer control**

`StageSourceActions.tsx` receives:

```ts
interface Props {
  record: ChapterStageRecord;
  compact?: boolean;
}
```

Behaviour:

- filename button: `Open document`;
- adjacent folder icon/button: `Show in folder`;
- display the stable IPC message inline on failure;
- disable both controls while an action is pending;
- do not render controls when the record has neither `sourceRelativePath` nor `sourceSha256`.

- [ ] **Step 7: Wire the controls into both views**

- In `StageHistory.tsx`, replace plain `sourceFileName` text with `StageSourceActions`.
- In `ChapterList.tsx`, obtain the current active record from `deriveChapterProgress(chapter).currentStage.record`.
- Rename the column from `Submission URL` to `Submission location`.
- If that record has a safe source reference, show `Open document` and `Show folder` in the Submission column.
- Otherwise preserve the existing HTTPS link.
- Otherwise continue to show `Folder reference only`; never guess a local folder from the legacy label.
- Viewers may use these read-only controls.

- [ ] **Step 8: Run focused verification**

Run:

```powershell
rtk proxy node --test tests/stageSourcePolicy.test.cjs
rtk npm run lint
rtk git diff --check -- electron/stage-source-policy.cjs electron/main.cjs electron/preload.cjs src/electron-api.d.ts src/components/StageSourceActions.tsx src/components/StageHistory.tsx src/components/ChapterList.tsx src/components/ChapterDetail.tsx src/App.tsx tests/stageSourcePolicy.test.cjs package.json
```

Expected: tests and TypeScript pass; no absolute path appears in `src/types.ts`, Firestore records, or UI props.

**Task 1 manual smoke:** Use a copied/synthetic `.docx` outside the protected source tree. Confirm Open launches Word, Show in folder selects the file, and a missing file gives the stable message. Hash the synthetic document before and after opening/closing without saving and confirm its bytes are unchanged. Do not run this smoke against the protected Google Drive source tree: Word itself may create a temporary lock file beside an opened document even though the tracker performs no document write.

---

### Task 2: Make stage conflicts specific and prevent new same-rank records

**Files:**

- Modify: `src/domain/chapterProgress.ts`
- Modify: `src/domain/chapterStageHistory.ts`
- Modify: `src/types.ts`
- Modify: `src/utils/chapterWrites.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `src/components/StageHistory.tsx`
- Modify: `tests/chapterProgress.test.ts`
- Modify: `tests/chapterWrites.test.ts`

**Interfaces:**

```ts
export type DiscrepancySeverity = 'blocking' | 'cleanup';
export type DiscrepancyCode = 'duplicate-active-rank' | 'legacy-abstract-status' | 'missing-abstract-evidence';

export interface ChapterDiscrepancy {
  code: DiscrepancyCode;
  severity: DiscrepancySeverity;
  message: string;
  field: string;
  recordIds?: string[];
}

export interface ActiveStageConflict {
  rank: number;
  stageLabel: string;
  records: ChapterStageRecord[];
}
```

Extend `WriteResult` with:

```ts
| { kind: 'stage-conflict'; current: Chapter; conflictingRecords: ChapterStageRecord[] }
| { kind: 'unchanged'; current: Chapter }
```

- [ ] **Step 1: Replace the generic conflict tests with exact assertions**

Add tests asserting that two active Initial manuscript records produce:

```text
Duplicate active stage: Initial manuscript. Two records are active (22 Jan 2026, 7,936 words; 14 Apr 2026, 9,604 words). Choose the canonical record.
```

Also assert `severity === 'blocking'`, `code === 'duplicate-active-rank'`, and both record IDs are included.

Format `effectiveOn` with `Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })` after parsing the stored calendar date at UTC midnight. This prevents a machine timezone from changing the named date.

- [ ] **Step 2: Add and test the conflict-group helper**

Export from `chapterStageHistory.ts`:

```ts
export function activeStageConflicts(records: ChapterStageRecord[] | undefined): ActiveStageConflict[];
```

Group active records by `chapterStageRank(record)`. Return only groups with more than one record. Sort records by `effectiveOn`, then `recordedAt`, then `id` for deterministic display.

- [ ] **Step 3: Block a manual duplicate before writing**

In `appendStageRecordWithRevision`, after revision and exact-hash checks, compare the incoming record rank with every active existing record. If a match exists, return `stage-conflict` without writing the chapter or activity event.

Add a test proving:

```ts
assert.equal(result.kind, 'stage-conflict');
assert.equal(mockStore.CH01.dataRevision, originalRevision);
assert.equal(activityEventCount(), 0);
```

- [ ] **Step 4: Show a resolvable editor message**

`ChapterDetail` must translate `stage-conflict` into:

```text
Nothing was saved. This chapter already has an active Initial manuscript record dated 22 Jan 2026. Resolve that record or choose another stage.
```

In `StageHistory`, apply a visible `Conflict` badge to every `recordIds` member. Reuse the existing `Mark as entered by mistake` transaction and required-reason dialog as the resolution mechanism. Do not add an automatic reclassification write. If a record is actually a revision, the editor first voids the mistaken stage and then adds it correctly as Revision 01.

- [ ] **Step 5: Verify Task 2**

Run:

```powershell
rtk proxy node --import tsx --test tests/chapterProgress.test.ts tests/chapterWrites.test.ts
rtk npm run lint
rtk git diff --check -- src/domain/chapterProgress.ts src/domain/chapterStageHistory.ts src/types.ts src/utils/chapterWrites.ts src/App.tsx src/components/ChapterDetail.tsx src/components/StageHistory.tsx tests/chapterProgress.test.ts tests/chapterWrites.test.ts
```

**Task 2 manual smoke:** Use synthetic records or a development copy, not the live CH01 record. Confirm the existing conflict is named, adding a third same-rank record saves nothing, and voiding one record removes the blocking conflict.

---

### Task 3: Establish one truth for abstract presence and reorganize Dashboard checks

**Files:**

- Modify: `src/domain/chapterProgress.ts`
- Modify: `src/components/NeedsAttention.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/ChapterList.tsx`
- Create: `src/components/MetadataReconciliationDialog.tsx`
- Modify: `tests/chapterProgress.test.ts`

**Interfaces:**

```ts
export interface AbstractPresence {
  present: boolean;
  evidence: Array<'active-abstract-stage' | 'abstract-text' | 'legacy-yes'>;
  legacyStatus: string;
}

export function deriveAbstractPresence(chapter: Chapter): AbstractPresence;
export function abstractStatusReconciliationIds(chapters: Chapter[]): string[];
```

- [ ] **Step 1: Write four focused truth tests**

The tests must assert:

1. non-empty `abstractText` means present even when the legacy flag is `No`;
2. an active abstract stage means present;
3. legacy `Yes` means present when no stronger evidence exists;
4. initial manuscript evidence with none of the three abstract signals produces a cleanup warning.

For Smith-like data, expected discrepancy:

```ts
{
  code: 'legacy-abstract-status',
  severity: 'cleanup',
  message: 'Abstract text is present. The imported legacy status is No.',
  field: 'initialAbstractSubmitted'
}
```

It must not say that the abstract is absent.

- [ ] **Step 2: Implement the derived truth and severity**

Use `deriveAbstractPresence` everywhere discrepancy logic asks whether the abstract exists. Do not change imported data automatically merely because a chapter or Dashboard is opened.

- [ ] **Step 3: Group the Dashboard by chapter and severity**

Change the heading to `Workflow and data checks`.

Render two sections:

- `Resolve first` for blocking findings;
- `Imported metadata to review` for cleanup findings.

Render one chapter container with all its messages, not one disconnected row per message. The Chapters badge must display `1 conflict` when any blocking discrepancy exists; otherwise display the cleanup count.

- [ ] **Step 4: Add an explicit reconciliation preview**

`abstractStatusReconciliationIds` returns only chapters where `abstractText` is non-empty or an active abstract stage exists while `initialAbstractSubmitted` is not `Yes`. It must not infer an abstract solely from an initial-manuscript record.

In the cleanup section, show `Reconcile imported abstract statuses` only when the list is non-empty and the role can edit. The dialog lists the exact chapter IDs and proposes only `initialAbstractSubmitted: Yes`. On confirmation, call the existing atomic batch update once. On cancel, write nothing. On success, display one summary and let the live listener clear the cleanup items.

- [ ] **Step 5: Verify Task 3**

Run:

```powershell
rtk proxy node --import tsx --test tests/chapterProgress.test.ts
rtk npm run lint
rtk git diff --check -- src/domain/chapterProgress.ts src/components/NeedsAttention.tsx src/components/Dashboard.tsx src/components/ChapterList.tsx src/components/MetadataReconciliationDialog.tsx tests/chapterProgress.test.ts
```

**Task 3 manual smoke:** Open Smith/CH03 and Dashboard. The abstract remains visible, the current manuscript stage remains visible, and any remaining imported-status message is labelled cleanup rather than missing content.

---

### Task 4: Remove no-op saves and activity noise

**Files:**

- Modify: `src/utils/chapterWrites.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ChapterDetail.tsx`
- Modify: `tests/chapterWrites.test.ts`

- [ ] **Step 1: Add an unchanged-write test**

Given an existing chapter and a byte-for-byte equivalent incoming editable form, assert:

```ts
assert.equal(result.kind, 'unchanged');
assert.equal(mockStore.CH01.dataRevision, originalRevision);
assert.equal(activityEventCount(), 0);
```

- [ ] **Step 2: Make the transaction return without writing**

In `saveChapterWithRevision`, calculate editable changed fields before constructing the merged chapter. If `changedFields.length === 0`, return `{ kind: 'unchanged', current }` without `transaction.set` or activity creation.

- [ ] **Step 3: Add UI dirty tracking**

In `ChapterDetail`, compare the editable form against the last successfully loaded/saved chapter. Exclude `dataRevision`, `updatedAt`, `updatedBy`, and `submissions`.

Rules:

- disable `Save Changes` when no editable field changed;
- after stage append show `Stage record added — no further save is needed.`;
- after an unchanged result show `No chapter fields changed.`;
- keep the modal open after success.

- [ ] **Step 4: Verify Task 4**

Run:

```powershell
rtk proxy node --import tsx --test tests/chapterWrites.test.ts
rtk npm run lint
```

Manual acceptance: opening and closing a chapter creates no activity; adding one stage produces exactly one stage event; editing one title produces exactly one update event.

---

### Task 5: Finalize the project-import screen after a successful apply

**Files:**

- Modify: `src/domain/projectImportPlan.ts`
- Modify: `src/components/BackupIntakeView.tsx`
- Modify: `src/components/ProjectImportPreview.tsx`
- Modify: `tests/projectImportPlan.test.ts`

**Interface:**

```ts
export function finalizeAppliedProjectImport(
  plan: ProjectImportPlan,
  result: ProjectImportResult,
): ProjectImportPlan;
```

- [ ] **Step 1: Write the finalization test**

For six selected/applied records, assert that finalization:

- changes those entries to `Already recorded`;
- changes their message to `Added in this import.`;
- sets `selected` to `false`;
- removes their pending `record`;
- makes selected-for-apply count zero;
- leaves excluded and unsupported rows unchanged.

- [ ] **Step 2: Implement and call finalization**

Call `finalizeAppliedProjectImport` immediately after `onApplyProject` succeeds. Preserve the outcome summary. Do not wait for a Firestore listener refresh to disable the Apply button. Determine applied entries by matching each selected inspected record's `sourceSha256` against the active stage-record hashes in `result.changedChapters`; do not mark a row applied merely because its chapter ID appears in the result.

- [ ] **Step 3: Adjust the completed-state actions**

When `outcome` exists and selected-for-apply is zero:

- hide or disable the Apply button;
- make `View chapters` the visually primary button;
- leave Save scan CSV/Markdown available;
- allow `Change folder` only after the editor leaves or dismisses the success state.

- [ ] **Step 4: Verify the Stage A release boundary**

Run:

```powershell
rtk proxy node --import tsx --test tests/projectImportPlan.test.ts
rtk npm test
rtk npm run lint
rtk npm run build
rtk git diff --check
```

Expected: full suite, TypeScript, build, and diff check pass.

**External approval stop A:** Do not package or install. Report the Stage A results and request explicit owner approval for packaging/installing the corrected Firebase build.

---

# Stage B — Project identity, help, and backup-first reset

Begin Stage B only after Stage A is accepted. This stage changes Firebase data/rules and therefore has separate deployment and live-reset approvals.

### Task 6: Add a minimal current-project record and Project & Help page

**Files:**

- Create: `src/domain/projectState.ts`
- Create: `src/utils/projectWrites.ts`
- Create: `src/components/ProjectHelpView.tsx`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/ActivityView.tsx`
- Modify: `src/utils/backupExport.ts`
- Modify: `src/domain/activityLog.ts`
- Modify: `firestore.rules`
- Create: `tests/projectState.test.ts`
- Modify: `tests/backupExport.test.ts`
- Modify: `tests/firestoreRules.test.mjs`
- Modify: `package.json` to append `tests/projectState.test.ts`

**Data shape at `teamState/project`:**

```ts
export interface ProjectState {
  name: string;
  generationId: string;
  startedAt: string;
  startedBy: string;
  updatedAt: string;
}
```

Validation limits: project name 1–120 trimmed characters; generation ID 1–100 safe characters; ISO timestamps; non-empty starter email.

- [ ] **Step 1: Test project-state validation and activity cutoff**

Tests must cover valid state, blank/overlong name, invalid timestamp, and this filter rule:

```ts
event.clientAt >= project.startedAt
```

Legacy events remain available through an `All retained activity` option.

- [ ] **Step 2: Add the Firestore rule branch**

Under `teamState/{stateId}`:

- roster behaviour remains unchanged;
- members may read `stateId == 'project'`;
- only administrators may create/update `stateId == 'project'` with the exact validated keys;
- no client may delete it.

Add `project-started` to `ActivityAction` and Firestore's action allow-list. Require administrator role for this action. Implement:

```ts
export async function createInitialProject(
  db: Firestore,
  name: string,
  actor: string,
): Promise<ProjectState>;
```

The transaction must fail if `teamState/project` already exists, create the validated project record, and write one `project-started` activity event. Generate `generationId` with `crypto.randomUUID()` and use one captured ISO timestamp for `startedAt` and `updatedAt`.

Do not deploy rules in this task.

- [ ] **Step 3: Add navigation and display**

Subscribe in `App.tsx` to `teamState/project` after role access succeeds. Add `project` to the `activeTab` union and a sidebar item labelled `Project & Help`, visible to all roles. Display the current project name above the Dashboard heading. If no project record exists, administrators see `Set up this tracker`; submitting the project name calls `createInitialProject`. Other members see `An administrator has not named this project yet.`

- [ ] **Step 4: Add compact help content**

The page must explain:

1. add/import chapters;
2. add stage files and open/reveal recorded documents;
3. resolve conflicts and mistaken records;
4. backup and restore;
5. Firebase roles and concurrent updates;
6. Feedback round 0;
7. the active storage mode;
8. the app never changes source documents itself.

Remove the sidebar `Load Initial Data` button and its direct owner-data bootstrap handler. When a newly named project has no chapters, show four explicit choices on Project & Help: `Start blank`, `Import CSV/JSON`, `Restore JSON backup`, and `Scan an existing folder`. The latter three navigate to Backups & intake and focus the corresponding action; they do not silently import anything.

- [ ] **Step 5: Include project state in backup metadata**

Bump newly exported backups to version 2 and change restore validation in the same task to accept both version 1 and version 2. Version 1 imports retain their current create-only behaviour. Version 2 adds one top-level `project` object and remains bounded. Add explicit tests for a valid version-1 backup, a valid version-2 backup, and rejection of version 3.

- [ ] **Step 6: Verify Task 6**

Run focused project, backup, and rules tests, then `rtk npm run lint`. Stop if version-1 backup compatibility fails.

---

### Task 7: Add a coordinated administrator reset for a new project

**Files:**

- Modify: `src/utils/projectWrites.ts`
- Modify: `src/components/ProjectHelpView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/domain/activityLog.ts`
- Modify: `firestore.rules`
- Create: `tests/projectWrites.test.ts`
- Modify: `tests/firestoreRules.test.mjs`
- Modify: `package.json` to append `tests/projectWrites.test.ts`

**Interface:**

```ts
export interface ReviewedResetInput {
  previousProject: ProjectState;
  nextProjectName: string;
  reviewedChapters: Array<{ id: string; dataRevision: number }>;
  backupExportedAt: string;
}

export async function startNewProjectWithRevisionCheck(
  db: Firestore,
  input: ReviewedResetInput,
  actor: string,
): Promise<ProjectState>;
```

- [ ] **Step 1: Write transaction tests**

Tests must prove:

- all reviewed chapters are deleted together;
- one stale revision causes zero deletions and no project change;
- roster/user documents are untouched;
- audit events are untouched;
- one `project-started` event is created;
- blank backup timestamp, blank project name, or non-admin UI path cannot start reset.

- [ ] **Step 2: Reuse the administrator-only activity action and rule**

Use the `project-started` action introduced by Task 6. Do not add a second reset-specific event type. Its summary must be `Started project: <new name>` and contain no filesystem path.

- [ ] **Step 3: Build the confirmation sequence**

The Danger Zone remains hidden from editors/viewers. Administrator sequence:

1. click `Start a new project`;
2. enter the next project name;
3. instruct every co-editor to stop editing;
4. save a JSON backup through the existing Save As flow;
5. if backup is cancelled or fails, reset remains disabled;
6. show chapter count and total stage-record count;
7. require the current project name and the literal word `RESET`;
8. call `startNewProjectWithRevisionCheck`;
9. on success show the empty Chapters page and new project name;
10. on revision conflict say `Nothing was deleted. A chapter changed after review; reload and start again.`

- [ ] **Step 4: Preserve old activity without mixing it into the new project**

Default Activity view to events at or after `ProjectState.startedAt`. Add `Show all retained activity` to reveal older immutable events.

- [ ] **Step 5: Run automated verification**

Run focused project write/rules tests, full test suite, lint, build, and diff check.

**External approval stop B1:** Present the exact Firestore rule diff and test output. Do not deploy until the owner explicitly approves deployment to the named Firebase project/database.

**External approval stop B2:** Even after rules are deployed, do not exercise reset against the live tracker. Use an emulator/synthetic database, or request a separate explicit live-reset approval after a verified backup.

---

# Stage C — Public local and shared-folder editions

Stage C is a separate public-release stream. Do not refactor the working Firebase edition until Stage B is accepted and backed up.

### Task 8: Introduce a backend contract without changing Firebase behaviour

**Files:**

- Create: `src/storage/TrackerBackend.ts`
- Create: `src/storage/FirebaseTrackerBackend.ts`
- Create: `src/storage/backendFactory.ts`
- Modify: `src/App.tsx`
- Create: `tests/backendContract.test.ts`
- Modify: `package.json` to append `tests/backendContract.test.ts`

**Contract:**

```ts
export type BackendKind = 'firebase' | 'local-file' | 'shared-folder';
export type Unsubscribe = () => void;

export interface TrackerSnapshot {
  project: ProjectState;
  chapters: Chapter[];
  activity: ActivityViewEvent[];
  revision: number;
}

export interface TrackerBackend {
  readonly kind: BackendKind;
  readonly supportsConcurrentEditing: boolean;
  subscribe(listener: (snapshot: TrackerSnapshot) => void, onError: (message: string) => void): Unsubscribe;
  saveChapter(chapter: Chapter, expectedRevision: number, actor: string): Promise<WriteResult>;
  appendStageRecord(chapterId: string, record: ChapterStageRecord, expectedRevision: number, actor: string): Promise<WriteResult>;
  voidStageRecord(chapterId: string, recordId: string, reason: string, expectedRevision: number, actor: string): Promise<WriteResult>;
  createChapters(chapters: Chapter[], actor: string, source: string): Promise<{ created: string[]; skipped: string[] }>;
  deleteChapters(chapters: Chapter[], actor: string): Promise<WriteResult>;
  startNewProject(input: ReviewedResetInput, actor: string): Promise<ProjectState>;
  close(): Promise<void>;
}
```

- [ ] **Step 1: Write a Firebase delegation contract test**

Mock existing functions and assert every `FirebaseTrackerBackend` method forwards arguments and preserves the existing result. `supportsConcurrentEditing` must equal `true`.

- [ ] **Step 2: Move orchestration, not domain logic**

Wrap the existing Firebase listeners/writes. Do not duplicate transaction code and do not change Firestore paths in this task.

- [ ] **Step 3: Change App to consume the contract**

Authentication and Manage Team remain Firebase-only. The default factory choice for the installed team edition remains `firebase`, so this task must have no visible behaviour change.

- [ ] **Step 4: Run full verification**

Run contract test, full suite, lint, and build. Stop if the Firebase edition’s screen sequence or write semantics change.

---

### Task 8B: Let public users configure their own Firebase project

**Files:**

- Create: `src/domain/firebaseProfile.ts`
- Create: `src/components/FirebaseSetupView.tsx`
- Create: `src/firebaseRuntime.ts`
- Modify: `src/firebase.ts`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Modify: `src/storage/backendFactory.ts`
- Modify: `src/App.tsx`
- Modify: `forge.config.js`
- Modify: `package.json`
- Create: `tests/firebaseProfile.test.ts`
- Create: `tests/publicPackageBoundary.test.mjs`

**Local-only profile:**

```ts
export interface UserFirebaseProfile {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  firestoreDatabaseId?: string;
}
```

Firebase web configuration is not a password, but it still belongs to the user's chosen project and must remain in local Electron app data. Do not put it in a portable project file or activity event.

- [ ] **Step 1: Add profile validation tests**

Accept bounded non-empty `apiKey`, `projectId`, and `appId`; require `authDomain` to be an HTTPS-safe hostname with no path; allow an optional bounded database ID. Reject extra keys, control characters, URLs with paths, and the owner's project ID in public-build fixtures.

- [ ] **Step 2: Replace eager static Firebase initialization**

`firebaseRuntime.ts` must expose:

```ts
export function createFirebaseRuntime(profile: UserFirebaseProfile): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};
```

Do not initialize Firebase until a profile is available. Preserve the current exported convenience functions by binding them to the selected runtime, or update consumers together so no module reads `auth`/`db` before runtime initialization.

- [ ] **Step 3: Store and retrieve the profile through Electron**

Add constrained IPC to load/save/clear `firebase-profile.json` under `app.getPath('userData')`. When a public profile is saved, update the main process's allowed Firebase OAuth `authDomain` so the existing popup policy remains restrictive.

- [ ] **Step 4: Separate team and public package variants**

Add explicit scripts:

```json
"build:team": "set VITE_APP_VARIANT=team&& vite build",
"build:public": "set VITE_APP_VARIANT=public&& vite build",
"make:team": "npm run build:team && set VITE_APP_VARIANT=team&& electron-forge make",
"make:public": "npm run build:public && set VITE_APP_VARIANT=public&& electron-forge make"
```

These scripts are intentionally Windows/cmd-compatible because this release target is Windows. Do not add `cross-env`. The team variant may use the existing bundled profile. The public variant must exclude `firebase-applet-config.json` from packaged resources and must start at the storage-mode/configuration chooser.

- [ ] **Step 5: Add the public Firebase setup flow**

The public setup page asks the user to paste the four Firebase web-app values, optionally specify a non-default Firestore database ID, save locally, and test connection. It must explain that the user is responsible for creating their Firebase project, enabling Authentication/Firestore, and deploying the supplied rules. It must not offer to connect to the owner's tracker.

- [ ] **Step 6: Prove the public boundary**

`tests/publicPackageBoundary.test.mjs` must inspect the public build/packaging configuration and fail if it includes:

```text
edotorial-review-tracker
ali0mozaffari@gmail.com
the owner-bound Firebase API key
firebase-applet-config.json
```

The automated test is configuration/static-source based so the normal suite does not depend on a pre-existing `dist` directory. Then run:

```powershell
rtk proxy node --import tsx --test tests/firebaseProfile.test.ts
rtk proxy node --test tests/publicPackageBoundary.test.mjs
rtk npm run lint
rtk npm run build:public
rtk proxy powershell -NoProfile -Command "Get-ChildItem -LiteralPath 'dist' -Recurse -File | Select-String -SimpleMatch 'edotorial-review-tracker','ali0mozaffari@gmail.com','AIzaSyBJGlFeb5iDZXg58VPYDPfHjq5tNGKsHwE'"
```

Expected: tests, lint, and build pass; the final command prints no matches. Do not package or deploy.

---

### Task 9: Add the portable local project-file backend

**Files:**

- Create: `src/storage/projectFileFormat.ts`
- Create: `src/storage/LocalFileTrackerBackend.ts`
- Create: `electron/project-file-policy.cjs`
- Create: `tests/projectFileFormat.test.ts`
- Create: `tests/projectFilePolicy.test.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Modify: `src/storage/backendFactory.ts`
- Create: `src/components/StorageModeChooser.tsx`
- Modify: `src/App.tsx`

**Portable file format:**

```ts
export interface PortableProjectFile {
  format: 'book-editorial-tracker-project';
  version: 1;
  projectRevision: number;
  savedAt: string;
  savedBy: string;
  project: ProjectState;
  chapters: Chapter[];
  activity: ActivityViewEvent[];
}
```

Limits: maximum 25 MiB, 50 chapters initially, 100 stage records per chapter, 5,000 activity records. Reject invalid/unknown versions before showing a project.

- [ ] **Step 1: Test validation and atomic-save policy**

Tests must cover invalid versions, unsafe references, absolute paths anywhere in synced data, record limits, stale project revision, and atomic temporary-file replacement.

- [ ] **Step 2: Add Electron Open/Save Project IPC**

IPC operations:

```ts
chooseProjectFile(): Promise<{ cancelled: boolean; contents?: string; fileToken?: string }>;
saveProjectFile(fileToken: string, expectedHash: string, contents: string): Promise<{ ok: boolean; hash?: string; message: string }>;
saveProjectFileAs(contents: string): Promise<{ cancelled: boolean; fileToken?: string; hash?: string }>;
```

`fileToken` is an opaque local identifier held in Electron `userData`; never expose the absolute path. Save by writing a temporary sibling, flushing/closing it, then renaming it over the canonical project file. Before replacement, hash the canonical file and refuse when it differs from `expectedHash`.

- [ ] **Step 3: Implement single-editor repository semantics**

`LocalFileTrackerBackend` keeps the validated snapshot in memory, applies the same revision/conflict/domain helpers as Firebase, increments `projectRevision` once per successful operation, appends one activity event, and persists the whole snapshot atomically. `supportsConcurrentEditing` equals `false`.

Local/shared modes do not show Firebase sign-in or Manage Team. During project creation they ask for a local editor label, treat that editor as the project administrator on that computer, and record the label in local activity. This is not an identity/security claim.

- [ ] **Step 4: Add first-run storage choice**

Offer:

- `Firebase team — live collaboration`;
- `Local project file — one editor at a time`;
- `Shared-folder project — one editor at a time` (disabled until Task 10).

The existing owner-bound build may default to Firebase. The public build must not embed or silently connect to the owner’s Firebase configuration.

- [ ] **Step 5: Verify local mode**

Use a synthetic project file under a temporary local test directory. Confirm create/open/edit/save/close/reopen, stale-hash refusal, backup restore, and no writes to any manuscript source folder.

---

### Task 10: Add advisory one-editor shared-folder mode

**Files:**

- Create: `src/storage/SharedFolderTrackerBackend.ts`
- Create: `electron/shared-project-lock.cjs`
- Create: `tests/sharedProjectLock.test.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/electron-api.d.ts`
- Modify: `src/components/StorageModeChooser.tsx`
- Modify: `src/components/ProjectHelpView.tsx`

**Lock file beside the canonical project file:**

```json
{
  "format": "book-editorial-tracker-lock",
  "version": 1,
  "instanceId": "random-local-instance-id",
  "editorLabel": "user-supplied label",
  "acquiredAt": "ISO timestamp",
  "heartbeatAt": "ISO timestamp"
}
```

- [ ] **Step 1: Test the advisory lock**

Tests must prove exclusive local creation, read-only fallback when a lock exists, heartbeat update, normal close removal, stale-lock inspection, and administrator-confirmed force unlock. Use only a synthetic temporary directory.

- [ ] **Step 2: Implement explicit open/edit/save/close behaviour**

- acquiring the lock enables editing;
- an existing lock opens the project read-only and shows its editor label/time;
- heartbeat every 60 seconds while open;
- close removes only this instance’s lock;
- force unlock requires typing `FORCE UNLOCK` and never runs automatically;
- before every save, compare the canonical file hash and project revision with the opened baseline;
- on mismatch, refuse overwrite and offer Save As conflict copy outside the canonical filename;
- do not implement automatic merge.

- [ ] **Step 3: State the limitation prominently**

Display:

```text
Shared-folder mode is for one editor at a time. Folder synchronization is not a live database. If two people edit independently, the later save is blocked rather than merged.
```

- [ ] **Step 4: Verify sequential shared-folder use**

Use two separate app processes or synthetic clients against a temporary shared-folder fixture. Verify second-client read-only behaviour, first-client close, second-client acquisition, stale-hash refusal, and recovery from a deliberately stale lock.

Do not test against the owner’s existing Google Drive working/source folder.

---

## Task 11: Evidence, packaging, and hostile review gates

**Files:**

- Create: `docs/verification/2026-08-15-corrections-test-log.md`
- Create: `docs/verification/2026-08-15-corrections-ledger.csv`
- Create: `docs/verification/2026-08-15-corrections-discrepancy-report.md`
- Update: public README/limitations document only when its exact existing path has been verified

- [ ] **Step 1: Run release checks from the final snapshot**

```powershell
rtk npm test
rtk npm run lint
rtk npm run build
rtk git diff --check
```

Record exact counts and results. Do not reuse a prior test count.

- [ ] **Step 2: Run the proportionate manual smoke matrix**

Current Firebase mode:

1. open and reveal a copied Word file;
2. unavailable-source message on another/local-empty mapping;
3. duplicate stage prevented;
4. conflict resolution through mark-mistaken;
5. Smith-style abstract shown as present;
6. no-op save disabled;
7. completed import cannot be reapplied;
8. Project & Help visible;
9. reset cancellation changes nothing.

Public modes:

1. local create/save/reopen;
2. local stale-hash refusal;
3. shared-folder one-editor lock;
4. second editor read-only;
5. changed canonical file blocks overwrite;
6. source manuscript bytes remain unchanged by tracker operations; opening in Word is tested only with a copied synthetic document because Word may create a temporary lock file.

- [ ] **Step 3: Stop for model switch before hostile review**

Report the final snapshot and ask the owner to switch to a different capable reviewing model/provider. Do not conduct the hostile review with the implementation model.

- [ ] **Step 4: Remediate review findings, then rerun current evidence**

Only fix findings that are confirmed against the current snapshot. Rerun the exact affected focused tests and then all four release checks.

- [ ] **Step 5: External approval before packaging/installing**

Present the final test log, ledger, discrepancy report, package version, and proposed installer name. Wait for explicit approval before `npm run make`, installer execution, or public distribution.

---

## Deterministic completion criteria

Stage A is complete only when:

- recorded files can be opened/revealed without syncing absolute paths;
- manual same-rank duplicates are rejected before write;
- CH01-style conflicts name the stage and records;
- Smith-style text is treated as present;
- no-op saves create no activity;
- applied imports cannot be immediately reapplied;
- full suite, lint, build, and diff check pass.

Stage B is complete only when:

- current project name and help are visible;
- reset is administrator-only and backup-first;
- roster and audit history survive reset;
- old activity is retained but excluded from the default current-project view;
- rules are tested but not deployed without explicit approval.

Stage C is complete only when:

- the public build does not expose the owner’s Firebase project;
- Firebase remains concurrent;
- local and shared-folder modes clearly state one editor at a time;
- portable files contain no absolute paths;
- stale canonical files are never overwritten;
- no automatic merge is claimed or attempted.

## Copy-paste continuation prompt

```text
Work in C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker.
Read docs/verification/2026-08-15-product-workflow-audit.md and execute
docs/superpowers/plans/2026-08-15-small-team-corrections-project-lifecycle-and-public-storage.md
from Gate 0, sequentially. Preserve the dirty worktree. Do not reset, clean,
pull, push, install, deploy, stage, commit, package, install an executable, or
modify any original Google Drive document/folder. Use apply_patch for edits and
prefix shell commands with rtk. Stop at every explicit external approval gate.
Do not invent alternate file paths or interfaces if the current source differs;
record the discrepancy and stop. Complete Stage A before Stage B, and Stage B
before Stage C. Before the final hostile review, stop and ask the owner to switch
the reviewing model/provider.
```
