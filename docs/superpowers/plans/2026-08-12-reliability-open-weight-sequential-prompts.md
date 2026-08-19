# Book Editorial Tracker: Open-Weight Sequential Execution Prompts

> **Do not execute these prompts:** They target the superseded full-scale plan. Use the 2026-08-13 small-team completion plan instead.

**Purpose:** Copy one prompt at a time into Codex. This companion document does not replace or alter the approved implementation plan; it only supplies execution prompts and translates its model-routing overlay to OpenRouter's open-weight `openai/gpt-oss-120b`.

**Authoritative functional plan:** `docs/superpowers/plans/2026-08-12-reliability-import-and-document-intake.md`

## Model Routing

| Profile | OpenRouter model | Reasoning effort | Use |
|---|---|---|---|
| Standard | `openai/gpt-oss-120b` | `high` | Tasks 2, 3, 7, 8, and ordinary verification. |
| Critical | `openai/gpt-oss-120b` | `max` | Task 1; the continuous Tasks 4-6 safety cluster; Task 9; and any critical-boundary repair found in Task 10. |

The model must never switch its own model or effort. The prompts require it to stop and ask you to make the change before work begins. If your OpenRouter interface calls its maximum setting `xhigh` rather than `max`, choose the highest available reasoning setting.

Keep the same Codex task/session for the entire sequence where practical. If starting a fresh task, paste the **Session bootstrap** prompt first, then the next task prompt. Do not paste all tasks at once.

## Session Bootstrap

```text
Work in C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker.

Read and follow these two documents exactly:
1. docs/superpowers/plans/2026-08-12-reliability-import-and-document-intake.md
2. docs/superpowers/plans/2026-08-12-reliability-open-weight-sequential-prompts.md

The first is authoritative for functional scope. The second is authoritative only for OpenRouter open-weight model routing and these sequential prompts. Use openai/gpt-oss-120b. Do not make code changes yet.

Before every action, inspect and verify relevant files. Preserve unrelated working-tree changes, including the existing untracked scripts/ directory. Prefix shell commands with rtk. Do not broaden scope, alter product decisions, skip tests, persist secrets, or touch the user's manuscript files except through the user-confirmed chooser flows defined in the plan.

Reply with: (a) the current git status, (b) confirmation that both documents were read, (c) the next task and required model profile. Then wait.
```

## Prompt 1 — Task 1: Concurrency protection (Critical)

Before pasting, set `openai/gpt-oss-120b` to **max** reasoning effort.

```text
Execute only Task 1, “Freeze evidence and add concurrency protection,” from docs/superpowers/plans/2026-08-12-reliability-import-and-document-intake.md.

This is a Critical phase. Confirm that the active model is openai/gpt-oss-120b at max reasoning effort. If it is not, stop and ask me to switch it; do not inspect implementation files or make changes until I confirm.

After confirmation, follow every Task 1 step in order: preserve production evidence before deployment work, write failing tests first, implement only the specified revision-aware write seam and conflict behaviour, keep existing submissions safe, update only the stated audit actions, and run the focused and required verification.

Do not start Task 2. When Task 1 is complete, report changed files, test commands and results, data-protection evidence, unresolved risks, and the exact acceptance-criterion result. Then ask me to switch openai/gpt-oss-120b back to high reasoning effort for Task 2, and wait.
```

## Prompt 2 — Task 2: Canonical progress resolver (Standard)

Before pasting, set `openai/gpt-oss-120b` to **high** reasoning effort.

```text
Execute only Task 2, “Create the canonical progress and discrepancy module,” from the authoritative implementation plan.

This is a Standard phase. Confirm that openai/gpt-oss-120b is at high reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Use the exact Task 2 interfaces and matrix. Write failing tests first, then implement one canonical pure resolver and discrepancy module. Update only the Task 2 consuming panels. Preserve all legacy fields and do not run reconciliation or change live data in this task.

Do not start Task 3. Report changed files, focused/full test results, any remaining panel discrepancy, and whether the Task 2 acceptance criterion passed. Keep the model at high and wait.
```

## Prompt 3 — Task 3: CSV reviewed append/merge (Standard)

```text
Execute only Task 3, “Replace CSV rejection with a reviewed append/merge plan,” from the authoritative implementation plan.

This is a Standard phase. Confirm that openai/gpt-oss-120b remains at high reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Follow the Task 3 TDD sequence exactly. Implement row-level CSV planning and explicit duplicate resolutions; do not permit a duplicate ID to block valid new rows, reset existing fields from defaults, replace an entire chapter, or perform a Firestore write before review and revision checking.

Do not start Task 4. Report changed files, the exact import cases tested, verification results, and Task 3 acceptance status. Then ask me to switch openai/gpt-oss-120b to max reasoning effort for the continuous Tasks 4-6 Critical cluster, and wait.
```

## Prompt 4 — Task 4: Stable authentication (Critical cluster starts)

Before pasting, set `openai/gpt-oss-120b` to **max** reasoning effort.

```text
Execute only Task 4, “Stabilize Firebase authentication across application launches,” from the authoritative implementation plan.

This starts the Critical Tasks 4-6 cluster. Confirm that openai/gpt-oss-120b is at max reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Follow Task 4 exactly. Diagnose and repair only the stable Electron origin, single-instance, and Firebase persistence boundary required by the plan. Never persist OAuth access tokens, passwords, or Drive credentials. Use failing tests first and run all required Task 4 verification.

Do not start Task 5. Report changed files, restart/persistence evidence, security invariants checked, verification results, and Task 4 acceptance status. Keep the model at max for Task 5 and wait.
```

## Prompt 5 — Task 5: Controlled JSON backup/import (Critical cluster continues)

```text
Execute only Task 5, “Retire destructive Drive JSON sync and provide controlled backup import,” from the authoritative implementation plan.

This remains in the Critical Tasks 4-6 cluster. Confirm that openai/gpt-oss-120b remains at max reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Follow Task 5 exactly. Make Firestore the sole live shared tracker; retain only user-directed backup/export/import with the approved review seam. Remove no data and do not make silent Drive, JSON, or Firestore writes. Keep filesystem paths and secrets out of persisted data.

Do not start Task 6. Report changed files, removed/retired behaviour, backup/import test results, verification results, and Task 5 acceptance status. Keep the model at max for Task 6 and wait.
```

## Prompt 6 — Task 6: DOCX inspection and submission ledger (Critical cluster ends)

```text
Execute only Task 6, “Add the deep DOCX inspection and submission-ledger modules,” from the authoritative implementation plan.

This remains in the Critical Tasks 4-6 cluster. Confirm that openai/gpt-oss-120b remains at max reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Follow the Task 6 TDD sequence exactly. Add only the approved jszip dependency. Enforce opaque candidate IDs, file and XML size bounds, DOCX-only handling, metadata/hash isolation, and the append-only ledger plus legacy projections. Do not store document bytes, tokens, passwords, or absolute paths.

Do not start Task 7. Report changed files, dependency change, security/bounds tests, verification results, and Task 6 acceptance status. Then ask me to switch openai/gpt-oss-120b back to high reasoning effort for Task 7, and wait.
```

## Prompt 7 — Task 7: Manual submission intake (Standard)

Before pasting, set `openai/gpt-oss-120b` to **high** reasoning effort.

```text
Execute only Task 7, “Add manual submission intake to the chapter editor,” from the authoritative implementation plan.

This is a Standard phase. Confirm that openai/gpt-oss-120b is at high reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Follow Task 7 exactly. Use the Task 6 interfaces; do not reimplement DOCX parsing, path handling, or ledger rules in UI code. Keep the user in control of stage, revision, confirmed date, and word-count correction. Attach only metadata and write one reviewed Firestore transaction per record.

Do not start Task 8. Report changed files, interaction cases tested, verification results, and Task 7 acceptance status. Keep the model at high and wait.
```

## Prompt 8 — Task 8: Reviewed one-time folder intake (Standard)

```text
Execute only Task 8, “Add reviewed one-time project-folder intake,” from the authoritative implementation plan.

This is a Standard phase. Confirm that openai/gpt-oss-120b remains at high reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Follow every Task 8 constraint and test fixture exactly. The scan must be user-initiated, bounded, preview-only until confirmation, conservative about ambiguity, and must produce the required CSV ledger and Markdown discrepancy report through a user-confirmed Save As flow. It must not mutate the manuscript root or accept filename-only evidence.

Do not start Task 9. Report changed files, synthetic known-shape results, report-escaping evidence, verification results, and Task 8 acceptance status. Then ask me to switch openai/gpt-oss-120b to max reasoning effort for Task 9, and wait.
```

## Prompt 9 — Task 9: Consistency repair and transition (Critical)

Before pasting, set `openai/gpt-oss-120b` to **max** reasoning effort.

```text
Execute only Task 9, “Add reviewed consistency repair and complete the transition,” from the authoritative implementation plan.

This is a Critical phase. Confirm that openai/gpt-oss-120b is at max reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Follow Task 9 exactly. The repair system must be additive, backup-gated, previewed, transactional, revision-checked, auditable, and user-selectable. It must never infer a chapter submission from word count/folder name, change Yes to No, or delete content. Update only the stated documentation and release-note files.

Do not start Task 10. Report changed files, repair-proposal cases, backup gate evidence, verification results, and Task 9 acceptance status. Then ask me to switch openai/gpt-oss-120b back to high reasoning effort for Task 10, and wait.
```

## Prompt 10 — Task 10: Release verification (Standard)

Before pasting, set `openai/gpt-oss-120b` to **high** reasoning effort.

```text
Execute only Task 10, “Release verification and production smoke test,” from the authoritative implementation plan.

This is a Standard verification phase. Confirm that openai/gpt-oss-120b is at high reasoning effort. If it is not, stop and ask me to switch it; do not make changes until I confirm.

Run the complete automated gate, protected-data checks, packaged-app smoke matrix, and pre/post reconciliation outputs exactly as specified. Produce the required timestamped test log, CSV ledger, and Markdown discrepancy report. Do not install the release, mutate production data, or repair defects beyond the plan's stated authority without first reporting the evidence.

If a defect touches a Task 1, 4, 5, 6, or 9 critical boundary, stop before repair. Ask me to switch openai/gpt-oss-120b to max reasoning effort, identify the affected task boundary, and wait. After an approved repair and re-verification, ask me to return to high before resuming this smoke matrix.

When finished, report every command/result, generated artifact path, data-protection check, smoke-matrix result, unresolved defect, and whether the Task 10 acceptance criterion passed. Wait for release-installation direction.
```

## Optional Final Hostile Review Prompt

Use this only after Task 10 passes. Start a fresh Codex task with `openai/gpt-oss-120b` at **max** reasoning effort.

```text
Perform a read-only hostile review of the completed Book Editorial Tracker implementation against docs/superpowers/plans/2026-08-12-reliability-import-and-document-intake.md. Do not edit files, install packages, run migrations, export/import data, or launch a release installer.

Inspect the actual diff, tests, package scripts, Electron/Firebase persistence boundary, import/write paths, DOCX intake bounds, privacy guarantees, and panel-progress resolver. Report only evidence-backed findings, ranked by severity, with exact file and line references. If there are no findings, say so and list the checks actually performed. Do not propose scope expansion.
```
