# Book Editorial Tracker v0.1.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Book Editorial Tracker v0.1.3 with Windows shortcuts.

**Architecture:** Retain Electron Forge and Squirrel; add shortcut lifecycle handling in the Electron main process and update release-facing branding metadata.

**Tech Stack:** Electron 40, Electron Forge, Squirrel.Windows, Vite, React.

## Global Constraints

- Preserve Firebase configuration and existing local data.
- Publish only after tests, type-checking, and Windows packaging pass.
- Fast-forward `main` only after the verified release branch is pushed.

---

### Task 1: Regression coverage

**Files:**
- Modify: `tests/forgeConfig.test.mjs`

- [x] Add assertions for v0.1.3 branding and Squirrel shortcut lifecycle handling.
- [x] Run tests and confirm the new assertions fail before implementation.

### Task 2: Branding and lifecycle

**Files:**
- Modify: `package.json`, `package-lock.json`, `index.html`, `src/App.tsx`, `electron/main.cjs`

- [x] Rename product labels and set version `0.1.3`.
- [x] Create or remove Squirrel shortcuts during lifecycle events.

### Task 3: Package and publish

**Files:**
- Modify: `README.md`, `CHANGELOG.md`
- Create: `docs/RELEASE_NOTES_v0.1.3.md`

- [ ] Run tests, type-check, and package the installer.
- [ ] Publish the release, then fast-forward `main` to its verified commit.
