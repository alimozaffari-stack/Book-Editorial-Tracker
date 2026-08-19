# Book Editorial Tracker v0.1.4 verification and discrepancy report

Date: 2026-08-13  
Canonical plan: `docs/superpowers/plans/2026-08-13-reliability-completion-plan-v2-small-team.md`  
Fixed baseline: `898b5204bd3749bb0ce11fdeaf7a5420aa74d6b1`  
Branch: `codex/desktop-collaboration`  
Worktree policy: dirty user-owned state preserved; no reset, clean, pull, push, install, or deploy.

## Automated verdict

The local automated implementation gate passes:

| Check | Current result |
|---|---|
| Test discovery | 22 discovered test files; all 22 named by `npm test` |
| `npm test` | PASS, 81 tests, 0 failures |
| `npm run lint` | PASS, TypeScript `--noEmit` |
| Electron source syntax | PASS for `main.cjs` and `preload.cjs` |
| `npm run build` | PASS, 2,310 modules transformed on 2026-08-14 |
| `npm run make` | PASS, current Windows v0.1.4 Squirrel artifacts created on 2026-08-14 |
| `git diff --check` | PASS; Git emitted line-ending conversion warnings only |

The original manual-stage-history loss was reproduced earlier in this run and is now covered by the passing regression `integration: general save preserves server-current stage history`.

## Closed discrepancies

- General chapter saves preserve server-current embedded stage history; stage append and void use dedicated revision-safe transactions.
- Stale chapter deletion and project import are rejected before mutation.
- Exact DOCX duplicates receive a distinct outcome; voiding requires a reason and retains the record.
- DOCX inspection enforces the 25 MiB file bound and stops XML inflation above 10 MiB per approved entry.
- CSV/JSON chapter imports normalize the full chapter contract, reject malformed history and unsafe references, preview first, and create absent IDs only.
- Initial-project import supports one chapter with many history rows, explicit sequential inspection, reviewed corrections, duplicate detection, a 50-chapter transaction ceiling, and one summary Activity event.
- Administrator, Editor, and Viewer controls are centralized; unrostered access is guided; last-admin/self-lockout checks are repeated in the transaction.
- Activity keeps previously loaded evidence on listener failure, can request older records, and exports through Save As with Open folder.
- The old Drive JSON sync, source-folder report writer, reconciliation/audit helper, and duplicated submission model were removed. README and changelog now point to Backups & Intake.
- The selected project root is remembered only in Electron `userData`; the renderer receives a display label and project-relative references. Scans and inspections have no source-tree write operation.

## Remaining discrepancies and explicit stops

These are external validation/deployment gates, not silent implementation failures:

1. Firestore rules deployed successfully on 2026-08-14 to project `edotorial-review-tracker`, database `(default)`, using `firebase deploy --only firestore:rules --project edotorial-review-tracker`. The CLI compiled and released `firestore.rules`; no hosting, functions, or documents were deployed/changed.
2. The freshly packaged v0.1.4 app has not yet been run through the eight visual flows at normal/minimum size after the final remediation build.
3. Restart persistence, a disposable mixed CSV, a disposable Revision 02 DOCX, backup Save As, and a disposable second-account role change still require user-controlled external validation.
4. The real Google Drive project root has not been selected by this final build. Metadata scan, selected-file hydration/inspection, and production import each require their own approval. Existing source files remain untouched.
5. No live production import, commit, push, installation, tag, or publication occurred.
6. The direct-client Firestore architecture cannot independently enforce cross-document audit co-commit/accuracy, fully validate arbitrary nested stage-record maps, or prove last-admin preservation against a malicious/stale direct client. Application transactions and runtime validation cover the supported application path. On 2026-08-14 the owner explicitly accepted this bounded threat model for this non-commercial, trusted small-team release.

## Build artifacts

- `out/make/squirrel.windows/x64/Book Editorial Tracker-0.1.4 Setup.exe` — regenerated 2026-08-13 — SHA-256 `D429A8757B83EB30D315731B5E6E0DF2250F1B71E67581EAB0CD6158107946B7`
- `out/make/squirrel.windows/x64/book_editorial_tracker-0.1.4-full.nupkg` — regenerated 2026-08-13 — SHA-256 `1B4BDDD7A243BB6F58FA429F3E845785B622DF60DDA2E47F5A3EB635F019B448`
- `out/make/squirrel.windows/x64/RELEASES` — regenerated 2026-08-13 — SHA-256 `0CE886B0779E43C34536BA0B652E560D9D6571A95379E0E6E8F9464AB3CA306F`

## Decision

The current source test/type/diff/build/package gate is green. Release remains stopped at the canonical plan's external-action approvals and the unresolved direct-client security-model decision.
