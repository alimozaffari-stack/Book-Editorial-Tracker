const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { startLocalAppServer } = require('./local-server.cjs');
const { isPathInsideResolvedRoot } = require('./project-path-policy.cjs');
const {
  resolveStageSourceFile,
  validateStageSourceRequest,
} = require('./stage-source-policy.cjs');
const { createProjectFilePolicy } = require('./project-file-policy.cjs');
const { createSharedProjectLockPolicy } = require('./shared-project-lock.cjs');
const {
  buildDocx,
  buildSourceArchive,
  extractDocxText,
  markdownForSections,
} = require('./manuscript-compiler.cjs');

function firebaseProfilePath() {
  return path.join(app.getPath('userData'), 'firebase-profile.json');
}

function packagedFirebaseProfilePath() {
  const profileFileName = ['firebase', 'applet', 'config.json'].join('-');
  return path.join(__dirname, '..', profileFileName);
}

function isSafeText(value, maxLength = 256) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && !/[\\u0000-\\u001F\\u007F]/.test(value);
}

function normalizeHttpsAuthDomain(value) {
  if (!isSafeText(value, 256)) return null;
  const trimmed = value.trim();
  const candidate = trimmed.startsWith('https://')
    ? trimmed
    : trimmed.startsWith('http://')
      ? `https://${trimmed.slice('http://'.length)}`
      : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || !parsed.hostname || parsed.hostname.includes(':')) return null;
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

function looksLikeHttpsAuthDomain(value) {
  return Boolean(normalizeHttpsAuthDomain(value));
}

function parseFirebaseProfileCandidate(rawProfile) {
  if (!rawProfile || typeof rawProfile !== 'object' || Array.isArray(rawProfile)) return null;
  const profile = rawProfile;
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  for (const key of required) {
    if (!(key in profile) || !isSafeText(profile[key])) return null;
  }
  const normalizedAuthDomain = normalizeHttpsAuthDomain(profile.authDomain);
  if (!normalizedAuthDomain) return null;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(profile.projectId)) return null;
  if (!/^1:[0-9]+:(web|android|ios):[A-Za-z0-9]+$/i.test(profile.appId)) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(profile.apiKey) || profile.apiKey.length > 256) return null;
  if (profile.firestoreDatabaseId !== undefined && !/^[A-Za-z0-9-]{6,128}$/.test(profile.firestoreDatabaseId)) return null;
  const keys = Object.keys(profile);
  if (!keys.every((key) => ['apiKey', 'authDomain', 'projectId', 'appId', 'firestoreDatabaseId'].includes(key))) return null;

  return {
    apiKey: profile.apiKey.trim(),
    authDomain: normalizedAuthDomain,
    projectId: profile.projectId.trim(),
    appId: profile.appId.trim(),
    ...(profile.firestoreDatabaseId ? { firestoreDatabaseId: String(profile.firestoreDatabaseId).trim() } : {}),
  };
}

function readFirebaseProfile() {
  try {
    const filePath = firebaseProfilePath();
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parseFirebaseProfileCandidate(parsed);
  } catch {
    return null;
  }
}

function readPackagedTeamFirebaseProfile() {
  try {
    const filePath = packagedFirebaseProfilePath();
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parseFirebaseProfileCandidate(parsed);
  } catch {
    return null;
  }
}


ipcMain.handle('load-firebase-profile', async () => {
  return { ok: true, profile: readFirebaseProfile() };
});

ipcMain.handle('save-firebase-profile', async (_event, profile) => {
  const parsed = parseFirebaseProfileCandidate(profile);
  if (!parsed) {
    return { ok: false, message: 'Invalid Firebase profile.' };
  }
  const filePath = firebaseProfilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(parsed), 'utf8');
  return { ok: true, profile: parsed };
});

ipcMain.handle('clear-firebase-profile', async () => {
  try {
    fs.unlinkSync(firebaseProfilePath());
  } catch (error) {
    if (error?.code !== 'ENOENT') return { ok: false, message: 'Could not clear Firebase profile.' };
  }
  return { ok: true };
});

function projectFilePolicy() {
  return createProjectFilePolicy({
    userDataPath: app.getPath('userData'),
    dialog,
  });
}

function sharedProjectLockPolicy() {
  const filePolicy = projectFilePolicy();
  return createSharedProjectLockPolicy({
    resolveFilePath: (fileToken) => filePolicy.resolveSharedTokenPath(fileToken),
  });
}

ipcMain.handle('choose-project-file', async () => projectFilePolicy().chooseProjectFile());
ipcMain.handle('choose-shared-project-file', async () => projectFilePolicy().chooseSharedProjectFile());
ipcMain.handle('save-project-file', async (_event, payload) => projectFilePolicy().saveProjectFile(payload?.fileToken, payload?.expectedHash, payload?.contents));
ipcMain.handle('save-project-file-as', async (_event, contents) => projectFilePolicy().saveProjectFileAs(contents));
ipcMain.handle('save-shared-project-file-as', async (_event, contents) => projectFilePolicy().saveSharedProjectFileAs(contents));
ipcMain.handle('acquire-shared-project-lock', async (_event, fileToken, editorLabel, instanceId) => sharedProjectLockPolicy().acquireSharedProjectLock(fileToken, editorLabel, instanceId));
ipcMain.handle('heartbeat-shared-project-lock', async (_event, fileToken, instanceId) => sharedProjectLockPolicy().heartbeatSharedProjectLock(fileToken, instanceId));
ipcMain.handle('verify-shared-project-lock', async (_event, fileToken, instanceId) => sharedProjectLockPolicy().verifySharedProjectLock(fileToken, instanceId));
ipcMain.handle('release-shared-project-lock', async (_event, fileToken, instanceId) => sharedProjectLockPolicy().releaseSharedProjectLock(fileToken, instanceId));
ipcMain.handle('read-shared-project-lock', async (_event, fileToken) => sharedProjectLockPolicy().readSharedProjectLock(fileToken));
ipcMain.handle('force-unlock-shared-project-lock', async (_event, fileToken, instanceId, confirmationText) => sharedProjectLockPolicy().forceUnlockSharedProjectLock(fileToken, instanceId, confirmationText));
ipcMain.handle('save-shared-project-file', async (_event, payload) => sharedProjectLockPolicy().saveSharedProjectFile(
  payload?.fileToken,
  payload?.instanceId,
  payload?.expectedHash,
  payload?.expectedProjectRevision,
  payload?.contents,
));

const productName = 'Book Editorial Tracker';
app.setName(productName);
let localAppServer;

ipcMain.handle('save-local-export', async (_event, payload) => {
  const filename = typeof payload?.filename === 'string' ? payload.filename : '';
  const contents = typeof payload?.contents === 'string' ? payload.contents : '';
  if (!/^[a-z0-9][a-z0-9._-]*\.(json|csv|md|doc)$/i.test(filename)) {
    throw new Error('Invalid export filename.');
  }
  if (Buffer.byteLength(contents, 'utf8') > 25 * 1024 * 1024) {
    throw new Error('The local export is too large to save.');
  }
  const result = await dialog.showSaveDialog({
    title: 'Save Book Editorial Tracker backup',
    defaultPath: path.join(app.getPath('documents'), filename),
    filters: filename.endsWith('.json')
      ? [{ name: 'JSON backup', extensions: ['json'] }]
      : filename.endsWith('.md')
        ? [{ name: 'Markdown report', extensions: ['md'] }]
        : filename.endsWith('.doc')
          ? [{ name: 'Word-compatible document', extensions: ['doc'] }]
          : [{ name: 'CSV spreadsheet', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePath) return { cancelled: true };
  if (selectedProjectRoot && isPathInsideResolvedRoot(selectedProjectRoot, result.filePath)) throw new Error('Choose a Save As destination outside the selected project folder.');
  fs.writeFileSync(result.filePath, contents, 'utf8');
  log(`local_export_saved file=${result.filePath} bytes=${Buffer.byteLength(contents, 'utf8')}`);
  return { cancelled: false, filePath: result.filePath };
});

ipcMain.handle('open-folder-for-file', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('Invalid local file path.');
  }
  try {
    shell.showItemInFolder(filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not open folder.' };
  }
});

ipcMain.handle('select-docx', async () => {
  const result = await dialog.showOpenDialog({ title: 'Choose Word document', properties: ['openFile'], filters: [{ name: 'Word documents', extensions: ['docx'] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  const selectedPath = result.filePaths[0];
  if (path.extname(selectedPath).toLowerCase() !== '.docx') throw new Error('Choose a .docx Word document.');
  const stat = fs.statSync(selectedPath);
  const maxSize = 25 * 1024 * 1024;
  if (stat.size > maxSize) throw new Error('The selected Word document is larger than 25 MiB.');
  const bytes = fs.readFileSync(selectedPath);
  const sha256 = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  rememberStageDocument(sha256, selectedPath);
  return { fileName: path.basename(selectedPath), sizeBytes: stat.size, sha256, filesystemCreatedAt: stat.birthtime?.toISOString(), filesystemModifiedAt: stat.mtime.toISOString(), bytes: new Uint8Array(bytes) };
});

let selectedProjectRoot;

// Stage document index functionality
function stageDocumentIndexPath() {
  return path.join(app.getPath('userData'), 'stage-document-index.json');
}

function loadStageDocumentIndex() {
  try {
    const indexPath = stageDocumentIndexPath();
    if (!fs.existsSync(indexPath)) {
      return { version: 1, entries: {} };
    }
    const content = fs.readFileSync(indexPath, 'utf8');
    const index = JSON.parse(content);
    if (index.version !== 1 || !index.entries) {
      return { version: 1, entries: {} };
    }
    return index;
  } catch (error) {
    return { version: 1, entries: {} };
  }
}

function saveStageDocumentIndex(index) {
  const entries = Object.keys(index.entries);
  if (entries.length > 500) {
    for (const key of entries.slice(0, entries.length - 500)) {
      delete index.entries[key];
    }
  }
  const indexPath = stageDocumentIndexPath();
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(index), 'utf8');
}

function rememberStageDocument(sha256, filePath) {
  const index = loadStageDocumentIndex();
  index.entries[sha256] = fs.realpathSync(filePath);
  saveStageDocumentIndex(index);
}

function projectPreferencesPath() { return path.join(app.getPath('userData'), 'project-folder-preferences.json'); }
function rememberProjectRoot(root) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(projectPreferencesPath(), JSON.stringify({ selectedProjectRoot: root }), 'utf8');
}
function restoreProjectRoot() {
  try {
    const parsed = JSON.parse(fs.readFileSync(projectPreferencesPath(), 'utf8'));
    if (typeof parsed.selectedProjectRoot === 'string' && path.isAbsolute(parsed.selectedProjectRoot) && fs.lstatSync(parsed.selectedProjectRoot).isDirectory()) selectedProjectRoot = parsed.selectedProjectRoot;
  } catch { selectedProjectRoot = undefined; }
}

function scanSelectedProjectRoot() {
  if (!selectedProjectRoot) return null;
  const root = selectedProjectRoot;
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Choose a regular project folder, not a link or junction.');
  const ignored = new Set(['node_modules', '.git', 'reports', 'audit-reports', 'scan-reports', 'verification', 'dist', 'out', 'book editorial tracker', 'editorial review tracker', 'book-editorial-tracker', 'editorial-review-tracker']);
  const safeDirectories = folder => fs.readdirSync(folder, { withFileTypes: true }).filter(entry => {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('.') || ignored.has(entry.name.toLowerCase())) return false;
    try { return fs.lstatSync(path.join(folder, entry.name)).isDirectory() && !fs.lstatSync(path.join(folder, entry.name)).isSymbolicLink(); } catch { return false; }
  });
  const chapterFolders = safeDirectories(root).map(chapter => ({
    name: chapter.name,
    stageFolders: safeDirectories(path.join(root, chapter.name)).map(stage => {
      const stagePath = path.join(root, chapter.name, stage.name);
      const files = fs.readdirSync(stagePath, { withFileTypes: true }).flatMap(entry => {
        if (!entry.isFile() || entry.isSymbolicLink() || entry.name.startsWith('.') || ['desktop.ini', 'thumbs.db'].includes(entry.name.toLowerCase())) return [];
        const full = path.join(stagePath, entry.name); const stat = fs.lstatSync(full);
        if (!stat.isFile() || stat.isSymbolicLink()) return [];
        return [{ relativePath: `${chapter.name}/${stage.name}/${entry.name}`, extension: path.extname(entry.name).toLowerCase(), sizeBytes: stat.size, filesystemModifiedAt: stat.mtime.toISOString() }];
      });
      return { name: stage.name, files };
    }),
  }));
  const parts = root.split(path.sep).filter(Boolean); const displayLabel = parts.slice(-2).join(' / ') || path.basename(root);
  return { displayLabel, chapterFolders };
}

ipcMain.handle('scan-project-folder', async () => {
  const result = await dialog.showOpenDialog({ title: 'Choose project folder', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  selectedProjectRoot = result.filePaths[0];
  const scan = scanSelectedProjectRoot();
  rememberProjectRoot(selectedProjectRoot);
  return scan;
});

ipcMain.handle('resume-project-folder', async () => { restoreProjectRoot(); return scanSelectedProjectRoot(); });

ipcMain.handle('inspect-project-docx', async (_event, relativePath) => {
  if (!selectedProjectRoot || typeof relativePath !== 'string') throw new Error('Choose the project folder again.');
  const resolved = path.resolve(selectedProjectRoot, relativePath);
  const relative = path.relative(selectedProjectRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.extname(resolved).toLowerCase() !== '.docx') throw new Error('Invalid project-relative Word document.');
  const realRoot = fs.realpathSync(selectedProjectRoot); const realFile = fs.realpathSync(resolved); const realRelative = path.relative(realRoot, realFile);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error('The selected Word document resolves outside the project folder.');
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 25 * 1024 * 1024) throw new Error('The selected Word document is unavailable or larger than 25 MiB.');
  const bytes = fs.readFileSync(resolved);
  const sha256 = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  rememberStageDocument(sha256, realFile);
  return { fileName: path.basename(resolved), sizeBytes: stat.size, sha256, filesystemCreatedAt: stat.birthtime?.toISOString(), filesystemModifiedAt: stat.mtime.toISOString(), bytes: new Uint8Array(bytes) };
});

ipcMain.handle('forget-project-folder', async () => {
  selectedProjectRoot = undefined;
  try { fs.unlinkSync(projectPreferencesPath()); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
});

ipcMain.handle('open-stage-source', async (_event, request) => {
  try {
    const validation = validateStageSourceRequest(request);
    if (!validation.ok) return validation;
    const indexPath = stageDocumentIndexPath();
    const result = await resolveStageSourceFile({
      sourceRelativePath: request.sourceRelativePath,
      sourceSha256: request.sourceSha256,
      selectedProjectRoot,
      indexPath,
    });
    if (result.ok) {
      if (request.action === 'open') {
        const error = await shell.openPath(result.filePath);
        if (error) return { ok: false, message: 'The document could not be opened. Check that it is available on this computer.' };
        return { ok: true, message: 'Document opened successfully' };
      }
      shell.showItemInFolder(result.filePath);
      return { ok: true, message: 'Document revealed in folder' };
    }
    return {
      ok: false,
      message: result.message
    };
  } catch (error) {
    return {
      ok: false,
      message: 'An unexpected error occurred while opening the document'
    };
  }
});

const compilerFormats = {
  md: { extension: 'md', name: 'Markdown document' },
  docx: { extension: 'docx', name: 'Word document' },
  zip: { extension: 'zip', name: 'ZIP archive' },
};
const compilerStages = new Set(['abstract', 'initial-manuscript', 'feedback-sent', 'revision', 'final-manuscript', 'publisher-submission', 'typeset-submission']);

function compilerText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function compilerFileName(projectName, extension) {
  const stem = compilerText(projectName, 100).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'compiled-manuscript';
  return `${stem}.${extension}`;
}

ipcMain.handle('compile-manuscript', async (_event, request) => {
  try {
    const format = compilerFormats[request?.format];
    if (!format || !Array.isArray(request?.chapters) || request.chapters.length === 0 || request.chapters.length > 1000) {
      throw new Error('The manuscript compiler request is invalid.');
    }
    const options = { includeAbstracts: request.includeAbstracts === true, includeMetadata: request.includeMetadata === true };
    const sections = [];
    const sources = [];
    for (const chapter of request.chapters) {
      const source = chapter?.source;
      if (!compilerText(chapter?.id, 100) || !compilerText(chapter?.title, 500) || !compilerStages.has(source?.stage)) {
        throw new Error('A chapter in the manuscript compiler request is invalid.');
      }
      const resolved = await resolveStageSourceFile({
        sourceRelativePath: source.sourceRelativePath,
        sourceSha256: source.sourceSha256,
        selectedProjectRoot,
        indexPath: stageDocumentIndexPath(),
      });
      if (!resolved.ok) throw new Error(`${chapter.id}: ${resolved.message}`);
      const bytes = fs.readFileSync(resolved.filePath);
      const section = {
        id: compilerText(chapter.id, 100),
        title: compilerText(chapter.title, 500),
        contributorName: compilerText(chapter.contributorName, 300),
        contributorEmail: compilerText(chapter.contributorEmail, 320),
        institutionalAffiliation: compilerText(chapter.institutionalAffiliation, 500),
        abstractText: compilerText(chapter.abstractText, 100000),
        stage: source.stage,
        roundNumber: Number.isInteger(source.roundNumber) ? source.roundNumber : undefined,
        stageLabel: source.stage === 'revision'
          ? `Revision ${String(source.roundNumber ?? 1).padStart(2, '0')}`
          : source.stage.replace(/-/g, ' ').replace(/^./, character => character.toUpperCase()),
        effectiveOn: compilerText(source.effectiveOn, 10),
        paragraphs: request.format === 'zip' ? [] : await extractDocxText(bytes),
      };
      sections.push(section);
      sources.push({ section, sourceFileName: source.sourceFileName || path.basename(resolved.filePath), bytes });
    }
    const projectName = compilerText(request.projectName, 500) || 'Compiled manuscript';
    const output = request.format === 'md'
      ? Buffer.from(markdownForSections(projectName, sections, options), 'utf8')
      : request.format === 'docx'
        ? await buildDocx(projectName, sections, options)
        : await buildSourceArchive(projectName, sources, options);
    const result = await dialog.showSaveDialog({
      title: 'Save compiled manuscript',
      defaultPath: path.join(app.getPath('documents'), compilerFileName(projectName, format.extension)),
      filters: [{ name: format.name, extensions: [format.extension] }],
    });
    if (result.canceled || !result.filePath) return { cancelled: true, includedChapters: sections.length };
    if (selectedProjectRoot && isPathInsideResolvedRoot(selectedProjectRoot, result.filePath)) {
      throw new Error('Choose a Save As destination outside the selected project folder.');
    }
    fs.writeFileSync(result.filePath, output);
    return { cancelled: false, filePath: result.filePath, includedChapters: sections.length };
  } catch (error) {
    console.error('Manuscript compilation failed:', error?.message || error);
    throw new Error(error instanceof Error ? error.message : 'The manuscript could not be compiled.');
  }
});

  const squirrelEvent = process.argv.find(argument => [
    '--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete',
  ].includes(argument));

  function handleSquirrelEvent() {
  if (!squirrelEvent) return false;
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  const currentExe = path.basename(process.execPath);
  const shortcutCommand = squirrelEvent === '--squirrel-uninstall' ? '--removeShortcut' : '--createShortcut';

  if (squirrelEvent === '--squirrel-install' || squirrelEvent === '--squirrel-updated') {
    const legacyExe = 'Editorial Review Tracker.exe';
    if (currentExe !== legacyExe && fs.existsSync(updateExe)) {
      spawn(updateExe, ['--removeShortcut', legacyExe], { detached: true }).unref();
    }
  }

  if (squirrelEvent !== '--squirrel-obsolete' && fs.existsSync(updateExe)) {
    spawn(updateExe, [shortcutCommand, currentExe], { detached: true }).unref();
  }

  setTimeout(() => app.quit(), 1000);
  return true;
}

  function log(message) {
  const logPath = path.join(app.getPath('userData'), 'editorial-review-tracker.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
}

  async function createWindow() {
  const inputPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (!fs.existsSync(inputPath)) {
    log(`startup_failed missing_input=${inputPath}`);
    throw new Error(`Built application not found: ${inputPath}`);
  }
    const window = new BrowserWindow({
    title: productName,
    icon: path.join(__dirname, '..', 'dist', 'editorial-review-tracker-mark.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f9fafb',
      symbolColor: '#0f172a',
      height: 32,
    },
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
    window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
    window.webContents.on('did-finish-load', () => {
    log(`renderer_load_finished origin=${localAppServer?.url || 'unavailable'}`);
  });
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    log(`renderer_load_failed code=${errorCode} description=${errorDescription} url=${validatedURL}`);
  });
    window.webContents.on('render-process-gone', (_event, details) => {
    log(`renderer_process_gone reason=${details.reason} exitCode=${details.exitCode}`);
  });
    window.webContents.on('preload-error', (_event, preloadPath, error) => {
    log(`preload_error path=${preloadPath} error=${error instanceof Error ? error.message : String(error)}`);
  });
    window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (typeof message !== 'string' || !message.startsWith('renderer_startup_error ')) return;
    log(`renderer_startup_error level=${level} line=${line} source=${sourceId} message=${message.slice('renderer_startup_error '.length)}`);
  });
    window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(localAppServer?.url || '')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
    if (!localAppServer) {
      // Start the local server on a stable origin (127.0.0.1:43119).
      localAppServer = await startLocalAppServer(inputPath, log);
    }
    await window.loadURL(localAppServer.url);
  log(`startup_complete input=${inputPath} origin=${localAppServer.url} windows=1 failures=0`);
}

  if (!handleSquirrelEvent()) {
    // Enforce single-instance lock for the Electron app.
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      app.quit();
      return;
    }
    app.on('second-instance', () => {
      // Focus the existing window if a second instance is launched.
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].focus();
      }
    });

    app.whenReady().then(() => {
      Menu.setApplicationMenu(null);
      createWindow();
      app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    }).catch(error => {
      log(`startup_failed error=${error instanceof Error ? error.message : String(error)}`);
      app.quit();
    });
  }

app.on('before-quit', () => {
  if (localAppServer) localAppServer.server.close();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
