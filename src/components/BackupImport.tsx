  <div>
    <p>Backups cannot overwrite or be merged with live project data. Restoring one creates a new project and leaves the active project untouched.</p>
    <p>Restore writes only tracker metadata. Manuscript body text for imported chapters is not restored, so each body must be re-imported from the manuscript DOCX. Chapters without body text are marked as drafts rather than imported.</p>
    <p>Restored DOCX file paths remain read-only: they are never written to, never created, and cannot be replaced by another file while the project is active.</p>
    <p className="text-sm text-gray-600 mt-2">Importing creates a restored copy, then imports metadata, then links chapters to their original DOCX locations.</p>
  </div>