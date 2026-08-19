# Releasing Book Editorial Tracker Public Beta

This checklist is for local release preparation only. Do not push, publish, deploy Firestore rules, or package an installer until the owner explicitly approves those steps.

## Verification checklist

1. Run the full local verification set from the repository root:
   - `cmd /c npm test`
   - `cmd /c npm run lint`
   - `cmd /c npm run build:public`
   - `node --test tests/publicPackageArchive.test.mjs`
   - `git diff --check`
2. If `cmd /c npm run build:public` fails only with the known local Vite/esbuild access-denied environment issue, rerun the identical command elevated and record both outcomes.
3. Confirm the public build artifacts are current before any packaging decision.
4. After separate approval for packaging, run `cmd /c npm run make:public`.
5. Inspect the packaged `app.asar` and confirm zero matches for:
   - owner Firebase project ID
   - owner Firebase API key
   - owner email
   - `firebase-applet-config.json`
6. Record checksums for the verified Setup executable and any release files that will be published.

## Manual smoke test before publishing

1. Create a local project file and confirm create, save, close, reopen, and save again all work.
2. Open a shared-folder project and confirm the open/save path works for one editor at a time.
3. Confirm conflicting shared-folder saves are blocked rather than merged.
4. Confirm source scanning remains read-only and does not modify the selected source folder or documents.

## Publication boundary

1. The owner must manually create the GitHub release.
2. Upload only the verified public `Setup.exe` and its checksum.
3. Do not upload owner-only Firebase configuration.
4. Do not claim production readiness; keep the release labeled as a Windows public beta.
