# Reliability Completion Handoff — 13 August 2026

## Purpose and safe boundary

This handoff continues the canonical plan at `docs/superpowers/plans/2026-08-13-reliability-completion-plan-v2-small-team.md`. Work is in the shared, intentionally dirty repository `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker` on branch `codex/desktop-collaboration`, with baseline commit `898b5204bd3749bb0ce11fdeaf7a5420aa74d6b1`.

Preserve every existing uncommitted change. Do not run `git reset`, `git clean`, pull, push, install, deploy, or remove generated/user files. In particular, do not change, rename, move, or delete an original document or folder under the selected Google Drive working folder. The completed implementation only reads such folders after the named external approval and only writes reports through a desktop Save As chooser outside that root.

No Firebase rules deployment, production import, packaged-app installation, commit, push, tag, or publication was performed in this session.

## What is now implemented in the shared working tree

- Derived stage-history progress, including current stage/current word count, active-history conflict detection, stage ordering, and preservation of server-current submission history during ordinary chapter saves.
- Transactional chapter save, stage append, void-with-required-reason, single-event batch update/delete, stale-revision rejection, and project-import concurrency baselines.
- Role-aware UI and Firestore policy work: roster-backed five-member cap, last-admin and active-session self-demotion protection, safer roster bootstrap for an existing legacy admin, and guided listener-error recovery.
- Activity filtering/export display improvements, including batch/import `chapterIds` and visible affected-chapter identifiers.
- Bounded, preview-first CSV/backup/project-folder intake. Backup version is now fail-closed at version 1; unsafe IDs, filenames, paths, URLs, feedback links, and malformed stage records are rejected before writes.
- DOCX inspection checks the package type and enforces entry-size limits before processing XML; project scans classify the known `1ST MANUSCRIPT FEEDBACK` variant as feedback round 0.
- Desktop Save As policy blocks selected-source-root paths including resolved junction/symlink aliases. The retired working-folder audit/report writer was removed so scan activity cannot write into a selected Drive root.
- Dialog/accessibility and mutation-state hardening for preview, stage entry, chapter conflict resolution, team errors, and batch edits.

These are uncommitted shared-worktree changes. They include pre-existing broad changes from the canonical implementation as well as this remediation pass; do not treat the following list as an ownership boundary or discard any item merely because it predates this handoff.

## Current verification evidence

Executed against the current source snapshot on 13 August 2026:

| Check | Result |
| --- | --- |
| `npm.cmd test` | PASS — 81 tests, 81 passed, 0 failed |
| `node_modules\\.bin\\tsc.cmd --noEmit` | PASS |
| `git diff --check` | PASS |
| `npm.cmd run build` | PASS — Vite 6.4.1, 2309 modules, `dist/index.html` 2,458.84 kB (gzip 1,191.77 kB) |
| `npm.cmd run make` | PASS — Electron Forge Squirrel win32/x64 artifacts regenerated under `out/make` |

The first normal sandbox attempts for build/make correctly failed because esbuild could not read a resolved parent directory. The privileged retries passed. This is an environment restriction, not a source failure.

The older `docs/verification` ledger/report/test-log files predate this pass and may still report 67 tests or stale hashes. Do not rely on them. Refresh them only after the remaining external/manual gates below, and bind any hashes to the final exact source and artifact paths.

## Important residual limits to retain

1. Firestore Security Rules cannot atomically prove that an unrelated activity document was created in the same client transaction as a chapter/team mutation. The application implementation performs both in one transaction; rules restrict activity creation to editors/admins and validate its outer shape. Do not claim a stronger cross-document rule invariant than Firestore supports.
2. Rules language cannot safely iterate arbitrary list/map values. Application validators fail closed for chapter IDs, references, filenames, stage records, and import rows. Keep document-key/length policy in rules and runtime element validation in the application.
3. The first roster bootstrap assumes a pre-existing valid administrator user document. If that condition is absent, stop: provisioning/migration is an external owner action, not a UI workaround.
4. `out/` is a generated local artifact area. It was rebuilt but was not installed or distributed.

## Reviewer state and remaining design decision

Two hostile reviews were requested after the user switched models: specification and standards/security. Their reported P1/P2 findings drove the remediation above. The standards/security re-review leaves three material **architecture-level** assurances that ordinary Firestore client rules cannot truthfully provide in the present direct-client design:

1. Rules cannot require a generated, arbitrary-ID Activity event to co-commit with a chapter/team write, nor can they prove that its description accurately represents the mutation. The application does use one transaction for these writes, but a direct/old client is not ruled out.
2. Rules cannot iterate the arbitrary map objects inside `submissions` to validate every nested stage-record field/reference. Application validators fail closed; a malicious direct editor can still bypass those renderer validators.
3. Rules cannot count administrator-role documents or bind roster membership to administrator role membership after a multi-document update, so they cannot independently prove last-admin preservation against a direct/stale client.

The calendar-date defect found in review was fixed: non-existent dates such as `2026-02-31` are now rejected in manual stage intake, project-review correction, project apply validation, and the generic stage-record validator; the suite remains 81/81 PASS.

Do not label the above three limitations as full completion. The next provider must choose one of these explicit paths with the owner:

- **Strong guarantee (recommended):** move all chapter/team/activity mutations behind a trusted server endpoint or Cloud Function that validates a full schema, writes the mutation and canonical audit event atomically, and owns roster/admin invariants. This requires a new deployment approval and a migration/test plan.
- **Bounded direct-client acceptance:** preserve the present application transactions and runtime validation, state the residual direct-client threat model explicitly, and obtain owner acceptance before deploying the rules. This is weaker than the canonical wording and should not be presented as equivalent.

Decision recorded 2026-08-14: the owner accepted the bounded direct-client model for this non-commercial, trusted small-team release.

The specification reviewer also identified these current-tree P2 items for the next provider to resolve before treating the plan as complete:

- derive the session role from roster membership (while retaining the no-roster legacy-admin bootstrap path), not merely from the self-readable `users/{email}` document;
- recalculate the existing project-scan preview whenever the chapter listener changes and after both created and skipped chapter-import outcomes;
- give chapter deletion the same awaited busy/success/error/conflict feedback as batch updates;
- allow feedback round 0 in the project-preview number input (its shared control currently uses a minimum of 1); and
- give the primary chapter and add-chapter modal overlays dialog semantics, initial focus, and first-invalid-field focus recovery.
- replace raw JSON parse/file-read error text in backup intake with a stable, editor-facing failure/retry message.

These are intentionally listed as remainder work rather than silently folded into a completion claim.

## Recommended continuation provider

Use an agentic coding model with a long context window, Windows shell competence, strong TypeScript/Firestore reasoning, and a willingness to stop for external approvals.

1. **Recommended primary:** the newest available Codex coding model, currently **GPT-5.3-Codex** where available, at high reasoning effort. OpenAI describes it as its most capable agentic coding model; its release notes state it combines the Codex and GPT-5 training stacks. For an OpenAI API-only alternative, use the current `gpt-5.2-codex` model family with high/xhigh reasoning, which is documented for long-horizon coding work and a 400k context window. Sources: [OpenAI model release notes](https://help.openai.com/en/articles/9624314-model-release-notes), [GPT-5.2-Codex model documentation](https://developers.openai.com/api/docs/models/gpt-5.2-codex).
2. **Open-weight fallback:** use the strongest locally available code-specialised Qwen Coder model that fits the available VRAM, preferably with 32-bit/16-bit tool-use support rather than a heavily quantised tiny model. Use it for bounded code inspection, tests, and drafting; retain a frontier model or human reviewer for Firestore security-rules changes, migration semantics, and final hostile review.
3. **Second open-weight option:** use an instruction-tuned Llama 4 Maverick-class deployment only if it is already locally hosted and has adequate context/tool integration. It is better treated as a review/drafting assistant than the sole owner of this approval-heavy, security-sensitive continuation. Meta’s current Llama documentation lists Maverick as a multimodal text/image model. Source: [Meta Llama documentation](https://ai.meta.com/llama/get-started/).

The model choice is less important than preserving this handoff, passing the exact gates below, and refusing to improvise around the explicit external approvals.
