# 2026-08-16 Public Beta Discrepancy Report

## Summary

Automated verification succeeded overall, but the run is not packaging-ready without explicit owner approval and a separate genuine manual smoke pass.

## Confirmed discrepancies and limitations

1. Restricted-environment build failure
   - Both `cmd /c npm run build:team` and `cmd /c npm run build:public` failed in the restricted shell with the same Vite/esbuild filesystem error:
   - `Cannot read directory "../../.." : Access is denied.`
   - `Could not resolve "C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\vite.config.ts"`
   - Per Stage 8 instructions, the identical commands were rerun through approved elevated execution and both then passed.

2. Manual smoke checks still pending
   - The Stage 8 plan requires genuine manual smoke checks on synthetic local data only.
   - No manual smoke pass is claimed in this run.

3. Restricted-shell packaging failure
   - `cmd /c npm run make:public` failed in the restricted shell with `connect EACCES 4.237.22.38:443`.
   - The identical elevated command then succeeded and produced the public Squirrel artifacts under `out\make`.

4. Public-release gates not yet passed
   - External approval gate B is now pending.
   - The built public installer must not be installed on this computer unless the owner explicitly approves that next gate.

5. Earlier installer evidence is superseded
   - The previously built public installer and its hashes predate the final hostile-review fixes.
   - This correction pass refreshed only the unpackaged public `app.asar` boundary for verification.
   - No new installer was built, hashed, installed, or approved in this correction pass.

## Non-discrepancy observations

- `npm test` passed after adding the missing Stage 5 through Stage 7 focused suites to the aggregate test script.
- `npm run lint` passed.
- The fresh public `dist` scan returned zero matches for:
  - owner project id
  - owner API key
  - owner email
  - `firebase-applet-config.json`
- The recursive packaged-output scan under `out` returned zero matches for `firebase-applet-config.json`.
- `git diff --check` reported CRLF working-copy warnings only and no content errors.

## Stage 5 correction status

The correction pass that followed the final hostile review produced these current results:

- Focused correction tests passed:
  - `tests/projectFileFormat.test.ts`
  - `tests/backendContract.test.ts`
  - `tests/rendererStartup.test.ts`
  - `tests/forgeConfig.test.mjs`
  - `tests/publicPackageBoundary.test.mjs`
  - `tests/publicPackageArchive.test.mjs`
- `cmd /c npm run lint` passed.
- `cmd /c npm run build:team` and `cmd /c npm run build:public` still fail in the restricted shell with the known Vite/esbuild access-denied resolver issue and pass when rerun elevated with the identical command text.
- A refreshed public `out\Book Editorial Tracker-win32-x64\resources\app.asar` now returns zero matches for:
  - owner project id
  - owner API key
  - owner email
  - `firebase-applet-config.json`
- Manual smoke remains pending.
- The earlier public installer should be treated as non-compliant/superseded release evidence until a later approved installer rebuild is performed.

## Corrected public installer status

The corrected public installer build is now complete:

- `cmd /c npm run make:public` failed in the restricted shell with the known `connect EACCES 4.237.22.38:443` error.
- The identical elevated command then succeeded and wrote corrected artifacts under:
  - `C:\Users\ali_m\Documents\ChatGPT\Book-Editorial-Tracker\out\make\squirrel.windows\x64`
- The refreshed package-archive test `tests/publicPackageArchive.test.mjs` passed.
- The refreshed packaged public archive now returns zero matches for:
  - owner project id
  - owner API key
  - owner email
  - `firebase-applet-config.json`
- The corrected artifact hashes are:
  - `Book Editorial Tracker-0.1.5 Setup.exe`: `9CC8BDF97C1C4D1F0A3A2A32D228098245268EB8382DAE52E2CF2EED5DE857E6`
  - `book_editorial_tracker-0.1.5-full.nupkg`: `43852E91C2424DCCE5EEF611F681E8EC7C26A87B485E1703225412FABCE1F0E3`
  - `RELEASES`: `00C6A7E9EC1ED187A2541850B3041165290916F4662B6944676350317B001EC5`

Current gate state:

- The corrected public installer is eligible for a separate installation approval.
- No installation was performed in this pass.

## 0.1.6 corrective beta note

The next public beta packaging pass is version `0.1.6`. Its intended corrective scope is narrow:

- add the visible `Back to storage choices` button in public Firebase setup;
- return to the opening `Choose storage` screen without deleting a saved Firebase profile or changing project data; and
- retain the helper text `Used only to identify changes in this project; it does not create an account.` under both local and shared editor-label inputs.

Fresh `0.1.6` command outcomes, artifact hashes, and package-archive boundary results are appended after the new build/package run.

### 0.1.6 corrective beta current status

- The narrow correction is present in source and verified by focused test coverage:
  - `Back to storage choices` is rendered in public Firebase setup.
  - it returns to `Choose storage` by clearing only transient setup-navigation state.
  - both local/shared editor-label helper texts render as specified.
- `cmd /c npm run build:public` still fails in the restricted shell with the known Vite/esbuild access-denied resolver issue and passes when rerun elevated with the identical command text.
- `cmd /c npm run make:public` still fails in the restricted shell with the known `connect EACCES 4.237.22.38:443` failure and passes when rerun elevated with the identical command text.
- The fresh packaged public archive passes `tests/publicPackageArchive.test.mjs`.
- The fresh packaged public archive returns zero matches for:
  - owner project id
  - owner API key
  - owner email
  - `firebase-applet-config.json`
- The `0.1.6` artifact hashes are:
  - `Book Editorial Tracker-0.1.6 Setup.exe`: `3F6B990E899187DD2FF1E9C63A44E22BDD0EB98FF5312DB01ABD17547C1C01C9`
  - `book_editorial_tracker-0.1.6-full.nupkg`: `3429D9B2F1EE821A19A185575833190D3B1F5A91BBE69D4ED2EBD8ECFCBF4F35`
  - `RELEASES`: `EB8ACADC7EA7F45C23E8DEDC5008F9722117A9214D04800C63681BDF5B8BAD78`

Current gate state:

- The `0.1.6` corrective public beta is eligible for a separate installation approval.
- No installation was performed in this pass.

## 0.1.7 corrective beta current status

- The targeted fix is verified in source:
  - `src/App.tsx` guards `releaseSharedProjectLock()` with shared-folder mode only.
  - `src/storage/sharedProjectLockState.ts` clears shared lock token/state for local mode.
- Focused verification passed:
  - `tests/storageChoiceFlow.test.ts`
  - `tests/projectFileFormat.test.ts`
  - `tests/backendContract.test.ts`
  - `tests/projectFilePolicy.test.cjs`
  - `tests/sharedProjectLock.test.cjs`
- `npm run build:public` still fails in the restricted shell with the known Vite/esbuild access-denied resolver issue and passes when rerun elevated with the identical command text.
- `npm run make:public` still fails in the restricted shell with the known `connect EACCES 4.237.22.38:443` failure and passes when rerun elevated with the identical command text.
- The fresh packaged public archive passes `tests/publicPackageArchive.test.mjs`.
- The fresh packaged public archive returns zero matches for:
  - owner project id
  - owner API key
  - owner email
  - `firebase-applet-config.json`
- The `0.1.7` artifact hashes are:
  - `Book Editorial Tracker-0.1.7 Setup.exe`: `DD0FA6B0D03C826941299E87E65B290029DC75853CD14E2250E1070218DBDEE8`
  - `book_editorial_tracker-0.1.7-full.nupkg`: `F998A47A299F0F1FE3089F559DCE9B54491628A2731E7BC6C2C0428038BBE6EE`
  - `RELEASES`: `726996F9D53D37FA7016C9BACD25886DF5922704F2D2AFEBEFB3454AE01AD456`

Current gate state:

- The `0.1.7` corrective public beta is packaged and ready for a separate installation approval.
- No installation was performed in this pass.
## 0.1.9 corrective beta — initial attempt (superseded)

The first 0.1.9 packaging pass was recorded as BLOCKED due to a false-positive archive test. `tests/publicPackageArchive.test.mjs` used a raw text scan that matched the string `firebase-applet-config.json` appearing as a source-code literal inside the packaged `forge.config.js`, not as an actual archive entry. The stale artifact hashes from that pass are recorded in the ledger and superseded.

## 0.1.9 corrective beta final status

Date: 2026-08-19

- Root cause of prior false positive confirmed: raw text scan hit source-code mention of the filename in packaged `forge.config.js`, not an actual archive entry.
- Fixes applied (no application-behaviour change):
  - `forge.config.js` now excludes itself and `firebase.json` from the packaged application.
  - `tests/publicPackageArchive.test.mjs` now uses `@electron/asar` `listPackage()` to assert that no archive entry is named `firebase-applet-config.json`.
- Verification commands re-run and all passed:
  - `node --test tests/forgeConfig.test.mjs tests/publicPackageArchive.test.mjs tests/publicPackageBoundary.test.mjs`: 10 passed, 0 failed
  - `cmd /c npm test`: 179 passed, 0 failed
  - `cmd /c npm run lint`: passed (`tsc --noEmit`)
  - `git diff --check`: passed (CRLF working-copy warnings only; no diff content errors)
- The fresh packaged public archive returns zero matches for:
  - owner project id
  - owner API key
  - owner email
- The fresh packaged public archive contains zero archive entries for:
  - `firebase-applet-config.json` (0 entries, verified via `listPackage()`)
  - `forge.config.js` (0 entries, build-only file now excluded)
- Verified final artifact hashes:
  - `Book Editorial Tracker-0.1.9 Setup.exe`: `012257ED6BE62CC1C7A138EBB98EBE185DB36A35FEFF85A8FD3632A06BF8CAF1`
  - `book_editorial_tracker-0.1.9-full.nupkg`: `F6D326D1FC1EDB6613C34B719E4D36EA1F615389F0A16F2B0DB98D2A18635742`
  - `RELEASES`: `697381A8F50928FC182E6B7969C5AADF44A4AB924DE435BEA384D833DF84E8D8`

Current gate state:

- The `0.1.9` corrective public beta is packaged and ready for a separate installation approval.
- No installation was performed in this pass.
