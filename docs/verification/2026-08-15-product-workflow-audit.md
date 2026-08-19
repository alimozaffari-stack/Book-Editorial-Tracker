# Book Editorial Tracker product and workflow audit

**Date:** 2026-08-15  
**Status:** REPORT ONLY — no application code, Firebase data, installed application, or Google Drive file was changed.  
**Audience:** A small, trusted group of co-editors; this is not a commercial or high-scale product.

## Executive finding

The core stage-file workflow is now functioning: a selected Word document can be inspected and added as a stage record. The remaining problems are mainly about competing sources of truth, conflict explanation, project lifecycle, and misleading post-action states.

The most important findings are:

1. **CH01 has a real workflow conflict.** It contains two active `Initial manuscript` records at the same workflow rank. The app detects this, but its generic message does not identify the stage or help the editor resolve it.
2. **The Smith/CH03 warning is misleading.** The chapter has an active manuscript file and visible abstract text, but an older imported Yes/No field still says `No`. The warning is generated from that stale flag even though newer evidence says the abstract is present.
3. **There is no project lifecycle.** The current database is one shared tracker with no project identity, first-run setup, help page, or safe way to start a new book.
4. **A reset must not be a casual “wipe” button.** A small-team implementation can remain simple, but it needs a backup-first, administrator-only, clearly confirmed reset that removes tracker records only and never changes source documents.
5. **The future public build needs three explicit storage modes.** Firebase can support concurrent teams. Local files and a shared Google Drive-like folder can support portable project files, but shared-folder editing should be deliberately non-concurrent and protected by version/conflict checks.

## Evidence-backed problems and targeted solutions

### 1. CH01 duplicate active stage records

CH01 currently contains two active `Initial manuscript` records:

- 22 January 2026 — 7,936 words
- 14 April 2026 — 9,604 words

Both have the same workflow rank, so this is a genuine conflict rather than a cosmetic warning. The current text — “Two active stage records have the same workflow rank” — is technically correct but makes the editor infer which records are involved.

**Targeted solution**

Show a specific blocking issue:

> CH01 — Duplicate active stage: Initial manuscript. Two records are active (22 Jan 2026, 7,936 words; 14 Apr 2026, 9,604 words). Choose the canonical record.

In Stage history, mark both rows with a `Conflict` badge and offer a single `Resolve` action with three choices:

1. Keep the newer record and mark the older one as entered by mistake/superseded, with a required reason.
2. Reclassify one record as `Revision 01`, if that is what the document really represents.
3. Cancel without changing anything.

The same-rank check should also run before a manual add or folder import is committed. The editor should resolve the collision before the write rather than discover it later on the Dashboard.

### 2. Smith/CH03 shows content but is still warned as absent or unconfirmed

The chapter detail visibly contains abstract text, and the stage history contains an active initial-manuscript file. The warning comes from a separate legacy field, `initialAbstractSubmitted`, whose imported value remains `No`. This creates two incompatible truths:

- content/stage history says the material exists;
- a legacy Yes/No flag says it does not.

The Tasks view already uses derived stage history, while the Dashboard discrepancy logic still treats the legacy flag as authoritative. That is why the app can simultaneously behave as though the manuscript exists and warn that prerequisite material is missing.

**Targeted solution**

Use one derived definition of “abstract present”:

`active abstract stage record OR non-empty abstract text OR legacy status = Yes`

A legacy `No` should mean “not confirmed in the old import,” not “the abstract is absent.” For visible imported text, either remove the warning or downgrade it to a non-blocking cleanup notice:

> CH03 — Abstract text is present. The imported legacy status was “No”; the app will treat the abstract as present.

Offer an administrator/editor action called `Reconcile imported metadata`. It should preview every proposed change, update only obvious mismatches, and write one summary activity event. It must never silently change records merely because the app was opened.

### 3. Dashboard warnings bury the important conflict

The Dashboard labels all findings as “Sequence Discrepancies,” even though most are legacy field mismatches. Twelve chapters appear to need attention, so the genuine CH01 collision is visually buried among low-risk cleanup messages.

**Targeted solution**

Group findings by chapter and severity:

- **Blocking conflict:** duplicate active stage records, invalid sequence, unresolved concurrent change.
- **Metadata cleanup:** imported Yes/No flag disagrees with text or stage history.
- **Information:** optional field is incomplete.

Use one chapter card/row with the highest severity, a short explanation, and one relevant action. Rename the banner to `Workflow and data checks` rather than `Sequence Discrepancies Detected`.

### 4. Stage history and save behaviour

The Stage history table is difficult to scan: `Words` and `Status` visually run together, long file names dominate, and the correction link wraps. The current flow also allows `Save Changes` after a stage record has already been saved immediately. The Activity screen shows several repeated `Updated CH01` entries, which is consistent with no-op or unnecessary saves.

**Targeted solution**

- Use columns/cards for Date, Stage, File, Words, Status, and Action.
- Shorten the action to `Resolve` or `Mark mistaken`; show the full explanation inside the confirmation dialog.
- After adding a stage record, say `Stage record added — no further save is needed.`
- Disable `Save Changes` until a chapter form field is actually changed.
- Do not write an activity event or increment a revision for a no-op save.

### 5. Project-folder import completes but still looks re-runnable

The import result correctly reports six chapters changed, six records added, one already recorded, and zero failures. However, the primary button still says `Add 6 stage records`. That leaves a completed operation looking actionable and invites an accidental repeat.

**Targeted solution**

After a successful import:

- refresh the rows so newly applied items read `Already recorded`;
- clear their selection;
- disable or replace the Apply button;
- make `View chapters` the primary action;
- keep the scan report available for saving outside the source folder.

### 5A. Chapter and stage locations should be openable without syncing private paths

HTTPS chapter links are already clickable, but project-relative folder references are rendered as `Folder reference only`. Stage records imported from a project folder already contain the safer information needed to locate their source: `sourceRelativePath` plus a locally remembered project root. Manually selected Word files have a SHA-256 hash but deliberately do not sync their absolute path.

**Targeted solution**

- Make a stage filename clickable as `Open document` and place a neighbouring `Show in folder` control beside it.
- Resolve imported files from the locally remembered project root plus the stage record's project-relative path.
- Store manually selected absolute paths only in Electron's local application-data folder, indexed by the already recorded SHA-256. Never put an absolute path in Firebase, a backup, an activity event, or a shared project file.
- Before opening, confirm that the resolved item is a regular `.docx`, remains inside the selected project root when a relative reference is used, and still matches the recorded hash.
- If another editor's computer cannot resolve the file, show: `This document is not available on this computer. Choose the project folder in Backups & intake, or locate the document again.`
- Keep ambiguous legacy folder labels non-clickable. Do not guess a folder from text such as `00_1ST MANUSCRIPT SUBMISSION` when no confirmed relative file path exists.

Opening a Word document hands it to the operating system. The tracker itself remains read-only toward that file, although the user could subsequently edit and save it in Word.

### 6. Start new project, reset, and help are missing

The app currently has no project entity: `chapters`, `auditEvents`, `users`, and the roster all belong to one shared namespace. A simple delete-all button would leave old activity mixed with the new book and could encourage a dangerous reset without a backup.

**Targeted small-team solution**

Add a clearly visible sidebar destination called `Project & Help`. The Dashboard should also display the current project/book name. This page should contain:

- project name and start date;
- a short `How this tracker works` guide;
- backup and restore actions;
- an administrator-only `Start a new project` section;
- a visually separated `Danger zone` for resetting the shared tracker.

For the existing Firebase team tracker, the minimum useful project boundary is a small project-state record containing `projectId`, name, start date, and starter. Chapters and new activity events should be associated with that project ID. This avoids building a complex multi-project service while preventing old and new books from being mixed together.

The reset flow should:

1. Require an administrator.
2. Create and successfully save a fresh JSON backup first.
3. State the exact number of chapters and stage records to be removed.
4. Require the administrator to type the project name and `RESET`.
5. Remove tracker chapter records only.
6. Retain the team roster and immutable activity history.
7. Create one `project-reset`/`project-started` activity record.
8. Never rename, move, modify, or delete a source document or folder.

### 7. Help content should be short and operational

A bundled local help page or modal is sufficient. It should explain:

1. Add or import chapters.
2. Add stage files: the app reads document metadata and word count but does not modify the selected document.
3. Resolve conflicts and mark mistaken records.
4. Back up and restore a tracker.
5. How Firebase roles and live updates work.
6. What `Feedback round 0` means.
7. Which storage mode is active and what collaboration behaviour it supports.

## Public release: storage modes

The public build should not contain or grant access to the existing editorial team’s Firebase project. Each user/team should configure its own storage. A compact first-run choice can support three modes:

| Mode | Intended use | Concurrency | Practical rule |
|---|---|---:|---|
| Firebase team | A small team wanting live shared updates | Yes | Each team supplies/configures its own Firebase project and rules. |
| Local project file | One editor or one computer at a time | No | Save a bounded project JSON/database file locally with explicit backups. |
| Shared-folder project file | A shared Google Drive, OneDrive, Dropbox, or network-synced folder | Deliberately no | One editor at a time; open the latest file, edit, then save a new canonical version. |

For shared-folder mode, the source manuscripts remain separate and read-only. The canonical tracker file can live in the shared folder, but the app should not assume that folder synchronization is a database. A modest safe protocol is:

- acquire a small lock/lease file when a project is opened for editing;
- display who/which computer holds the lease and when it was acquired;
- store a project revision and last-saved hash;
- before saving, re-read the current shared file and refuse to overwrite if its revision/hash changed;
- use atomic save-to-temporary-file then rename for the tracker file;
- keep several timestamped backup versions;
- allow read-only opening when another editor holds the lease;
- provide an administrator-only `Force unlock` with a warning for stale locks.

This is appropriate for a trusted small group without promising safe simultaneous editing. Firebase remains the correct option for concurrent management.

## Proportionate implementation sequence

### Phase 1 — correctness and clarity (highest priority, about 1–2 development days)

- Specific CH01 conflict message and resolution action.
- Prevent same-rank active duplicates before manual/import writes.
- Make abstract presence derived from real content/stage history.
- Separate blocking conflicts from metadata cleanup.
- Disable no-op chapter saves.
- Refresh the completed import state.

Proportionate verification:

- four focused domain tests for duplicate ranking and abstract presence;
- two focused write/UI tests for duplicate prevention and no-op save behaviour;
- one import completion-state test;
- three manual checks: resolve CH01, inspect Smith/CH03, and confirm an import cannot be immediately re-applied.

### Phase 2 — project lifecycle and help (about 1–2 development days)

- Add `Project & Help` and current project name.
- Add first-run choices: blank tracker, import chapter list, restore backup, or scan existing folder.
- Add project ID/state and the backup-first administrator reset.

Proportionate verification:

- three focused tests covering administrator-only reset, retained team/history, and project separation;
- one rules check for the new project/reset writes;
- four manual checks: cancel reset, successful reset using synthetic data, restore backup, and confirm the selected source folder is byte-for-byte untouched.

### Phase 3 — public storage choices (separate release stream)

- Extract a small storage interface from the current Firebase operations.
- Implement local project-file storage first.
- Add shared-folder mode using the non-concurrent lock/revision protocol.
- Keep Firebase as the concurrent team mode.

Do not attempt live merge logic for Google Drive-like folders in the first public release. That would add disproportionate complexity for this application.

## Release-level verification

During development, run only the focused tests above. Before packaging an updated installer, run the existing full test suite, TypeScript check, production build, and one installer smoke check. A new end-to-end testing framework or commercial-grade matrix is not warranted for this trusted small-team app.

Any live reset test is an explicit external/destructive action. It must use synthetic data or require a fresh owner approval after a verified backup; it must never be tried against the present team tracker as an ordinary smoke test.

## Evidence limits

This audit used the supplied screenshots and read-only inspection of the current source. It did not exercise keyboard navigation, screen-reader announcements, slow/offline Drive synchronization, simultaneous shared-folder access, or a live reset. The visible table/header crowding and Dashboard clipping are supported by screenshots; deeper accessibility and synchronization behaviour should be checked only when those flows are implemented.
