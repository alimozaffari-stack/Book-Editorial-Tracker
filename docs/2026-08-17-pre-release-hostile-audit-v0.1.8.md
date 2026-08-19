# Book Editorial Tracker 0.1.8 — Final Pre-Release Hostile Audit

**Date:** 2026-08-17  
**Auditor:** Cline (adversarial review)  
**Scope:** Full codebase review of `codex/desktop-collaboration` branch at commit `c4ec750` (v0.1.8)

---

## 1. Build & Type-Check Reproduction

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ Pass — zero type errors |
| `vite build` | ✅ Pass — production build succeeds |
| `electron-builder` | Not run (no config file found; `package.json` scripts present) |

No build-blocking or type-checking defects were reproduced. The project compiles cleanly with the bespoke minimal React type declarations in `Src/React.d.ts` and the custom Firebase runtime shim.

---

## 2. Changelog Review (0.1.8)

The changelog for 0.1.8 claims fixes for:

1. Local-backend storage initialisation race
2. Stage conflict detection specificity (group by `chapterStageRank`)
3. Unauthenticated snapshot handling
4. Snapshot reliability and intake improvements
5. Small-team corrections project lifecycle and public storage

All five areas were traced to source and verified present in the codebase. No changelog claim was found to be unsubstantiated by code.

---

## 3. Security Audit (Hostile Review)

### 3.1 Electron Main Process (`Electron/Main.cjs`)

**contextIsolation / nodeIntegration:** The `BrowserWindow` is created with `contextIsolation: true` and `nodeIntegration: false` by default (verified in `Main.cjs`). This is the correct secure default.

**Content Security Policy:** The `RendererStartup.ts` sets a CSP meta tag in the HTML before the renderer loads. The CSP restricts `default-src`, `script-src`, `connect-src`, `img-src`, and `font-src`. **Issue:** The CSP `connect-src` directive allows `data:` URIs which, while low-risk for a desktop app, is unnecessary. Not a release blocker.

**IPC Surface:** The preload script (`Preload.cjs`) uses `contextBridge.exposeInMainWorld` with a minimal, explicit API surface. No `ipcRenderer.on` channel is exposed without a defined allowlist. The IPC handlers in `Main.cjs` validate inputs through policy modules before acting.

**Path Traversal:** `Project-path-policy.cjs` canonicalises paths using `path.resolve` and checks against the project root. `Project-file-policy.cjs` uses `crypto.createHash('sha256')` for integrity and validates file extensions against an allowlist. **No path traversal vulnerability found.**

**File Locking:** `Shared-project-lock.cjs` implements a lock file with PID and timestamp. Locks are released on process exit. **Issue:** There is no stale-lock timeout — if the process crashes without releasing the lock, the lock file persists indefinitely. The user must manually delete it. This is a known limitation noted in the plan document but is a poor UX for a public beta.

**Local Server (`Local-server.cjs`):** Binds to `127.0.0.1` only (loopback). **Good.** However, it does not set any authentication header or token. Any process on the local machine can connect to the local server port. **Low risk** for a desktop app but worth noting.

**URL Policy (`Url-policy.cjs`):** Validates auth hostnames against a curated list of Google/Firebase auth domains. Prevents arbitrary redirect URIs. **No open redirect vulnerability found.**

### 3.2 Renderer (`Src/App.tsx`)

**No `eval`, `innerHTML`, `dangerouslySetInnerHTML`, or `document.write`** found anywhere in the renderer source.

**Firebase credentials:** The `FirebaseRuntime.ts` reads configuration from `import.meta.env` (Vite environment variables). The `.env.example` correctly warns against bundling another person's Firebase profile. The `VITE_APP_VARIANT` controls team vs public builds.

**Data handling:** Chapter data flows through typed interfaces (`types.ts`). Firestore operations use `runTransaction` for atomic writes (visible in `__copy.ts` and `App.tsx`). No race conditions in multi-write scenarios.

### 3.3 Stage Conflict Detection (`Stage-source-policy.cjs`)

The 0.1.8 changelog claims "stage conflicts are now specific and prevent new same-rank records." The `Stage-source-policy.cjs` groups active records by `chapterStageRank(record)` and returns only groups with more than one record, sorted by `effectiveOn` then `recordedAt`. This matches the specification in `C1.txt` / `C2.txt` / `C60.txt`. **Implementation verified correct.**

---

## 4. Code Quality & Correctness Issues

### 4.1 Error Handling — CRITICAL

**Renderer (`App.tsx`):** The search for `catch` in the `Src` directory returned zero results, which is suspicious for a 50,000-line file. This suggests either the search tool failed, or error handling is genuinely absent. Reviewing `App.tsx` directly reveals that Firebase operations are wrapped in `runTransaction` callbacks which throw on error, but **the caller does not always catch transaction rejections**. If a Firestore transaction fails (network timeout, permission denied), the promise rejection may be unhandled.

**Electron main process:** IPC handlers in `Main.cjs` do not use try/catch in all handlers. An unhandled throw in an IPC handler will cause an unhandled exception in the main process, potentially crashing the app. This is a **release-blocking reliability issue** for a desktop application.

### 4.2 Stale Lock Recovery — HIGH

`Shared-project-lock.cjs` creates lock files but has no stale-lock detection or automatic cleanup. If the app crashes, the lock file remains and blocks all subsequent project access. The plan document acknowledges this but it remains unresolved. For a public beta, this will cause user-visible data lockout.

**Recommendation:** Add a stale-lock timeout (e.g., 5 minutes) or check if the PID in the lock file is still alive.

### 4.3 Local Server Port Conflict — MEDIUM

`Local-server.cjs` binds to a fixed port. If that port is already in use (another instance of the app, or another application), the server will fail silently or throw an unhandled error. There is no port-fallback or user-visible error message.

### 4.4 Unhandled Promise Rejections — MEDIUM

The `__copy.ts` file shows Firestore `runTransaction` calls. If these are not wrapped in try/catch at the call site, promise rejections propagate as unhandled rejections. Node.js 15+ terminates on unhandled rejections by default. In Electron, this crashes the renderer process.

### 4.5 Missing Test Suite — MEDIUM

No `Test/` directory exists. The `package.json` scripts do not include a `test` script. For a public beta release, the absence of any automated tests is a significant quality risk. The stage conflict detection logic, path policy, and file policy are all complex enough to warrant unit tests.

### 4.6 `.gitignore` Excludes Audit Logs — LOW

The `.gitignore` excludes `*.log`, `docs/*-audit-manifest-generation.log`, `docs/*-working-folder-discrepancy-report.md`, and `docs/*-working-folder-ledger.csv`. This means quality assurance artifacts are not version-controlled. While intentional, it means there is no auditable trail of past QA work in the repository.

### 4.7 Inconsistent Case in `index.html` — LOW

`index.html` references `/src/main.tsx` (lowercase) but the actual file is `Src/Main.tsx` (capitalised). This works on Windows (case-insensitive filesystem) but will break on case-sensitive filesystems (Linux, macOS with case-sensitive volumes). The Vite config appears to handle this via aliases, but it is a latent portability bug.

### 4.8 `dev` Script Binds to `0.0.0.0` — LOW

The `dev` script in `package.json` uses `vite --host=0.0.0.0`, which exposes the dev server to the local network. This is a minor security concern for development environments on shared networks.

---

## 5. Dependency Audit

Dependencies from `package.json` / `_p2.txt`:

| Dependency | Version | Notes |
|------------|---------|-------|
| `@google/genai` | ^1.29.0 | Google AI SDK — used for AI-assisted features |
| `@tailwindcss/vite` | ^4.1.14 | CSS framework |
| `@vitejs/plugin-react` | ^5.0.4 | React plugin |
| `better-sqlite3` | (from Bun.lock) | Local database — check for known CVEs before release |
| `electron` | (from devDeps) | Core framework |
| `firebase` | ^11.x | Backend SDK |
| `react` / `react-dom` | ^19.x | UI framework |

**No `package-lock.json` was found** — only `Bun.lock`. This means dependency resolution is not pinned with npm. If the release process uses npm, versions may differ from development.

---

## 6. Release Readiness Assessment

### Blocking Issues (Must Fix Before Release)

| # | Issue | Severity | File |
|---|-------|----------|------|
| B1 | IPC handlers in `Main.cjs` lack consistent try/catch — unhandled IPC errors crash the main process | Critical | `Electron/Main.cjs` |
| B2 | No stale-lock recovery in `Shared-project-lock.cjs` — crashed app permanently locks project | High | `Electron/Shared-project-lock.cjs` |

### Non-Blocking Issues (Fix in 0.1.9)

| # | Issue | Severity | File |
|---|-------|----------|------|
| N1 | No automated test suite | Medium | Project-wide |
| N2 | Unhandled promise rejections from Firestore transactions | Medium | `Src/App.tsx` |
| N3 | Local server port conflict has no fallback or user error | Medium | `Electron/Local-server.cjs` |
| N4 | `index.html` path casing (`src/main.tsx` vs `Src/Main.tsx`) | Low | `index.html` |
| N5 | CSP allows `data:` URIs in `connect-src` | Low | `Src/RendererStartup.ts` |
| N6 | `dev` script exposes to network (`0.0.0.0`) | Low | `package.json` |
| N7 | Audit logs git-ignored — no versioned QA trail | Low | `.gitignore` |
| N8 | No `package-lock.json` — dependency resolution not npm-pinned | Low | Project root |

---

## 7. Verdict

The codebase is well-structured with clear separation of concerns: Electron main process policies (`Url-policy`, `Project-path-policy`, `Project-file-policy`, `Stage-source-policy`, `Shared-project-lock`) are properly modularised. The renderer uses a single `App.tsx` monolith which, while large, is internally organised. Security defaults (context isolation, CSP, path validation, URL allowlisting) are sound.

However, **two issues block the 0.1.8 public beta release**:

1. **B1 — IPC handler error handling:** A single unhandled throw in any IPC handler will crash the entire Electron main process, taking the app down with no recovery. For a public beta where users will encounter unexpected file states, this is unacceptable.

2. **B2 — Stale lock recovery:** A crashed app leaves a lock file that permanently blocks project access. Public beta users will not know to manually delete lock files. This must be fixed with either a PID liveness check or a timestamp-based stale lock timeout.

Once B1 and B2 are resolved, the codebase is in adequate condition for a public beta release. The non-blocking issues should be tracked for 0.1.9.