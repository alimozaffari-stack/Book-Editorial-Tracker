# Book Editorial Tracker Public Beta — Staged Execution Plan

> **For any executor:** Work task-by-task. Do not start a later task until the preceding task's focused verification passes. Do not deploy, publish, push, reset live data, package, install, or change an original Google Drive folder without the owner's explicit approval.

**Baseline:** `c4ec750 feat: snapshot reliability and intake improvements` in `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker`.

**Goal:** Produce a distinct Windows public-beta edition which offers a clearly visible project setup flow, portable local storage, sequential shared-folder storage, and optional user-configured Firebase collaboration, without exposing the owner's Firebase project or changing source documents.

**Non-goals:** commercial multi-tenancy, automatic file merging, access to the owner's tracker, automatic Google Drive writes, background syncing, or a live reset of the owner's project.

## Global constraints

- Preserve all existing dirty and untracked files. Never use `git reset`, `git clean`, `git checkout --`, `git pull`, or `git push`.
- Do not rename, move, modify, or delete original Google Drive documents or folders. A selected project folder is read-only to the application.
- Never store an absolute path in Firebase, activity, backups, CSV, or portable project files. Electron may keep opaque file tokens and local paths only in its `userData` directory.
- Firebase is the only concurrent-editing backend. Local-file and shared-folder modes must consistently say **One editor at a time**.
- Do not add packages. Use React, Electron, Firebase, Node, and the existing test runner only.
- Use `apply_patch` for source edits. Prefix shell commands with `rtk`.
- Before every task: `rtk git status --short`. Do not delete pre-existing untracked artifacts.
- Run only the focused tests while iterating. Run full verification once at the final release gate.
- Do not commit unless the owner asks. Do not publish publicly until the final publication gate is approved.

## Intended product variants

| Variant | Default storage | Who configures Firebase | Concurrent editing |
|---|---|---|---|
| Team | Existing Firebase project | Existing administrator | Yes |
| Public beta | Local project file | Nobody by default | No |
| Public beta optional | User's own Firebase project | Public user | Yes |
| Public beta optional | Shared folder | Local editor labels | No; advisory lock |

---

## Stage 0 — Re-establish the safe baseline

**Purpose:** confirm the implementation starts from the secured snapshot and distinguish app failures from the user's already-running installed app.

**Files:** read only: `package.json`, `src/App.tsx`, `src/types.ts`, `electron/main.cjs`, `electron/preload.cjs`, `firestore.rules`, `docs/superpowers/plans/2026-08-15-small-team-corrections-project-lifecycle-and-public-storage.md`.

- [ ] Run:

```powershell
rtk git status --short
rtk git log -1 --oneline
rtk npm run lint
```

- [ ] Record the actual baseline in `docs/verification/2026-08-16-public-beta-baseline.md`. State explicitly whether the desktop application is running.
- [ ] Do not run the full test suite if port `43119` is occupied by the installed app. Record that as an environment conflict, not a code failure.
- [ ] **Gate:** stop if `HEAD` is not `c4ec750` or lint fails for a source reason.

## Stage 1 — Repair the small pre-existing source-opening seam

**Purpose:** keep document opening reliable before reusing the project-folder machinery in local/shared storage.

**Files:**

- Modify: `electron/main.cjs`
- Modify: `electron/stage-source-policy.cjs`
- Modify: `tests/stageSourcePolicy.test.cjs`
- Modify if needed: `tests/preloadApi.test.cjs`

- [ ] Add a failing test: a `sourceRelativePath` such as `C:chapter.docx` is rejected as drive-qualified, just as `C:\\chapter.docx` is rejected.
- [ ] Run only the policy test and confirm the assertion fails for the missing rejection.
- [ ] Extend the policy's absolute/drive-prefix check to reject a leading drive letter and colon (`^[A-Za-z]:`). Do not weaken relative-path validation.
- [ ] Add a failing test for this recovery rule: when relative resolution fails but a valid matching SHA-256 index entry exists, the source resolver returns the indexed file.
- [ ] Change `open-stage-source` in `electron/main.cjs` so it tries the hash index after a relative-path failure; return the relative-path error only when no valid indexed file can be resolved.
- [ ] Run:

```powershell
rtk proxy node --test tests/stageSourcePolicy.test.cjs
rtk proxy node --test tests/preloadApi.test.cjs
rtk git diff --check -- electron/main.cjs electron/stage-source-policy.cjs tests/stageSourcePolicy.test.cjs tests/preloadApi.test.cjs
```

- [ ] **Acceptance:** both sources open only through safe relative paths or a locally indexed hash; the renderer never receives an absolute path.

## Stage 2 — Project identity and visible setup/help page

**Purpose:** add the missing `Project & Help` tab and four explicit project-start choices without deleting any data.

**Files:**

- Create: `src/domain/projectState.ts`
- Create: `src/utils/projectWrites.ts`
- Create: `src/components/ProjectHelpView.tsx`
- Create: `tests/projectState.test.ts`
- Modify: `src/types.ts`, `src/domain/activityLog.ts`, `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/ActivityView.tsx`, `src/utils/backupExport.ts`, `src/domain/backupImport.ts`, `firestore.rules`, `tests/backupExport.test.ts`, `tests/backupImport.test.ts`, `tests/firestoreRules.test.mjs`, `package.json`

### Data contract

```ts
export interface ProjectState {
  name: string;
  generationId: string;
  startedAt: string;
  startedBy: string;
  updatedAt: string;
}
```

`name` is trimmed 1–120 characters. `generationId` is 1–100 safe characters. Timestamps are ISO strings. The record lives only at `teamState/project`.

- [ ] Write failing validation tests for a valid project, blank/overlong names, invalid timestamps, and the activity cutoff rule `event.clientAt >= project.startedAt`.
- [ ] Implement pure validation in `projectState.ts`; do not import Firebase there.
- [ ] Add `project-started` to the activity action union and its safe action allow-list.
- [ ] Write a failing transaction test for `createInitialProject(db, name, actor)`: it creates `teamState/project` only if absent and writes one matching activity event using one timestamp.
- [ ] Implement `createInitialProject`; use `crypto.randomUUID()` for `generationId`; fail when a project already exists.
- [ ] Add a member-read/admin-write-only `teamState/project` Firestore rule. Do not deploy it.
- [ ] Subscribe to `teamState/project` after role resolution in `App.tsx`; add a `project` tab and sidebar item labelled `Project & Help` for all roles.
- [ ] When no project exists, show administrators `Set up this tracker` with a project-name form; show other users `An administrator has not named this project yet.`
- [ ] On an empty project show exactly four buttons: `Start blank`, `Import CSV/JSON`, `Restore JSON backup`, and `Scan an existing folder`. The last three navigate to Backups & intake and focus the relevant existing control; none imports automatically.
- [ ] Add compact help content covering stage records, document opening, voiding conflicts, backups, Firebase roles, feedback round 0, storage mode, and the no-source-write rule.
- [ ] Bump exported backup metadata to v2 with optional `project`; accept v1 and v2 on import; reject v3 before preview.
- [ ] Run:

```powershell
rtk proxy node --import tsx --test tests/projectState.test.ts tests/backupExport.test.ts tests/backupImport.test.ts
rtk proxy node --test tests/firestoreRules.test.mjs
rtk npm run lint
```

- [ ] **Gate:** present the exact Firestore rule diff. Do not deploy it until separately approved.

## Stage 3 — Backup-first new-project reset

**Purpose:** let an administrator clear chapter data for a new project without destroying roster or historical activity.

**Files:**

- Modify: `src/utils/projectWrites.ts`, `src/components/ProjectHelpView.tsx`, `src/App.tsx`, `src/components/ActivityView.tsx`, `firestore.rules`, `tests/firestoreRules.test.mjs`, `package.json`
- Create: `tests/projectWrites.test.ts`

### Write interface

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

- [ ] Write tests that prove: all reviewed chapters delete together; one stale revision means zero deletions; roster/users/audit remain; exactly one `project-started` event is written; blank backup timestamp/name is rejected.
- [ ] Implement the transaction with a captured timestamp, revision checks before deletes, and summary `Started project: <new name>`.
- [ ] Add an administrator-only Danger Zone. Require: a successful JSON backup during this session, current chapter and stage-record counts, the current project name, and literal `RESET`.
- [ ] On conflict show exactly: `Nothing was deleted. A chapter changed after review; reload and start again.`
- [ ] Default Activity to the current generation; provide `Show all retained activity`.
- [ ] Run focused tests, lint, and diff check.
- [ ] **Hard stop:** do not deploy rules or run reset against the live tracker. A synthetic test is enough. Live reset needs a verified backup plus a new explicit approval.

## Stage 4 — Storage contract and Firebase compatibility

**Purpose:** isolate storage choice without duplicating domain logic or changing the team edition's current Firebase behaviour.

**Files:**

- Create: `src/storage/TrackerBackend.ts`, `src/storage/FirebaseTrackerBackend.ts`, `src/storage/backendFactory.ts`, `tests/backendContract.test.ts`
- Modify: `src/App.tsx`, `package.json`

### Contract

```ts
export type BackendKind = 'firebase' | 'local-file' | 'shared-folder';
export type Unsubscribe = () => void;

export interface TrackerSnapshot {
  project: ProjectState | null;
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

- [ ] Write failing delegation tests: Firebase methods forward current write/listener behaviour unchanged; `supportsConcurrentEditing === true`.
- [ ] Implement a thin Firebase adapter that calls existing Firebase functions. Do not move validation/transaction logic into the adapter.
- [ ] Change `App.tsx` orchestration to use the factory while retaining Firebase auth and Manage Team only in Firebase mode.
- [ ] Confirm the Team variant defaults to Firebase and renders the same first screen.
- [ ] Run the contract test, lint, and existing Firebase-focused tests.

## Stage 5 — Public Firebase configuration and package boundary

**Purpose:** users can opt into their own Firebase project; public builds cannot connect to the owner’s tracker.

**Files:**

- Create: `src/domain/firebaseProfile.ts`, `src/firebaseRuntime.ts`, `src/components/FirebaseSetupView.tsx`, `tests/firebaseProfile.test.ts`, `tests/publicPackageBoundary.test.mjs`
- Modify: `src/firebase.ts`, `electron/main.cjs`, `electron/preload.cjs`, `src/electron-api.d.ts`, `src/storage/backendFactory.ts`, `src/App.tsx`, `forge.config.js`, `package.json`, `.env.example`

### Local-only profile

```ts
export interface UserFirebaseProfile {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  firestoreDatabaseId?: string;
}
```

- [ ] Test profile validation: required bounded strings; HTTPS hostname with no path for `authDomain`; optional bounded database ID; reject unknown keys, control characters, URL paths, and the owner project ID in public fixtures.
- [ ] Replace eager module-level Firebase initialization with `createFirebaseRuntime(profile)`. No module may read `auth`/`db` before a runtime is selected.
- [ ] Add Electron IPC to load/save/clear `firebase-profile.json` under `app.getPath('userData')`. Return only typed values; never write the profile to a portable file or activity event.
- [ ] Add `build:team`, `build:public`, `make:team`, and `make:public` scripts using Windows `set VITE_APP_VARIANT=...&&` syntax. Do not add `cross-env`.
- [ ] The public build starts at storage selection. Its packaging config excludes `firebase-applet-config.json`.
- [ ] Add setup copy stating users must create their own Firebase project, enable Authentication/Firestore, and deploy supplied rules themselves.
- [ ] Write a static public-boundary test that fails if the public configuration/package includes the owner Firebase project ID, owner email, owner API key, or `firebase-applet-config.json`.
- [ ] Run focused profile/boundary tests, lint, `rtk npm run build:public`, then search built `dist` for prohibited strings. Expected: no matches.

## Stage 6 — Portable local project-file backend

**Purpose:** the public beta works fully offline through a single explicit project file.

**Files:**

- Create: `src/storage/projectFileFormat.ts`, `src/storage/LocalFileTrackerBackend.ts`, `electron/project-file-policy.cjs`, `src/components/StorageModeChooser.tsx`, `tests/projectFileFormat.test.ts`, `tests/projectFilePolicy.test.cjs`
- Modify: `electron/main.cjs`, `electron/preload.cjs`, `src/electron-api.d.ts`, `src/storage/backendFactory.ts`, `src/App.tsx`, `package.json`

### File format and IPC

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

Limits: 25 MiB, 50 chapters, 100 stage records per chapter, 5,000 activity records. Reject absolute paths/unsafe references anywhere before displaying content.

```ts
chooseProjectFile(): Promise<{ cancelled: boolean; contents?: string; fileToken?: string }>;
saveProjectFile(fileToken: string, expectedHash: string, contents: string): Promise<{ ok: boolean; hash?: string; message: string }>;
saveProjectFileAs(contents: string): Promise<{ cancelled: boolean; fileToken?: string; hash?: string }>;
```

- [ ] Write failing format tests: valid round-trip; invalid/unknown version; unsafe path; each limit; stale revision.
- [ ] Write failing policy tests: opaque token only; atomic sibling temporary write; canonical-file hash mismatch refuses overwrite.
- [ ] Implement format validation as pure TypeScript. Implement Electron save by writing/flushing a sibling temporary file, hashing the canonical file before replacement, then renaming only when its hash equals `expectedHash`.
- [ ] Implement `LocalFileTrackerBackend`: in-memory snapshot, same domain helpers as Firebase, one project revision increment/activity entry per successful operation, atomic persistence, `supportsConcurrentEditing === false`.
- [ ] Add storage selection: `Firebase team — live collaboration`, `Local project file — one editor at a time`, and disabled `Shared-folder project — one editor at a time` until Stage 7.
- [ ] In local mode, no Firebase sign-in or Manage Team. Ask for a local editor label and record it only in local activity.
- [ ] Test synthetic create/open/edit/save/reopen and stale-hash refusal in a temporary test directory. Verify no test touches Google Drive.

## Stage 7 — Advisory shared-folder backend

**Purpose:** support a shared synced folder without claiming live collaboration or silently merging conflicts.

**Files:**

- Create: `src/storage/SharedFolderTrackerBackend.ts`, `electron/shared-project-lock.cjs`, `tests/sharedProjectLock.test.cjs`
- Modify: `electron/main.cjs`, `electron/preload.cjs`, `src/electron-api.d.ts`, `src/components/StorageModeChooser.tsx`, `src/components/ProjectHelpView.tsx`, `package.json`

### Lock format

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

- [ ] Write failing lock tests for exclusive creation, existing-lock read-only fallback, heartbeat update, correct-owner close removal, stale-lock inspection, and explicit force unlock.
- [ ] Implement the lock beside the portable project file. Heartbeat every 60 seconds. Never auto-remove a stale lock.
- [ ] On an existing lock, open read-only and display editor/time. Force unlock requires typing `FORCE UNLOCK` and must be manual.
- [ ] Before each save, compare both project-file hash and opened project revision. On mismatch, refuse overwrite and offer Save As conflict copy; do not merge.
- [ ] Enable shared-folder choice only after the lock is working. Display exactly: `Shared-folder mode is for one editor at a time. Folder synchronization is not a live database. If two people edit independently, the later save is blocked rather than merged.`
- [ ] Verify two synthetic clients: first acquires/editable; second read-only; first closes; second acquires; stale hash blocks save; a deliberately stale lock requires manual recovery.

## Stage 8 — Final verification, packaging, and public-release gates

**Purpose:** create evidence before any installer or public repository release.

**Files:**

- Create: `docs/verification/2026-08-16-public-beta-test-log.md`, `docs/verification/2026-08-16-public-beta-ledger.csv`, `docs/verification/2026-08-16-public-beta-discrepancy-report.md`
- Modify: `README.md`, `CHANGELOG.md`, package/version metadata only after all checks pass.

- [ ] Close the installed desktop app before running the full suite so the local-server tests can bind their test port.
- [ ] Run:

```powershell
rtk npm test
rtk npm run lint
rtk npm run build:team
rtk npm run build:public
rtk git diff --check
```

- [ ] Record exact command outcomes, artifact paths, SHA-256 hashes, and known limitations. Do not write an invented green result.
- [ ] Manually smoke-test on synthetic local data only: local create/save/reopen; shared lock read-only fallback; public Firebase setup rejects owner config; Team Firebase startup remains unchanged.
- [ ] **External approval gate A:** present the public packaging configuration and public-boundary test output. Ask whether to build/package the public installer. Do not package before approval.
- [ ] **External approval gate B:** after the public installer is built, ask the owner to install it on this computer. Do not install automatically.
- [ ] **External approval gate C:** stop and ask the owner to choose/switch a reviewing model for final hostile review. Do not begin it before that choice.
- [ ] **External approval gate D:** after hostile review and any approved fixes, ask before publishing a Git repository/release. Confirm license, public repository location, release notes, and whether binary artifacts are uploaded.

## Definition of done

- Team build retains current Firebase behaviour and does not expose portable local paths.
- Public build cannot contain the owner Firebase project/configuration and defaults to an explicit storage chooser.
- Local project files round-trip safely and block stale overwrites.
- Shared-folder mode is explicitly sequential and lock-protected; it never auto-merges.
- Start new project is visible through Project & Help, and reset is backup-first/admin-only.
- No live Firebase reset, Firestore deployment, package installation, or public publication occurs without its specific approval gate.
