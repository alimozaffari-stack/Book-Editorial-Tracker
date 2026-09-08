# Changelog

## Unreleased

### Changed

- Prepared a portable-only Windows release package at `out\portable-exe\public-release-20260827-clean\Book Editorial Tracker-win32-x64` and documented that the public release path is currently portable, not installer-based.
- Documented the existing-project open fix and the persistent in-app credit `Built by Ali Mozaffari, 2026`.
- Documented the release boundary that excludes project files, lock files, logs, `user-data`, and token residue from any distributable package.

## 0.2.0 - 2026-08-24

### Changed

- Added `initial_chapter_submission` (Yes/No) and `initial_chapter_date` (YYYY-MM-DD) columns to the CSV chapter import template. Chapters with `initial_chapter_submission = Yes` now arrive at Initial Manuscript stage directly on import, and the abstract-submitted flag is implied automatically.
- Fixed the Bio column in the Chapters table so that `Bio: Yes` and `Bio: No` display as a single inline badge rather than appearing split across two visual columns.

## 0.1.9 - 2026-08-19

### Changed

- Fixed the local-backend storage lifecycle so local-file and shared-folder modes no longer clear the selected backend during storage-kind cleanup.

## 0.1.7 - 2026-08-17

### Changed

- Added local project-file, advisory shared-folder, and user-owned Firebase team storage modes for the public beta.
- Added scan-based chapter inventory creation with explicit review and confirmation before chapter creation.
- Added public-package Firebase-boundary protection so owner Firebase configuration is excluded from public artifacts.
- Fixed the local-mode startup correction so shared-lock release stays scoped to shared-folder mode.
- Added storage-choice back navigation from Firebase setup to the opening chooser.

## 0.1.6 - 2026-08-16

### Changed

- Added public-beta storage boundaries for Team Firebase, user-owned public Firebase, local project files, and advisory shared-folder projects.
- Added portable local project-file support with stale-write protection and atomic file replacement.
- Added advisory shared-folder locking with one-editor-at-a-time enforcement, ownership checks, and conflict-copy recovery instead of merge behavior.
- Added public build boundary checks so owner Firebase identifiers, API key material, owner email, and `firebase-applet-config.json` are excluded from public renderer artifacts.
- Added the public Firebase setup navigation correction so `Back to storage choices` returns to the opening chooser without deleting a saved Firebase profile or changing project data.
- Documented that source-document and source-folder selection is read-only and that the application never modifies those source materials.

### Known limitations

- Shared-folder mode is advisory and sequential only; it never merges concurrent edits.
- Public Firebase mode requires each user to create and operate their own Firebase project and deploy the supplied Firestore rules themselves.
- This small-team public beta does not make production availability or production support claims.

## 0.1.4 - 2026-08-13

### Changed

- Retired the legacy Google Drive JSON sync path in favour of reviewed local intake and backups.
- Replaced the working-folder audit/override subsystem with reviewed, source-read-only initial-project import.
- Added revision-safe stage history, small-team roles, Activity, safe chapter-list imports, and bounded DOCX inspection.

## 0.1.3 - 2026-08-11

### Changed

- Renamed the Windows application and installer to Book Editorial Tracker.
- Added Squirrel installer lifecycle handling that creates Start-menu and Desktop shortcuts on install/update, and removes them on uninstall.

## 0.1.2 - 2026-08-11

### Added

- Email/password sign-in, password-reset flow, and optional Google sign-in.
- Firestore-backed live collaboration with admin/editor user roles.
- Manual chapter entry, CSV import template, CSV chapter export, and accessible bulk deletion.
- Local JSON project backup including chapters, users, and audit events.
- Working-folder audit with manifest matching, CSV ledger, Markdown discrepancy report, and logged overrides.
- Event-based audit records for tracker changes.
- Private Windows installer with a branded app icon and title bar.

### Changed

- Kept the existing white, sans-serif dashboard and graph colours.
- External links now open in the default browser instead of a blank Electron child window.
- Google OAuth pop-ups are allowed only for the Firebase authentication handler.

### Known limitations

- The Google Drive JSON sync described in this historical release was removed after 0.1.3.
- JSON backup restore is not yet an in-app action; retain exports as controlled recovery material.
- The Windows installer is unsigned and may trigger SmartScreen.
