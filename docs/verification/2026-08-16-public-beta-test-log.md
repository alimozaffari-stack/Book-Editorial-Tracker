# 2026-08-16 Public Beta Test Log

Date: 2026-08-16
Workspace: `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker`
Stage: `Stage 8 - final verification and public-release gates`

## Preconditions

- Installed desktop app running before first check: `no`
- Action taken on running desktop app: `none required`
- Packaging performed: `no`
- Firestore deployment performed: `no`
- Google Drive folder or document writes performed: `no`

## Automated command outcomes

| Command | Environment | Exit code | Outcome | Notes |
| --- | --- | ---: | --- | --- |
| `cmd /c npm test` | restricted | 0 | pass | `162 passed`, `0 failed`, `6 suites`, duration `3655.7707 ms` |
| `cmd /c npm run lint` | restricted | 0 | pass | `tsc --noEmit` |
| `cmd /c npm run build:team` | restricted | 1 | fail | esbuild/Vite config-load failure: `Cannot read directory "../../.." : Access is denied.` and `Could not resolve "...\\vite.config.ts"` |
| `cmd /c npm run build:team` | elevated | 0 | pass | Vite `6.4.1`; built `dist/index.html`; duration `23.32s` |
| `cmd /c npm run build:public` | restricted | 1 | fail | esbuild/Vite config-load failure: `Cannot read directory "../../.." : Access is denied.` and `Could not resolve "...\\vite.config.ts"` |
| `cmd /c npm run build:public` | elevated | 0 | pass | Vite `6.4.1`; built `dist/index.html`; duration `23.30s` |
| `git diff --check` | restricted | 0 | pass with warnings | CRLF working-copy warnings only; no diff content errors |

## Test boundary

`npm test` now includes the Stage 5 through Stage 7 focused suites:

- `tests/backendContract.test.ts`
- `tests/firebaseProfile.test.ts`
- `tests/projectFileFormat.test.ts`
- `tests/projectFilePolicy.test.cjs`
- `tests/publicPackageBoundary.test.mjs`
- `tests/sharedProjectLock.test.cjs`

## Fresh public build boundary scan

Scan target: `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\dist`

| Prohibited token class | Match count |
| --- | ---: |
| owner project id | 0 |
| owner API key | 0 |
| owner email | 0 |
| `firebase-applet-config.json` | 0 |

## Build artifacts

| Artifact path | Exists | SHA-256 |
| --- | --- | --- |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\dist\index.html` | yes | `8147C9A4A66372A7DDEED8290A4FC8E89460B2C027B5F3AE44A4397DAE9F427C` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\dist\editorial-review-tracker-mark.png` | yes | `72FC59D55F0289C333FD658450DFA31A53508B8DD85F39EC8DE2F9DB9086C91C` |

## Manual smoke checks

Status: `pending`

The Stage 8 plan calls for genuine manual smoke checks on synthetic local data only. No manual smoke pass is recorded here because those checks were not genuinely performed in this run:

- local create -> save -> reopen
- shared-lock read-only fallback
- public Firebase setup rejects owner config
- Team Firebase startup remains unchanged

## Public packaging configuration for Gate A

- Public build script: `set VITE_APP_VARIANT=public&&vite build`
- Public make script: `set VITE_APP_VARIANT=public&&electron-forge make`
- Public packaging ignore rule: `process.env.VITE_APP_VARIANT === 'public' && /firebase-applet-config\.json/.test(path)`
- Public setup copy requires users to create their own Firebase project, enable Firebase Authentication and Firestore, and deploy the supplied Firestore rules themselves.

## Known limitations

- The restricted execution environment cannot load `vite.config.ts` for either build; both builds required the approved elevated rerun.
- No installer packaging was performed in this Stage 8 run.
- No live Firebase deployment or live tracker reset was performed.
- Manual smoke checks remain pending.

## Public packaging outcomes

| Command | Environment | Exit code | Outcome | Notes |
| --- | --- | ---: | --- | --- |
| `cmd /c npm run make:public` | restricted | 1 | fail | Electron Forge packaging failed after packaging began with `connect EACCES 4.237.22.38:443` |
| `cmd /c npm run make:public` | elevated | 0 | pass | Public installer artifacts written to `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make` |

### Generated public installer artifacts under `out`

| Artifact path | Size bytes | SHA-256 |
| --- | ---: | --- |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\Book Editorial Tracker-0.1.5 Setup.exe` | 137127424 | `ACA8FFD1D34B7094EFAAD11A44498E6213E3C7B162EFE90BBA8471087D55BA46` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\book_editorial_tracker-0.1.5-full.nupkg` | 136325255 | `2AEC776AEE7A3231C40DF96031C2DB00772008785ACEECC7B4168C7A0C669F7A` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\RELEASES` | 93 | `82A2FC03F71911A7068F006A8303DC044B7565B87E6D43C191BCCE5A45773702` |

### Public packaging boundary confirmation

- `firebase-applet-config.json` matches under `out`: `0`
- Public packaging exclusion confirmed by recursive packaged-output scan after the successful elevated `make:public` run.

## Stage 5 correction pass

Status date: `2026-08-16`

This correction pass did not rebuild or re-hash any installer artifact. The earlier installer evidence from the prior `make:public` run is now superseded for public-boundary purposes because it predated the final hostile-review fixes.

### Correction command outcomes

| Command | Environment | Exit code | Outcome | Notes |
| --- | --- | ---: | --- | --- |
| `node --import tsx --test tests/projectFileFormat.test.ts tests/backendContract.test.ts tests/rendererStartup.test.ts` | restricted | 0 | pass | `19 passed`, `0 failed` |
| `node --test tests/forgeConfig.test.mjs` | restricted | 0 | pass | `8 passed`, `0 failed` |
| `node --test tests/publicPackageBoundary.test.mjs tests/publicPackageArchive.test.mjs` | restricted | 0 | pass | `2 passed`, `0 failed` after refreshed public `app.asar` |
| `cmd /c npm run lint` | restricted | 0 | pass | `tsc --noEmit` |
| `cmd /c npm run build:team` | restricted | 1 | fail | esbuild/Vite config-load failure: `Cannot read directory "../../.." : Access is denied.` and `Could not resolve "...\\vite.config.ts"` |
| `cmd /c npm run build:team` | elevated | 0 | pass | Vite `6.4.1`; built `dist/index.html`; duration about `10.41s` |
| `cmd /c npm run build:public` | restricted | 1 | fail | esbuild/Vite config-load failure: `Cannot read directory "../../.." : Access is denied.` and `Could not resolve "...\\vite.config.ts"` |
| `cmd /c npm run build:public` | elevated | 0 | pass | Vite `6.4.1`; built `dist/index.html`; duration about `10.28s` |
| `cmd /c "set VITE_APP_VARIANT=public&&.\\node_modules\\.bin\\electron-forge.cmd package"` | restricted | 1 | fail | network denial: `connect EACCES 4.237.22.38:443` |
| `cmd /c "set VITE_APP_VARIANT=public&&.\\node_modules\\.bin\\electron-forge.cmd package"` | elevated | 0 | pass | refreshed unpackaged public app at `out\\Book Editorial Tracker-win32-x64\\resources\\app.asar` |
| `git diff --check` | restricted | 0 | pass with warnings | CRLF working-copy warnings only; no diff content errors |

### Refreshed public archive scan

Scan target: `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\Book Editorial Tracker-win32-x64\resources\app.asar`

| Prohibited token class | Match count |
| --- | ---: |
| owner project id | 0 |
| owner API key | 0 |
| owner email | 0 |
| `firebase-applet-config.json` | 0 |

### Manual smoke status

- Manual smoke remains `pending`.
- No correction-pass evidence claims local/shared/public Firebase manual smoke passed.
- The earlier public installer should be treated as non-compliant and superseded for release evidence until a later approved installer rebuild is performed.

## Corrected public installer build

Status date: `2026-08-16`

This pass built the corrected public installer only. It did not install the installer, deploy Firebase rules, publish, push, reset, clean, pull, or modify any Google Drive file/folder.

### Installer build command outcomes

| Command | Environment | Exit code | Outcome | Notes |
| --- | --- | ---: | --- | --- |
| `cmd /c npm run make:public` | restricted | 1 | fail | Electron Forge make failed with `connect EACCES 4.237.22.38:443` |
| `cmd /c npm run make:public` | elevated | 0 | pass | Corrected public installer artifacts written to `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make` |
| `node --test tests/publicPackageArchive.test.mjs` | restricted | 0 | pass | `1 passed`, `0 failed` against the refreshed packaged public archive |
| `git diff --check` | restricted | 0 | pass with warnings | CRLF working-copy warnings only; no diff content errors |

### Corrected public installer artifacts under `out\make`

| Artifact path | Size bytes | SHA-256 |
| --- | ---: | --- |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\Book Editorial Tracker-0.1.5 Setup.exe` | 136791552 | `9CC8BDF97C1C4D1F0A3A2A32D228098245268EB8382DAE52E2CF2EED5DE857E6` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\book_editorial_tracker-0.1.5-full.nupkg` | 135989301 | `43852E91C2424DCCE5EEF611F681E8EC7C26A87B485E1703225412FABCE1F0E3` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\RELEASES` | 93 | `00C6A7E9EC1ED187A2541850B3041165290916F4662B6944676350317B001EC5` |

### Final package-archive boundary results

Scan target: `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\Book Editorial Tracker-win32-x64\resources\app.asar`

| Prohibited token class | Match count |
| --- | ---: |
| owner project id | 0 |
| owner API key | 0 |
| owner email | 0 |
| `firebase-applet-config.json` | 0 |

### Gate status

- This corrected installer artifact is eligible for a separate installation approval.
- Manual smoke remains pending and is not marked passed here.

## 0.1.6 corrective beta packaging pass

Status date: `2026-08-16`

This pass prepares the next public beta installer as version `0.1.6`. It includes the narrow public-Firebase navigation correction:

- `Back to storage choices` is present in Firebase setup.
- It returns to `Choose storage` by clearing only transient Firebase-setup navigation state.
- The local and shared editor-label helper text remains:
  - `Used only to identify changes in this project; it does not create an account.`

Command outcomes, artifact hashes, and package-archive counts for the `0.1.6` build are recorded below after the fresh build/package commands.

### 0.1.6 corrective beta command outcomes

| Command | Environment | Exit code | Outcome | Notes |
| --- | --- | ---: | --- | --- |
| `node --import tsx --test tests/storageChoiceFlow.test.ts` | restricted | 0 | pass | `3 passed`, `0 failed`; confirms the Back-to-storage correction and both editor-label helper texts |
| `cmd /c npm run lint` | restricted | 0 | pass | `tsc --noEmit` under `book-editorial-tracker@0.1.6` |
| `git diff --check` | restricted | 0 | pass with warnings | CRLF working-copy warnings only; no diff content errors |
| `cmd /c npm run build:public` | restricted | 1 | fail | Known Vite/esbuild config-load failure: `Cannot read directory "../../.." : Access is denied.` and `Could not resolve "...\\vite.config.ts"` |
| `cmd /c npm run build:public` | elevated | 0 | pass | Vite `6.4.1`; built `dist/index.html`; duration `22.53s` |
| `cmd /c npm run make:public` | restricted | 1 | fail | Known Forge packaging failure: `connect EACCES 4.237.22.38:443` |
| `cmd /c npm run make:public` | elevated | 0 | pass | Created public `0.1.6` Squirrel artifacts under `out\\make` |
| `node --test tests/publicPackageArchive.test.mjs` | restricted | 0 | pass | `1 passed`, `0 failed` against the fresh packaged public archive |

### 0.1.6 public installer artifacts under `out\make`

| Artifact path | Exists | SHA-256 |
| --- | --- | --- |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\Book Editorial Tracker-0.1.6 Setup.exe` | yes | `3F6B990E899187DD2FF1E9C63A44E22BDD0EB98FF5312DB01ABD17547C1C01C9` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\book_editorial_tracker-0.1.6-full.nupkg` | yes | `3429D9B2F1EE821A19A185575833190D3B1F5A91BBE69D4ED2EBD8ECFCBF4F35` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\RELEASES` | yes | `EB8ACADC7EA7F45C23E8DEDC5008F9722117A9214D04800C63681BDF5B8BAD78` |

### 0.1.6 package-archive counts

Scan target: `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\Book Editorial Tracker-win32-x64\resources\app.asar`

| Prohibited token class | Match count |
| --- | ---: |
| owner project id | 0 |
| owner API key | 0 |
| owner email | 0 |
| `firebase-applet-config.json` | 0 |

### 0.1.6 gate status

- The generated installer is named `Book Editorial Tracker-0.1.6 Setup.exe`.
- This `0.1.6` corrective public beta is eligible for a separate installation approval.
- No installation was performed in this pass.

## 0.1.7 corrective beta packaging pass

Status date: `2026-08-17`

This pass packages version `0.1.7` for the local/shared lock fix. It confirms:

- `src/App.tsx` guards shared-lock release with shared-folder mode only.
- local mode clears shared lock token/state through `buildSharedProjectLockStateForPortableMode`.
- the targeted fix is that local-mode startup no longer incorrectly invokes shared-lock release.

### 0.1.7 command outcomes

| Command | Environment | Exit code | Outcome | Notes |
| --- | --- | ---: | --- | --- |
| `node --import tsx --test tests/storageChoiceFlow.test.ts` | restricted | 0 | pass | `5 passed`, `0 failed` |
| `node --import tsx --test tests/projectFileFormat.test.ts tests/backendContract.test.ts tests/storageChoiceFlow.test.ts` | restricted | 0 | pass | `23 passed`, `0 failed` |
| `node --test tests/projectFilePolicy.test.cjs tests/sharedProjectLock.test.cjs` | restricted | 0 | pass | `17 passed`, `0 failed` |
| `npm run lint` | restricted | 0 | pass | `tsc --noEmit` under `book-editorial-tracker@0.1.7` |
| `git diff --check` | restricted | 0 | pass with warnings | CRLF working-copy warnings only; no diff content errors |
| `npm run build:public` | restricted | 1 | fail | Known Vite/esbuild config-load failure: `Cannot read directory "../../.." : Access is denied.` and `Could not resolve "...\\vite.config.ts"` |
| `npm run build:public` | elevated | 0 | pass | Vite `6.4.1`; built `dist/index.html`; duration `18.51s` |
| `npm run make:public` | restricted | 1 | fail | Known Forge packaging failure: `connect EACCES 4.237.22.38:443` |
| `npm run make:public` | elevated | 0 | pass | Created public `0.1.7` Squirrel artifacts under `out\\make` |
| `node --test tests/publicPackageArchive.test.mjs` | restricted | 0 | pass | `1 passed`, `0 failed` against the fresh packaged public archive |

### 0.1.7 public installer artifacts under `out\make`

| Artifact path | Exists | SHA-256 |
| --- | --- | --- |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\Book Editorial Tracker-0.1.7 Setup.exe` | yes | `DD0FA6B0D03C826941299E87E65B290029DC75853CD14E2250E1070218DBDEE8` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\book_editorial_tracker-0.1.7-full.nupkg` | yes | `F998A47A299F0F1FE3089F559DCE9B54491628A2731E7BC6C2C0428038BBE6EE` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\RELEASES` | yes | `726996F9D53D37FA7016C9BACD25886DF5922704F2D2AFEBEFB3454AE01AD456` |

### 0.1.7 package-archive counts

Scan target: `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\Book Editorial Tracker-win32-x64\resources\app.asar`

| Prohibited token class | Match count |
| --- | ---: |
| owner project id | 0 |
| owner API key | 0 |
| owner email | 0 |
| `firebase-applet-config.json` | 0 |

### 0.1.9 corrective beta packaging pass (first attempt — superseded)

Status date: 2026-08-19

This pass recorded a BLOCKED result due to a false-positive archive test. The stale hashes below are superseded by the final corrective pass immediately following.

### 0.1.9 first-attempt command outcomes

| Command | Environment | Exit code | Outcome | Notes |
| --- | --- | ---: | --- | --- |
| `cmd /c npm test` | restricted | 1 | fail | 1 test failed (publicPackageArchive.test.mjs) — false positive |
| `cmd /c npm run lint` | restricted | 0 | pass | `tsc --noEmit` under `book-editorial-tracker@0.1.9` |
| `cmd /c npm run build:public` | restricted | 0 | pass | Vite 6.4.1; built dist/index.html; no access-denied error |
| `cmd /c npm run make:public` | restricted | 0 | pass | Created public `0.1.9` Squirrel artifacts under `out\make`; no EACCES error |
| `node --test tests/publicPackageArchive.test.mjs` | restricted | 1 | fail | False positive — raw text scan hit source-code mention of filename in forge.config.js, not an actual archive entry |
| `git diff --check` | restricted | 0 | pass with warnings | CRLF working-copy warnings only; no diff content errors |

### 0.1.9 first-attempt artifacts (superseded — stale hashes, do not use for release)

| Artifact path | Exists | SHA-256 |
| --- | --- | --- |
| `out\make\squirrel.windows\x64\Book Editorial Tracker-0.1.9 Setup.exe` | yes | `DC506711D1C367FA352D3E6B56EEAEEBEB056142A14072DA3672AF4AD3397486` (superseded) |
| `out\make\squirrel.windows\x64\book_editorial_tracker-0.1.9-full.nupkg` | yes | `96D92E0F52F8A8E28F98815E93A64C85E8AA8C3A3BE31B62036E15AA3FDDC30B` (superseded) |
| `out\make\squirrel.windows\x64\RELEASES` | yes | `C65FD33959A974ABE09BF6A6F043155B812341B0B2D0EC4C81AA72C698178699` (superseded) |

### 0.1.9 first-attempt archive counts

| Prohibited token class | Match count |
| --- | ---: |
| owner project id | 0 |
| owner API key | 0 |
| owner email | 0 |
| `firebase-applet-config.json` raw text hits | 1 (false positive — source-code mention in forge.config.js, not a packaged archive entry) |

### 0.1.9 first-attempt gate status

- Status: BLOCKED (false positive — superseded by final corrective pass below)

## 0.1.9 final corrective pass (archive-test fix)

Status date: 2026-08-19

This pass corrects the false-positive archive test. `forge.config.js` now excludes itself and `firebase.json` from the packaged application. `tests/publicPackageArchive.test.mjs` now uses `@electron/asar` `listPackage()` to assert that no archive entry is named `firebase-applet-config.json`, preventing text mentions in build artefacts from producing false positives.

### 0.1.9 final command outcomes

| Command | Environment | Exit code | Outcome | Notes |
| --- | --- | ---: | --- | --- |
| `node --test tests/forgeConfig.test.mjs tests/publicPackageArchive.test.mjs tests/publicPackageBoundary.test.mjs` | restricted | 0 | pass | 10 passed, 0 failed |
| `cmd /c npm test` | restricted | 0 | pass | 179 passed, 0 failed |
| `cmd /c npm run lint` | restricted | 0 | pass | `tsc --noEmit` under `book-editorial-tracker@0.1.9` |
| `cmd /c npm run build:public` | restricted | 0 | pass | Vite 6.4.1; built dist/index.html; no access-denied error |
| `cmd /c npm run make:public` | restricted | 0 | pass | Created public `0.1.9` Squirrel artifacts under `out\make`; no EACCES error |
| `git diff --check` | restricted | 0 | pass with warnings | CRLF working-copy warnings only; no diff content errors |

### 0.1.9 final public installer artifacts under `out\make`

| Artifact path | Exists | SHA-256 |
| --- | --- | --- |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\Book Editorial Tracker-0.1.9 Setup.exe` | yes | `012257ED6BE62CC1C7A138EBB98EBE185DB36A35FEFF85A8FD3632A06BF8CAF1` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\book_editorial_tracker-0.1.9-full.nupkg` | yes | `F6D326D1FC1EDB6613C34B719E4D36EA1F615389F0A16F2B0DB98D2A18635742` |
| `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64\RELEASES` | yes | `697381A8F50928FC182E6B7969C5AADF44A4AB924DE435BEA384D833DF84E8D8` |

### 0.1.9 final package-archive counts

Scan target: `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\Book Editorial Tracker-win32-x64\resources\app.asar`

| Prohibited token class | Match count |
| --- | ---: |
| owner project id | 0 |
| owner API key | 0 |
| owner email | 0 |
| `firebase-applet-config.json` archive entries | 0 |
| `forge.config.js` archive entries | 0 |

### 0.1.9 final gate status

- Status: PASS
- All 179 tests pass. All owner-secret and archive-entry counts are zero.
- Installer is built and awaits a separate installation approval.
- No installation was performed in this pass.
