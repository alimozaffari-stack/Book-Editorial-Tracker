# Release verification

Build a fresh Windows candidate from this isolated recovery checkout. Do not reuse a historical installer as evidence for current source. Keep the source version at 0.2.0 until a release version is explicitly chosen. Publishing, pushing and signing are separate actions.

## Source checks

Run from this repository in a Windows terminal:

```
npm test
npm run lint
npm run build:public
git diff --check
```

The default test command includes every source test file. The archive test is a separate post-package gate because it requires the exact new artifact.

## Package checks

Run `npm run make:public:installer` to prepare the Windows installer, or `npm run package` with VITE_APP_VARIANT=public for a portable application directory. Use a fresh output directory. In PowerShell, set BET_PUBLIC_ASAR_PATH to the exact new resources/app.asar and run:

```
node --test tests/publicPackageArchive.test.mjs
```

Check the sibling app.asar.unpacked dependency tree as well. Verify JSZip loads at runtime; inspect the complete package for development attachments, project data, locks, logs, credentials and token files. Record the source commit, dirty diff/source hashes, commands, exit statuses, executable and archive hashes. Test archive integrity after compression.

## Runtime acceptance

Use synthetic data in an isolated application profile:

1. Launch the packaged executable and verify no startup exception.
2. Create a project, add/edit a chapter, save, close, reopen and verify the saved values.
3. Export JSON and CSV; restore JSON and verify project/chapter/stage data.
4. Append and void a stage record; verify revision and activity history after reopening.
5. Open the shared project in two instances; verify the second cannot edit, ownership loss blocks later saves, and reopening after lock release enables editing.
6. Simulate an external change and verify the original remains intact and Save As conflict copy preserves attempted changes.
7. Scan a source folder and verify its files remain byte-identical.

Passing source tests does not replace packaged runtime acceptance. Record any untested clean-machine, installer, signing or synchronized-folder behaviour explicitly. Release status remains HOLD until required acceptance is complete. Owner approval is required before external publication.
