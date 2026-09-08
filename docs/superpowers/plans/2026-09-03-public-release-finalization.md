# Public Release Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a reviewed, clean, public GitHub repository and a verified portable Windows release archive without exposing project data, local residue, or unverified fixes.

**Architecture:** The release is prepared in four separate layers: source and documentation, verification evidence, a clean portable artifact, and Git/GitHub publication. Generated output and user data remain outside Git. Every transition to an external action is gated by explicit owner approval.

**Tech Stack:** Electron 40, React 19, TypeScript, Vite 6, Electron Packager, Node.js, GitHub, Windows 11.

**Spec:** Owner request in this Codex task: finalize the current Book Editorial Tracker working copy as a clean public release, but do not publish, commit, push, tag, or delete until separately approved.

## Global Constraints

- Work only in `D:\Apps\Book-Editorial-Tracker`.
- Preserve the existing dirty working tree; do not reset, clean, stash, or overwrite unrelated changes.
- Do not commit or distribute `.betp.json`, `.lock`, `user-data`, logs, token files, `.codex-remote-attachments`, `.tmp_*`, `out`, or local screenshots containing real project data.
- Do not publish, push, tag, or create a GitHub release without explicit owner approval at the named approval gate.
- Use `rtk` before every shell command.
- Treat `0.2.1` as the recommended patch-release version, but change the version only after the owner confirms it.
- Do not claim that a release is ready until source, package contents, and manual smoke-test evidence are all recorded.

---

## Model Assignment Matrix

| Work type | Recommended model | Why |
| --- | --- | --- |
| Exact inventories, hashes, Git status, artifact checks, release-folder copying, zipping, staging approved files, and running fixed commands | `gpt-5.6-luna` | Fast and safe for bounded, mechanical work with an explicit allowlist and stop conditions. |
| Documentation consistency, focused test/build execution, package-content inspection, and release-note drafting from confirmed facts | `gpt-5.6-terra` | Good balance of speed and repository reasoning. |
| Interpreting a failed smoke test, deciding whether source changes are release-safe, resolving source/build/package drift, reviewing lock and data-safety behavior, and final acceptance | `gpt-5.6-sol` | Needed where evidence is ambiguous or a wrong conclusion could publish a broken or unsafe public release. |

Small models must not invent paths, delete residue, broaden the Git allowlist, alter versions, or decide that an ambiguous result is a pass. They stop and hand the exact evidence to `gpt-5.6-sol`.

### Task 1: Freeze the release candidate and choose the version

**Files:**
- Read: `package.json`, `CHANGELOG.md`, `README.md`, `docs/RELEASING.md`, `docs/USER_GUIDE.md`
- Read: current Git status and configured remote
- Modify after approval: `package.json`, `package-lock.json`, `CHANGELOG.md`, release documentation only if version text needs correction

**Model:** `gpt-5.6-terra`; escalate to `gpt-5.6-sol` if the change inventory cannot be separated into release work and unrelated work.

- [ ] Record `git status --short`, branch name, `HEAD`, and `origin/main` hash.
- [ ] Record the current package version and identify every changed tracked file and untracked file.
- [ ] Classify each item as one of: release source, release test, release documentation, generated output, local residue, or unrelated work.
- [ ] Present a proposed Git allowlist. Do not stage anything.
- [ ] Ask the owner to confirm the exact release version. Recommend `0.2.1` because the current work repairs behavior and packaging after `0.2.0`.
- [ ] Stop for approval before changing version fields.

**Acceptance evidence:** a dated inventory, exact remote/HEAD comparison, confirmed release version, and an owner-approved Git allowlist.

### Task 2: Complete the public documentation set

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/RELEASING.md`
- Modify: `docs/USER_GUIDE.md`
- Optional approved assets only: `docs/images/`

**Model:** `gpt-5.6-terra`; use `gpt-5.6-sol` to review any statement about data safety, shared locks, or compatibility.

- [ ] Update the README release section to reference the final portable artifact name rather than a dated candidate folder.
- [ ] Add the confirmed release version, date, and concise user-facing changes to `CHANGELOG.md`.
- [ ] Update `docs/RELEASING.md` with the exact final artifact and archive naming convention.
- [ ] Review `docs/USER_GUIDE.md` against the running app's tabs and current public behavior.
- [ ] Keep the screenshot placeholders until the owner provides redacted screenshots and explicitly approves their inclusion.
- [ ] Reject any screenshot that contains real names, emails, folder paths, document names, project identifiers, or non-public manuscript data.

**Acceptance evidence:** documentation makes no stale artifact claim, contains only verified behavior, and has no private project information.

### Task 3: Run the focused verification ladder

**Files:**
- Read only: source, tests, package scripts, portable-build script, package output

**Model:** `gpt-5.6-terra` for fixed commands; `gpt-5.6-sol` for a failure, nondeterministic result, or a source/package discrepancy.

- [ ] Run the focused shared-project lock tests.
- [ ] Run the focused portable-packaging configuration tests.
- [ ] Run the focused renderer startup/error-boundary tests.
- [ ] Run the documented type check and full test suite only after focused checks pass.
- [ ] Run the public Vite build.
- [ ] Record each command, exit status, passed/failed/skipped counts, and every unrelated failure separately.
- [ ] Stop and escalate if the portable runtime or shared-lock behavior is not exercised by available tests.

**Acceptance evidence:** fresh command output demonstrates successful focused checks, full suite, type check, and public renderer build, or records an explicit unresolved blocker.

### Task 4: Perform the manual Windows smoke test

**Files:**
- Read only: final candidate portable folder and its logs, if any
- Do not use owner project data in screenshots or release archives

**Model:** `gpt-5.6-sol` leads the evaluation; `gpt-5.6-luna` may execute a fixed checklist and collect non-sensitive evidence.

- [ ] Start from a new clean portable output folder that has never been launched before packaging.
- [ ] Create a disposable local project and confirm create, save, close, reopen, and save.
- [ ] Open a disposable shared-folder project using one application instance and confirm editing is enabled.
- [ ] Start a second copy against that disposable project and confirm it is read-only.
- [ ] Close or deliberately abandon the first copy, then use the confirmed `FORCE UNLOCK` recovery in the second copy.
- [ ] Confirm the message `Shared project unlocked and opened for editing.` appears and import controls are visible.
- [ ] Confirm the chapter CSV/JSON import preview does not overwrite an existing chapter ID.
- [ ] Confirm a folder scan is metadata-first, selected Word-file inspection is explicit, and the source folder remains unchanged.
- [ ] Confirm the footer credit reads `Built by Ali Mozaffari, 2026`.

**Acceptance evidence:** a checklist with pass/fail evidence for every item. A failure or ambiguous result returns to `gpt-5.6-sol`; it is not released as a known pass.

### Task 5: Build and inspect the final portable package

**Files:**
- Read: `scripts/make-portable-exe.mjs`, `package.json`, `forge.config.js`
- Create: a new uniquely named folder under `out\portable-exe\`
- Create: one approved release archive outside Git tracking

**Model:** `gpt-5.6-luna` for the fixed build and inventory; `gpt-5.6-terra` verifies package content; `gpt-5.6-sol` resolves a build/runtime discrepancy.

- [ ] Verify the final release folder name does not already exist.
- [ ] Set `VITE_APP_VARIANT=public` and invoke `scripts/make-portable-exe.mjs`.
- [ ] Confirm the script rebuilds Vite before Electron Packager runs.
- [ ] Verify `Book Editorial Tracker.exe`, `resources\app.asar`, required Electron DLLs, and `locales\` exist.
- [ ] Inspect `app.asar` to confirm the old shared-lock-reopen message is absent and the repaired lock-recovery message is present.
- [ ] Confirm the final output contains no `user-data`, `.betp.json`, `.lock`, `.log`, token file, temporary folder, or remote attachment.
- [ ] Create one ZIP archive from the clean folder only after the content scan passes.
- [ ] Generate SHA-256 hashes for the ZIP and EXE, and record byte sizes.

**Acceptance evidence:** exact artifact path, archive path, hashes, file sizes, clean-content inventory, and packaged-renderer string check.

### Task 6: Independent release preflight

**Files:**
- Read only: staged candidate files, documentation, package archive, hashes, and smoke-test evidence

**Model:** `gpt-5.6-sol`.

- [ ] Re-check the Git allowlist against the actual staged list.
- [ ] Confirm generated output, user data, project files, locks, logs, tokens, temporary files, and private screenshots are absent from staging.
- [ ] Confirm the release archive matches the verified clean package and its published hash.
- [ ] Confirm the README, changelog, release checklist, and user guide agree on the same version and artifact type.
- [ ] Produce one verdict: `READY_FOR_COMMIT`, `BLOCKED`, or `INCONCLUSIVE`.
- [ ] Stop and request owner approval before staging or committing.

**Acceptance evidence:** an independent signed-off preflight report with an exact Git allowlist and release-attachment allowlist.

### Task 7: Stage and present the commit for approval

**Files:**
- Stage only: owner-approved source, tests, documentation, and intentionally approved public assets

**Model:** `gpt-5.6-luna` executes the fixed allowlist; `gpt-5.6-terra` reviews the staged diff; `gpt-5.6-sol` decides any disputed inclusion.

- [ ] Stage each approved file by exact path. Never use `git add .`.
- [ ] Show the complete staged-file list.
- [ ] Show the staged diff summary and confirm no generated package, temporary item, private data, or secret is staged.
- [ ] Propose a commit message, for example: `release: prepare v0.2.1 public portable beta`.
- [ ] Stop for final owner approval before creating the commit.

**Acceptance evidence:** a clean staged allowlist and explicit owner approval of the exact commit message.

### Task 8: Commit, then separately publish only with fresh approval

**Files:**
- Commit: approved staged files only
- External actions after separate approval: GitHub push, annotated tag, GitHub release, ZIP/hash attachment upload

**Model:** `gpt-5.6-luna` can execute the approved commands; `gpt-5.6-terra` confirms command output; `gpt-5.6-sol` decides whether a failed publish attempt changes release readiness.

- [ ] Create the approved commit.
- [ ] Report the commit hash, changed-file list, and unchanged dirty files that remain outside the release.
- [ ] Stop. Do not push, tag, or publish merely because the commit exists.
- [ ] After separate owner approval, push `main` without force.
- [ ] After separate owner approval, create an annotated `v0.2.1` tag and push it.
- [ ] After separate owner approval, create a GitHub release labeled `Windows public beta` and attach only the verified ZIP and SHA-256 checksum file.

**Acceptance evidence:** GitHub displays the expected tag, release notes, and only the approved clean attachments.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-03-public-release-finalization.md`.

1. **Subagent-driven execution (recommended):** use a fresh worker for each task, with a `gpt-5.6-sol` review at Tasks 4 and 6.
2. **Inline execution:** execute one task at a time in this task, stopping at each owner-approval gate.
