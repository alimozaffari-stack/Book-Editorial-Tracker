# Stage 0 Baseline — Public Beta Execution Plan

Run date: 2026-08-16

## Scope and source

- Requested stage: `docs/superpowers/plans/2026-08-16-public-beta-execution-plan.md` (Stage 0 only)
- Working directory used: `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker`
- Plan baseline commit recorded in plan: `c4ec750 feat: snapshot reliability and intake improvements`

## Baseline command checks

- `git status --short`
  - Total lines: `163`
  - Untracked: `163`
  - Modified: `0`
  - Notable baseline artifact: working tree is intentionally dirty; no clean/reset/pull/push action was performed.
- `git log -1 --oneline --decorate`
  - `c4ec750 (HEAD -> codex/desktop-collaboration) feat: snapshot reliability and intake improvements`
- `npm run lint` (after `rtk` helper was unavailable in this shell)
  - Command output: `book-editorial-tracker@0.1.5 lint` then `tsc --noEmit`
  - PowerShell preamble warning: `Test-Path : Access is denied ... C:\Users\ali_m\...\bin\npm-cli.js`
  - Exit code: `0`
  - Result classification: no source-code lint failure observed.

## Files read for Stage 0

- `package.json`
- `src/App.tsx`
- `src/types.ts`
- `electron/main.cjs`
- `electron/preload.cjs`
- `firestore.rules`
- `docs/superpowers/plans/2026-08-15-small-team-corrections-project-lifecycle-and-public-storage.md`

## Package scripts snapshot (`package.json`)

- `dev`: `vite --port=3000 --host=0.0.0.0`
- `build`: `vite build`
- `preview`: `vite preview`
- `clean`: `rm -rf dist`
- `test`: `node --import tsx --test tests/activityLog.test.ts ... tests/teamRoles.test.ts`
- `lint`: `tsc --noEmit`
- `prestart`: `npm run build`
- `start`: `electron-forge start`
- `package`: `electron-forge package`
- `premake`: `npm run build`
- `make`: `electron-forge make`

## Stage 0 run-time check

- Desktop app running check:
  - TCP port `43119`: `PORT_FREE` (no listener on test check)
  - Process hint: process names matching tracker signatures were observed:
    `39768`, `42188`, `43636`, `48476`, `49008` (names: `Book Editorial Tracker`)
- Interpretation: app-like process instances are present, but the target test port was not occupied at check time.

## Stage 0 gate result

- HEAD matches required baseline `c4ec750`.
- Lint command exit was successful (no source-failing result).
- Stage 0 baseline recorded; no application source edits were made.
