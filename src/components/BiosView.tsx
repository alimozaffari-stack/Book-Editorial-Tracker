import { useState } from 'react';
import { Chapter } from '../types';
import { Download } from 'lucide-react';
import { deriveChapterProgress } from '../domain/chapterProgress';

export function BiosView({ chapters }: { chapters: Chapter[] }) {
  const [message, setMessage] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [busy, setBusy] = useState(false);
  // Sort chapters by contributorName alphabetically
  const sortedChapters = [...chapters].sort((a, b) => 
    a.contributorName.localeCompare(b.contributorName)
  );

  const handleDownload = async () => {
    if (!window.editorialTracker) { setMessage('Biography export is available in the desktop app.'); return; }
    setBusy(true); setMessage('');
    let content = `<html><head><meta charset="utf-8"><title>Biographical Statements</title></head><body>`;
    content += `<h1>Biographical Statements</h1>`;
    
    sortedChapters.forEach(chapter => {
      if (chapter.bioText) {
        content += `<h2>${escapeHtml(chapter.contributorName)}</h2>`;
        content += `<p>${escapeHtml(chapter.bioText).replace(/\n/g, '<br/>')}</p>`;
        content += `<br/>`;
      }
    });
    
    content += `</body></html>`;
    
    try {
      const result = await window.editorialTracker.saveLocalExport('Biographical_Statements.doc', content);
      if (result.cancelled) { setMessage('Export cancelled.'); return; }
      setSavedPath(result.filePath ?? ''); setMessage(result.filePath ? `Saved to ${result.filePath}` : 'Biography export saved.');
    } catch { setMessage('Nothing was saved. Choose a destination and try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Biographical Statements</h1>
        <div className="flex items-center gap-3"><button
          onClick={handleDownload}
          disabled={busy}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          {busy ? 'Saving…' : 'Save Word document'}
        </button>{savedPath && <button onClick={() => window.editorialTracker?.openFolderForFile(savedPath)} className="text-sm font-medium text-indigo-700">Open folder</button>}</div>
      </div>
      {message && <p className="text-sm text-gray-700" role="status">{message}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 space-y-8">
        {sortedChapters.filter(c => c.bioText).length === 0 ? (
          <p className="text-gray-500 italic text-center py-8">No biographical statements have been added yet.</p>
        ) : (
          sortedChapters.map(chapter => chapter.bioText ? (
            <div key={chapter.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
              <h2 className="text-lg font-bold text-gray-900 mb-2">{chapter.contributorName}</h2>
              <p className="text-xs text-indigo-700 mb-2">{chapter.id} · Current stage: {deriveChapterProgress(chapter).currentStage.label}</p>
              <div className="text-gray-700 whitespace-pre-wrap">{chapter.bioText}</div>
            </div>
          ) : null)
        )}
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
