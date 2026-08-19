# Codebase Scan and Release Readiness — 16 August 2026

## Scope

Read-only architecture and change review of commit `c4ec750` against baseline `898b520`, plus a local static graph scan. The scan did not call an external model, Firebase, or Google Drive.

## Evidence

- Snapshot commit: `c4ec750 feat: snapshot reliability and intake improvements`.
- Static graph: [graph.json](../../graphify-out/graph.json) and [Graph report](../../graphify-out/GRAPH_REPORT.md).
- Graph result: 624 nodes, 1,011 edges, 38 communities, and no import cycles.
- Current checks: lint passed; Vite build passed outside the sandbox. The test suite had 101 passes and 3 failures caused only by the currently running application owning TCP port 43119.

## Findings

### P1 — document recovery can be blocked by a stale project folder

`electron/main.cjs` returns the failed project-relative lookup before trying the local SHA-256 index. A file that was separately selected and indexed cannot be opened while an old project root remains selected. Resolve by attempting the hash index after the relative-path attempt fails.

### P2 — stage-record validation is not enforced in Firestore rules

The rules bound the `submissions` list but do not validate each record's schema. A direct Firebase client could persist malformed records. Add a bounded stage-record map validator before publishing a public Firebase-capable edition.

### P2 — stage-intake error handling is brittle

`StageIntakeDialog` assumes its save callback returns a result. Wrap an unexpected rejection and show its existing stable “Nothing was saved” state.

### P2 — Windows drive-relative path is not explicitly tested

Add a regression assertion for values such as `C:chapter.docx`, and reject drive-prefixed source references in the policy.

## Product lifecycle gap

The screenshots correctly show that there is no **Start new project** button. The existing **Backups & intake** tab is only an import/export workspace.

The plan's Stage B and C remain open:

1. **Task 6:** Project & Help tab, project name, administrator setup, and the four choices: blank project, CSV/JSON import, JSON restore, or project-folder scan.
2. **Task 7:** guarded archive/reset with a verified backup requirement.
3. **Tasks 8/8B/9/10:** storage-backend contract, bring-your-own Firebase configuration, portable local project file, and a lock-based shared-folder mode for sequential co-editing.

## Release decision

Do not publish the current installer as the open public release: it is an owner-bound Firebase edition. A compact public beta is feasible once the listed Stage B/C work is complete, released as a distinct installer without your Firebase configuration. It should offer local project-file storage by default, optional bring-your-own Firebase, and sequential shared-folder use with a lock rather than live concurrent editing.

## Proportionate verification for the public beta

Keep the verification small: one unit test each for path policy, local-file round trip, shared-folder lock contention, and Firebase configuration validation; one packaging smoke test for each storage choice. Re-run the full existing suite only once before the public installer is produced.
