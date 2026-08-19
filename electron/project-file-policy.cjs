const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX_BYTES = 25 * 1024 * 1024;
const TOKEN_FILE = 'project-file-tokens.json';
const FORMAT = 'book-editorial-tracker-project';
const LOCAL_MODE = 'local';
const SHARED_MODE = 'shared';

function hashProjectFileContents(contents) {
  return crypto.createHash('sha256').update(contents, 'utf8').digest('hex');
}

function isGoogleDrivePath(filePath) {
  const lower = String(filePath).toLowerCase();
  return lower.includes(`${path.sep.toLowerCase()}google drive${path.sep.toLowerCase()}`)
    || lower.includes(`${path.sep.toLowerCase()}my drive${path.sep.toLowerCase()}`);
}

function validateProjectFileContents(contents) {
  if (typeof contents !== 'string') throw new Error('Project file contents must be text.');
  if (Buffer.byteLength(contents, 'utf8') > MAX_BYTES) throw new Error('The project file is larger than 25 MiB.');
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('The project file is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid project file.');
  if (parsed.format !== FORMAT || parsed.version !== 1) throw new Error('Invalid project file format.');
  if (!Number.isInteger(parsed.projectRevision) || parsed.projectRevision < 0) throw new Error('Invalid project file revision.');
  if (!parsed.project || !Array.isArray(parsed.chapters) || !Array.isArray(parsed.activity)) throw new Error('Invalid project file data.');
}

function parseProjectFileContents(contents) {
  validateProjectFileContents(contents);
  return JSON.parse(contents);
}

function readValidatedProjectFile(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  return { contents, parsed: parseProjectFileContents(contents) };
}

function writeProjectFileAtomically(filePath, contents) {
  const maxAttempts = 5;
  let temporaryPath;
  let fd;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp-${crypto.randomUUID()}`);
    try {
      fd = fs.openSync(temporaryPath, 'wx');
      break;
    } catch (error) {
      if (error.code === 'EEXIST' && attempt < maxAttempts - 1) {
        // On EEXIST, retry with a new random temp filename up to the existing bounded attempt limit.
        // Never unlink, overwrite, rename, or otherwise modify the colliding temp file.
        continue;
      }
      // If all attempts collide, throw a safe error and leave all pre-existing files untouched.
      if (error.code === 'EEXIST') {
        throw new Error('Failed to create temporary file due to repeated collisions. Please try again.');
      }
      throw error;
    }
  }
  try {
    fs.writeFileSync(fd, contents, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {
      // Best effort cleanup of the sibling temporary file.
    }
  }
}

function createProjectFilePolicy(options) {
  const userDataPath = options.userDataPath;
  const dialog = options.dialog || {};
  const tokenPath = path.join(userDataPath, TOKEN_FILE);

  function loadTokens() {
    try {
      const parsed = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveTokens(tokens) {
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, JSON.stringify(tokens), 'utf8');
  }

  function normalizeTokenEntry(entry) {
    if (typeof entry === 'string') {
      return { filePath: entry, mode: LOCAL_MODE };
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    if (typeof entry.filePath !== 'string') return null;
    if (entry.mode !== LOCAL_MODE && entry.mode !== SHARED_MODE) return null;
    return entry;
  }

  function rememberFile(filePath, mode = LOCAL_MODE) {
    if (!path.isAbsolute(filePath)) throw new Error('Project file paths must be absolute in the main process.');
    if (mode === LOCAL_MODE && isGoogleDrivePath(filePath)) throw new Error('Choose a local project file outside Google Drive.');
    const token = crypto.randomUUID();
    const tokens = loadTokens();
    tokens[token] = { filePath, mode };
    saveTokens(tokens);
    return token;
  }

  function resolveToken(fileToken, mode = LOCAL_MODE) {
    if (typeof fileToken !== 'string' || !/^[0-9a-f-]{36}$/i.test(fileToken)) throw new Error('Invalid project file token.');
    const entry = normalizeTokenEntry(loadTokens()[fileToken]);
    if (!entry || !path.isAbsolute(entry.filePath)) throw new Error('Project file token was not found.');
    if (entry.mode !== mode) {
      if (entry.mode === SHARED_MODE) throw new Error('A shared-folder token cannot be used by local project-file operations.');
      throw new Error('A local project-file token cannot be used by shared-folder operations.');
    }
    if (mode === LOCAL_MODE && isGoogleDrivePath(entry.filePath)) throw new Error('Choose a local project file outside Google Drive.');
    return entry.filePath;
  }

  function resolveTokenPath(fileToken) {
    return resolveToken(fileToken, LOCAL_MODE);
  }

  function resolveSharedTokenPath(fileToken) {
    return resolveToken(fileToken, SHARED_MODE);
  }

  async function chooseProjectFile() {
    if (!dialog.showOpenDialog) throw new Error('Project file dialog is unavailable.');
    const result = await dialog.showOpenDialog({
      title: 'Open Book Editorial Tracker project file',
      properties: ['openFile'],
      filters: [{ name: 'Book Editorial Tracker project', extensions: ['json', 'betp'] }],
    });
    if (result.canceled || !result.filePaths?.[0]) return { cancelled: true };
    const filePath = result.filePaths[0];
    const contents = fs.readFileSync(filePath, 'utf8');
    validateProjectFileContents(contents);
    return { cancelled: false, contents, fileToken: rememberFile(filePath, LOCAL_MODE) };
  }

  async function chooseSharedProjectFile() {
    if (!dialog.showOpenDialog) throw new Error('Project file dialog is unavailable.');
    const result = await dialog.showOpenDialog({
      title: 'Open shared Book Editorial Tracker project file',
      properties: ['openFile'],
      filters: [{ name: 'Book Editorial Tracker project', extensions: ['json', 'betp'] }],
    });
    if (result.canceled || !result.filePaths?.[0]) return { cancelled: true };
    const filePath = result.filePaths[0];
    const contents = fs.readFileSync(filePath, 'utf8');
    validateProjectFileContents(contents);
    return { cancelled: false, contents, fileToken: rememberFile(filePath, SHARED_MODE) };
  }

  async function saveProjectFile(fileToken, expectedHash, contents) {
    validateProjectFileContents(contents);
    if (typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/i.test(expectedHash)) return { ok: false, message: 'Invalid project file hash.' };
    const filePath = resolveToken(fileToken, LOCAL_MODE);
    const currentContents = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const currentHash = hashProjectFileContents(currentContents);
    if (currentHash !== expectedHash) return { ok: false, message: 'The project file changed on disk. Save As to keep your changes.' };
    writeProjectFileAtomically(filePath, contents);
    return { ok: true, hash: hashProjectFileContents(contents), message: 'Project file saved.' };
  }

  async function saveProjectFileAs(contents) {
    validateProjectFileContents(contents);
    if (!dialog.showSaveDialog) throw new Error('Project file dialog is unavailable.');
    const result = await dialog.showSaveDialog({
      title: 'Save Book Editorial Tracker project file',
      defaultPath: 'book-editorial-tracker-project.betp.json',
      filters: [{ name: 'Book Editorial Tracker project', extensions: ['json', 'betp'] }],
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    if (isGoogleDrivePath(result.filePath)) throw new Error('Choose a local project file outside Google Drive.');
    writeProjectFileAtomically(result.filePath, contents);
    return { cancelled: false, fileToken: rememberFile(result.filePath, LOCAL_MODE), hash: hashProjectFileContents(contents) };
  }

  async function saveSharedProjectFileAs(contents) {
    validateProjectFileContents(contents);
    if (!dialog.showSaveDialog) throw new Error('Project file dialog is unavailable.');
    const result = await dialog.showSaveDialog({
      title: 'Save shared Book Editorial Tracker project file',
      defaultPath: 'book-editorial-tracker-project.betp.json',
      filters: [{ name: 'Book Editorial Tracker project', extensions: ['json', 'betp'] }],
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    writeProjectFileAtomically(result.filePath, contents);
    return { cancelled: false, fileToken: rememberFile(result.filePath, SHARED_MODE), hash: hashProjectFileContents(contents) };
  }

  return {
    chooseProjectFile,
    chooseSharedProjectFile,
    saveProjectFile,
    saveProjectFileAs,
    saveSharedProjectFileAs,
    rememberProjectFileForTest: (filePath) => rememberFile(filePath, LOCAL_MODE),
    rememberSharedProjectFileForTest: (filePath) => rememberFile(filePath, SHARED_MODE),
    resolveTokenPath,
    resolveSharedTokenPath,
  };
}

module.exports = {
  createProjectFilePolicy,
  hashProjectFileContents,
  parseProjectFileContents,
  readValidatedProjectFile,
  validateProjectFileContents,
  writeProjectFileAtomically,
};
