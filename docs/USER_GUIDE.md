# Book Editorial Tracker User Guide

This guide explains the Windows desktop application as it is currently built. It is written for editors managing an edited volume or book with chapter records, contributor material, stage history, and source-document references.

The tracker stores editorial data. It does not copy, rename, edit, or delete your Word documents or project folders.

## Contents

1. [Before you begin](#before-you-begin)
2. [Choose storage and open a project](#choose-storage-and-open-a-project)
3. [Navigation and editing permission](#navigation-and-editing-permission)
4. [Project and Help](#project-and-help)
5. [Dashboard](#dashboard)
6. [Chapters](#chapters)
7. [Chapter detail and stage history](#chapter-detail-and-stage-history)
8. [Tasks](#tasks)
9. [Bios and Abstracts](#bios-and-abstracts)
10. [Activity](#activity)
11. [Backups and intake](#backups-and-intake)
12. [Shared-folder projects](#shared-folder-projects)
13. [Common workflows](#common-workflows)
14. [Safety, privacy, and limitations](#safety-privacy-and-limitations)

## Before you begin

### What the application manages

Book Editorial Tracker records:

- project identity and generation information;
- chapter IDs, titles, contributors, affiliations, email addresses, and editorial contacts;
- abstracts and biographical statements;
- manuscript and workflow fields;
- stage records, including dates, word counts, and safe source-file references;
- activity history; and
- exports, backups, and reviewed intake results.

It does **not** embed the Word documents that you inspect. If a source document is later moved, deleted, or unavailable on the current computer, its tracker record remains, but `Open document` cannot open it.

### The footer and application version

The persistent footer shows `Built by Ali Mozaffari, 2026`. The left sidebar also shows the application version.

### Editing versus reading

Most summary screens remain visible in read-only mode. Actions that change tracker data require editing permission. In a shared-folder project, the editor who owns the shared lock has editing permission; another open copy is read-only.

In particular, the import controls in **Backups & intake** are hidden in read-only shared mode. This prevents two editors from importing or changing the same tracker at once.

## Choose storage and open a project

The opening screen asks for an editor label. This label identifies changes in the project; it is not an account unless you use the separate Firebase team mode.

### Local project file

Use this for a single editor working with one portable project file.

1. Enter a local editor label.
2. To begin, enter a new project name and select **Create local file**.
3. Choose a save location when Windows asks.
4. To continue an existing tracker, enter the editor label and select **Open local file**.
5. Select the existing `.betp.json` project file.

Only one copy should edit a local project file at a time.

### Shared-folder project

Use this when the project file is in a folder synchronized or shared between editors, for example a shared drive. It is sequential editing, not live multi-user editing.

1. Enter a shared editor label.
2. Select **Open shared project file**.
3. Choose the shared `.betp.json` file.
4. If no other editor owns the lock, the project opens for editing.
5. If another editor owns it, the project opens read-only and identifies the lock owner.

The tracker creates a companion `.lock` file while an editor owns the project. Do not delete this file manually.

### Firebase team mode

The public beta can be configured against a Firebase project owned and operated by the user or team. It requires the team's own Firebase Authentication, Cloud Firestore, and Firebase configuration. The public portable release is not connected to the developer's private data.

## Navigation and editing permission

The left sidebar contains these areas:

- **Project & Help**
- **Dashboard**
- **Chapters**
- **Tasks**
- **Bios**
- **Abstracts**
- **Activity**
- **Backups & intake**

The sidebar also has **Sign Out**. The top status area reports the most recent data refresh. If a refresh fails, select **Try again** before assuming that data has been lost.

Some actions appear only when the current project is editable. A read-only shared project can be reviewed safely, but cannot be changed, imported into, or used to create new records.

## Project and Help

This page has project information, setup actions, safety guidance, and the controlled reset flow.

### Project identity

For an existing project, this section shows:

- project name;
- generation identifier; and
- project start time.

For shared projects, it also reports the current shared-folder lock state.

### Set up this tracker

For a blank project, enter a short project name and choose one of these paths:

- **Start blank** creates an empty tracker with the supplied project name.
- **Import CSV/JSON** opens **Backups & intake** and focuses the chapter-import path.
- **Restore JSON backup** opens **Backups & intake** and focuses the JSON import path.
- **Scan an existing folder** opens **Backups & intake** and focuses the source-folder scan path.

`Choose JSON backup` is a safe chapter-record import: it previews and creates new chapters only. It does not overwrite existing chapters or restore project identity, team membership, or activity history.

### Start a new project

This is intentionally a guarded action.

1. First create a JSON backup in **Backups & intake** during the current session.
2. Return to **Project & Help**.
3. Review the current project name, chapter count, and stage-record count.
4. Enter the new project name.
5. Type `RESET` exactly.
6. Confirm the action.

Starting a new project is not a remedy for a shared lock or an import problem. Use it only when intentionally beginning a fresh volume or project generation.

## Dashboard

The dashboard is the project overview. It derives its figures from the chapter records and active stage history.

### Summary cards

- **Total Chapters**: number of chapter records in the tracker.
- **Average Current Words**: average word count drawn from the current qualifying manuscript state.
- **Current Volume Words**: total current-volume word count across chapters.
- **Needs Attention**: count of workflow or imported-metadata checks requiring review.

### Project banner

When a project is open, the banner shows its name, generation identifier, and start date.

### Stage distribution

**Current Stage Distribution** shows one derived current stage for each chapter. It is a summary of the active stage history, not a second editable status field.

**Current Production Stages** shows the count and relative frequency of those derived stages.

### Workflow and data checks

The dashboard can surface checks that need attention. Use the provided chapter link to open the relevant chapter rather than editing from the dashboard. Some imported metadata checks can be reconciled only in editable mode.

## Chapters

The **Chapters** page is the main working table.

### Reading the table

Each row shows a chapter's:

- ID;
- title and contributor;
- derived current state;
- bio status;
- contact person;
- current word count;
- submission location; and
- feedback or revision link, where available.

Select a chapter row or its open/edit action to open the chapter detail panel. In read-only mode, the same action opens the record without edit controls.

### Filtering and sorting

Use the page controls to filter and sort the chapter list. The filters affect the visible list only; they do not alter tracker data.

### Add a chapter

When editing is available, use **Add chapter** to enter a chapter manually. Supply the required identifying and contributor information, then save. For many new records, prefer the reviewed CSV/JSON import flow described below.

### Bulk update

In editable mode, select one or more chapter checkboxes, choose a supported field and a value, then apply the batch update. Supported fields include feedback status, revision-submitted status, images submitted, indexing terms, and contact person.

Review the selected rows carefully: a bulk action changes every selected record.

### Delete chapters

Deletion is available only when editing is permitted. Treat deletion as a controlled editorial action. Create a JSON backup first if the records may be needed later.

### Compile manuscript

**Compile manuscript** creates an export from the latest active source document in the selected stages for each chapter.

1. Open **Chapters**.
2. Select **Compile manuscript**.
3. Choose one of the offered output formats.
4. Select the eligible source stages to include.
5. Optionally include chapter abstracts and chapter/source metadata.
6. Run the compile action.
7. Use **Show saved file** to open the output folder.

Only active, locally available source documents in the selected stages can contribute to the compiled file.

## Chapter detail and stage history

Opening a chapter displays its complete editable record when the project is writable. The panel groups information so that routine editorial work and historical evidence remain separate.

### Chapter metadata

Use the top fields for chapter identity and contributor information, including chapter ID, title, contributor name, email, affiliation, and editorial contact.

### Editorial and submission tracking

The detail panel includes the current editorial fields used by the table and task summaries, such as abstract status, manuscript submission, feedback, revisions, images, indexing terms, links, dates, and word counts. Choose the visible `Yes`, `No`, or `N/A` values where offered, and complete dates in the requested format.

### Abstract and bio text

Use the dedicated text areas to store the contributor's abstract and biographical statement. These are then shown in the **Abstracts** and **Bios** tabs and can be exported there.

### Save, close, and conflicts

Use **Save** to commit changes to the tracker. If the underlying record has changed since the panel was opened, the application protects the newer version instead of silently overwriting it. Reload or reopen the chapter, review the current data, and reapply the intended change.

### Stage history

Stage history is the audit trail for submitted source documents. Each record shows:

- stage;
- effective date;
- source-file information;
- word count; and
- active or voided status.

The current stage shown elsewhere in the app is derived from active records. Do not treat a historical stage row as a simple checkbox.

### Add a stage file

1. Open a chapter.
2. In **Stage history**, select **Add stage file**.
3. Choose one Word document.
4. Review the detected filename, calculated word count, file size, checksum, document metadata, and proposed values.
5. Choose the correct stage.
6. For revision or feedback stages, provide the requested round number. Feedback round `0` is permitted only where that stage explicitly allows it.
7. Confirm the effective date and word count.
8. Select **Add stage record**.

Inspection is review-first. Selecting a Word file does not modify it.

### Open document and show in folder

For a recorded local source document, **Open document** opens the file with the computer's associated application. **Show in folder** opens its containing folder. These actions do not alter the document.

### Void a stage record

Use **Void** when a historical stage was entered in error or must be superseded without erasing the audit trail.

1. Select the stage record's void action.
2. Enter a clear reason.
3. Confirm the void.

The record remains visible as voided, together with the reason. This preserves audit history and recalculates the derived current stage from the remaining active records.

## Tasks

The **Tasks** tab is a read-only work queue derived from chapter metadata and workflow status.

- **Overall Volume Tasks** summarizes missing work across the volume.
- **Per Chapter Tasks** lists outstanding items by chapter and contributor.

Use it to decide what to chase next; update the actual information in **Chapters** or its chapter detail panel.

## Bios and Abstracts

### Bios

The **Bios** tab lists available biographical statements by contributor and chapter. Select its export action to create an HTML export, then choose **Open folder** if you want to view the saved file in Windows.

### Abstracts

The **Abstracts** tab lists chapter abstracts, contributor information, and each chapter's derived current stage. Its export action creates an HTML export and can open the output folder.

These views report data already stored in chapter records. Edit the source data in the chapter detail panel.

## Activity

The **Activity** tab provides an audit-oriented timeline of tracker changes, newest first.

### Filters

Use the three filters to narrow the visible events:

- **Person**: editor or actor;
- **Chapter**: chapter ID; and
- **Action**: a word or phrase from the recorded action.

The filters do not change the stored activity history.

### Export activity CSV

Select **Export activity CSV** to save the currently relevant activity report, then use **Open folder** to locate it. Use **Show all activity** to switch between the usual display and the complete activity list.

## Backups and intake

This tab has three distinct jobs: backup/export, chapter-list import, and review-first project-folder intake.

### Back up

- **Save JSON backup** saves tracker data as a JSON backup. Use this before major changes or before starting a new project.
- **Export CSV** saves the chapter table as a CSV report/export.
- **Open folder** appears after a save and opens the location of the exported file.

Backups contain tracker data, not copies of Word documents or source folders.

### Import chapters from CSV or JSON

These controls appear only in editable mode.

1. Use **Download chapter-list template** if preparing a new CSV from scratch.
2. Fill the template with the intended chapter records.
3. Select **Choose CSV**, or select **Choose JSON backup** for a JSON-based chapter import.
4. Review the **Review import** dialog.
5. Check which IDs are new, unchanged, invalid, or unavailable for creation.
6. Select **Add N new chapters** only after reviewing the preview.

This flow creates new chapter records only. Existing chapter IDs are not overwritten or updated. It does not restore project identity, team membership, or activity history.

### Import an existing project folder

This is the workflow shown in the screenshot accompanying this guide.

1. Select **Choose project folder**.
2. Choose one project root folder.
3. The initial scan reads filenames, relative locations, sizes, and dates only. It does not open document contents or alter the folder.
4. Review each proposed entry in the scan table.
5. Select only the files that should be considered.
6. For each selected item, confirm or change the chapter ID, proposed stage, round where relevant, effective date, and word count.
7. Review the outcome label:
   - **Ready**: suitable for explicit Word-document inspection.
   - **Needs review**: classification or required information needs attention before use.
   - **Unsupported**: not suitable for the bounded Word-document inspection flow.
8. Use **Save scan CSV** or **Save scan Markdown** to retain the reviewed scan report if needed.
9. Select **Inspect N selected Word files**. This performs bounded inspection of only the checked Word documents.
10. Review the inspected stage records and the affected-chapter summary.
11. Select **Add N stage records** only when the selections and proposed values are correct.

The intake flow never silently writes to the source folder, renames a source file, or overwrites an existing chapter.

### Create a chapter inventory from a scan

When a scan identifies likely new chapters, use **Create chapter inventory from scan**.

1. Open the review screen.
2. Check the rows to create.
3. Correct chapter ID, title, and contributor name where necessary.
4. Select **Create selected chapters**.

This creates reviewed chapter records only. It does not create stage records or alter source documents.

## Shared-folder projects

Shared-folder mode is intentionally conservative.

### Normal editing

One editor opens the project and acquires the lock. That editor can save and use imports. Other editors can review the project but cannot make changes.

### Read-only message

When the screen identifies a current shared lock owner, another editor is considered active. Do not attempt imports, edits, or reset actions in that copy.

### Force unlock

Use **Force unlock shared project** only when you have confirmed that the named editor's application is closed or abandoned.

1. Confirm with the editor or check that their application is no longer running.
2. Type `FORCE UNLOCK` exactly.
3. Select **Force unlock shared project**.
4. The repaired current build reacquires the lock for the current application and reports `Shared project unlocked and opened for editing.`

Do not use force unlock merely because you want to edit sooner. It is not a merge tool and cannot make two simultaneous edits safe.

### If a save is blocked

The application prevents a later conflicting save from overwriting a changed shared project. Preserve your intended work, reopen the shared project, review the current data, and use the appropriate conflict-copy or re-entry path. Shared-folder mode never auto-merges independently edited copies.

## Common workflows

### Start a new edited volume

1. Create a local project file.
2. Name the project.
3. In **Backups & intake**, download the CSV template.
4. Prepare the initial chapter list.
5. Import the CSV and review the preview.
6. Open **Chapters** to complete or correct records.
7. Use **Dashboard** and **Tasks** to manage work.

### Add an incoming revision

1. Open **Chapters**.
2. Open the relevant chapter.
3. Use **Add stage file** in its stage history.
4. Select the Word document and review metadata.
5. Choose `Revision`, enter the round, date, and word count.
6. Add the stage record.
7. Confirm the new state on the chapter and dashboard.

### Import a legacy project folder safely

1. Back up the tracker first.
2. Go to **Backups & intake**.
3. Choose the project folder.
4. Review metadata-only scan results.
5. Inspect only the Word files you deliberately selected.
6. Review proposed stage records.
7. Add only the records you approve.

### Hand the project to another editor

1. Finish and save your changes.
2. Close the application so the shared lock is released.
3. Tell the next editor that the project is available.
4. The next editor opens the same shared project file and acquires the lock.

## Safety, privacy, and limitations

- Keep `.betp.json` project files and their `.lock` files out of public Git repositories and release downloads.
- Do not distribute `user-data`, logs, token caches, or local preferences.
- Do not upload unredacted screenshots containing contributor names, email addresses, folder paths, document names, or project data.
- The tracker is a Windows/Electron public beta. Windows SmartScreen may warn about an unsigned portable application.
- Local and shared-folder projects are one-editor-at-a-time workflows.
- Shared-folder mode is advisory and sequential; it does not provide live collaboration or automatic conflict merging.
- Source scanning and document inspection are designed to be review-first and source-read-only.
- A backup preserves tracker data, not source-document availability on another computer.

## Screenshot placeholders for a public GitHub guide

Add only redacted screenshots to this guide:

1. Dashboard with the application credit visible.
2. Chapters table with non-sensitive sample data.
3. Chapter detail with a safe sample stage-history record.
4. Backups & intake showing the three import areas.
5. Existing-project folder scan with names, paths, and document titles redacted.
6. Shared-project read-only notice using fictional editor names.
