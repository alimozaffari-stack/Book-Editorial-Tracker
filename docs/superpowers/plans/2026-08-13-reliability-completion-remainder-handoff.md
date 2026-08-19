# Remainder Plan — Reliability Completion Handoff

This is the executable remainder of `2026-08-13-reliability-completion-plan-v2-small-team.md`, updated after the 13 August remediation pass. Read `docs/verification/2026-08-13-provider-handoff.md` first.

## Gate 0 — reconcile the final hostile reviews

1. Obtain consolidated results from both the specification and standards/security reviewers.
2. Before any rules deployment, obtain an owner decision on the three direct-client limitations recorded in `docs/verification/2026-08-13-provider-handoff.md`: accept the bounded direct-client model explicitly, or authorize a trusted server mutation layer. Do not represent Firestore Rules alone as enforcing cross-document audit atomicity, full nested-record validation, or last-admin preservation.
3. For each material finding, inspect the current source before editing, make the smallest safe repair, add a regression test where practical, then rerun:

   ```powershell
   npm.cmd test
   .\node_modules\.bin\tsc.cmd --noEmit
   git diff --check
   npm.cmd run build
   npm.cmd run make
   ```

4. Do not erase existing dirty worktree changes while resolving findings.

Prioritize the current specification P2s: roster-aware current role, project-preview recalculation after collaborator/skipped import outcomes, persistent single/batch deletion feedback, feedback-round-0 project UI, and chapter-dialog semantics/focus recovery.

Completion: both reviews report no unresolved implementation blocker, the owner has accepted or authorized remediation of the direct-client security model, and the current evidence is green.

## Gate 1 — refresh local verification evidence

1. Update the current verification ledger, discrepancy report, and test log under `docs/verification/` with the exact test count, command output/result, build/make result, `git diff --check`, artifact locations, and SHA-256 hashes.
2. Explicitly mark any manual or live-system validation as `NOT RUN`, never as implied PASS.
3. Check that the evidence contains no absolute Google Drive folder path, document content, or source-tree report output.

Completion: evidence matches the final source/artifact snapshot, not the superseded 12 August 67-test snapshot.

## Gate 2 — rules deployment approval (STOP and ask)

Before touching Firebase, determine and show the exact target project/database from repository configuration and the available Firebase CLI command. Then stop and ask the owner to approve that exact rules deployment.

After explicit approval only:

1. Deploy Firestore rules.
2. Record the deployed target, timestamp, command, and result in verification evidence.
3. Do not deploy hosting, functions, or unrelated Firebase resources.

## Gate 3 — packaged application manual validation (STOP and ask)

Ask for approval before launching/installing the rebuilt package. The owner previously requested uninstallation; therefore do not install silently. Prefer an explicitly approved, temporary local launch of the packaged executable if that satisfies the validation protocol.

Manually prove in the packaged app:

- authentication persistence/sign-out/error recovery;
- existing-admin roster bootstrap and role restrictions for Viewer/Editor/Admin;
- fresh empty workspace guidance;
- chapter create/edit/stage append, void reason, stale conflict, batch update/delete error preservation;
- CSV/JSON preview and reject paths;
- activity filters, visible chapter IDs, export Save As and retry states;
- inaccessible/invalid project path handling;
- no file/report is created inside a selected Google Drive project root, including an alias/junction destination.

Record result, operator, timestamp, and screenshots/notes outside the selected project folder.

## Gate 4 — real project-folder scan (STOP twice)

1. Ask the owner to select a specific Google Drive working folder and approve **metadata-only scanning**. The app may read folder/file names and metadata; it must not change the folder or its contents.
2. Run scan and inspect the generated preview. Export any scan report only through a Save As destination confirmed outside the selected root.
3. Stop and ask separately before any DOCX content inspection.
4. After approval, inspect only the review-selected files. Confirm source-relative paths and no absolute path/body content is synchronised.

## Gate 5 — production data writes (STOP and ask)

Do not apply a chapter import, stage-history project import, backup import, team change, or other production mutation without a fresh owner approval after review.

For each approved production import:

1. Make the approved project backup through Save As outside the selected source root.
2. Reconfirm preview counts, unmatched/ambiguous/invalid rows, selected records, expected revisions, and actor.
3. Apply once.
4. Confirm resulting Activity summary, affected chapters, revisions, and activity filter visibility.
5. Stop immediately on a conflict; refresh/review rather than retrying stale data.

## Gate 6 — final evidence and repository disposition (STOP and ask)

1. Refresh verification evidence after manual/live gates.
2. Perform a final independent hostile review and resolve only verified material findings.
3. Run the Gate 0 command set once more.
4. Present the complete dirty-worktree diff and evidence for owner approval.
5. Stop for approval before staging, committing, pushing, tagging, publishing, distributing, or installing anything.

## Non-negotiable continuation rules

- Never reset, clean, pull, push, install, deploy, or delete/move/rename original Google Drive files without specific approval.
- Do not reintroduce automatic report writes into a scanned folder.
- Use one transactional summary Activity event for each batch/import operation.
- Keep stage history as the derived source of truth; never revive local status formulas.
- Treat unsupported backup versions, unsafe references, invalid paths, invalid IDs, oversized inputs, ambiguous rows, stale revisions, and missing bootstrap prerequisites as fail-closed outcomes.
