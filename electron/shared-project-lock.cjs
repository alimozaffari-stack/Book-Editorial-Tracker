const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  hashProjectFileContents,
  readValidatedProjectFile,
  validateProjectFileContents,
  writeProjectFileAtomically,
} = require('./project-file-policy.cjs');

const LOCK_FORMAT = 'book-editorial-tracker-lock';
const LOCK_VERSION = 1;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function isSafeText(value, maxLength = 120) {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.trim().length <= maxLength
    && !/[\x00-\x1F\x7F]/.test(value);
}

function lockFilePath(filePath) {
  return `${filePath}.lock`;
}

function parseLock(value) {
  let candidate;
  try {
    candidate = JSON.parse(value);
  } catch {
    throw new Error('Shared lock file is not valid JSON.');
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Shared lock file is invalid.');
  if (candidate.format !== LOCK_FORMAT || candidate.version !== LOCK_VERSION) throw new Error('Shared lock format is unsupported.');
  if (!isSafeText(candidate.editorLabel, 80)) throw new Error('Shared lock editor label is invalid.');
  if (!isSafeText(candidate.instanceId, 80)) throw new Error('Shared lock instance id is invalid.');
  if (typeof candidate.acquiredAt !== 'string' || !candidate.acquiredAt) throw new Error('Shared lock acquired timestamp is invalid.');
  if (typeof candidate.heartbeatAt !== 'string' || !candidate.heartbeatAt) throw new Error('Shared lock heartbeat timestamp is invalid.');
  if (Number.isNaN(Date.parse(candidate.acquiredAt)) || Number.isNaN(Date.parse(candidate.heartbeatAt))) throw new Error('Shared lock timestamp is invalid.');
  return candidate;
}

function readLockFile(filePath) {
  const sourcePath = lockFilePath(filePath);
  if (!fs.existsSync(sourcePath)) return { ok: true, lock: null };
  try {
    return { ok: true, lock: parseLock(fs.readFileSync(sourcePath, 'utf8')) };
  } catch {
    return { ok: false, message: 'Existing lock file is not readable.' };
  }
}

function createSharedProjectLockPolicy(options) {
  const resolveFilePath = options.resolveFilePath;
  const now = options.now || nowIso;

  const resolvePath = (fileToken) => {
    const filePath = resolveFilePath(fileToken);
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
      throw new Error('Invalid shared project token.');
    }
    return filePath;
  };

  const heartbeatPath = () => HEARTBEAT_INTERVAL_MS;

  async function acquireSharedProjectLock(fileToken, editorLabel, instanceId) {
    const filePath = resolvePath(fileToken);
    const lockPath = lockFilePath(filePath);
    const nowValue = now();
    const details = {
      format: LOCK_FORMAT,
      version: LOCK_VERSION,
      instanceId: String(instanceId || '').trim(),
      editorLabel: String(editorLabel || '').trim(),
      acquiredAt: nowValue,
      heartbeatAt: nowValue,
    };
    if (!isSafeText(details.instanceId, 80)) return { ok: false, message: 'Invalid lock owner.' };
    if (!isSafeText(details.editorLabel, 120)) return { ok: false, message: 'Invalid editor label.' };

    let fd;
    let caughtError = null;
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, JSON.stringify(details), 'utf8');
      fs.fsyncSync(fd);
      return { ok: true, lock: details };
    } catch (error) {
      caughtError = error;
      if (error?.code === 'EEXIST') {
        const current = readLockFile(filePath);
        if (!current.ok) return { ok: false, message: current.message };
        return { ok: false, lock: current.lock, message: 'The shared project is currently in use.' };
      }
      return { ok: false, message: 'The shared lock could not be acquired.' };
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (caughtError && caughtError?.code !== 'EEXIST') {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // Nothing to do on best-effort cleanup.
        }
      }
    }
  }

  async function heartbeatSharedProjectLock(fileToken, instanceId) {
    const filePath = resolvePath(fileToken);
    const lockPath = lockFilePath(filePath);
    const current = readLockFile(filePath);
    if (!current.ok) return { ok: false, message: current.message };
    if (!current.lock) return { ok: false, message: 'No lock exists for this project.' };
    if (current.lock.instanceId !== instanceId) return { ok: false, message: 'This instance does not own the lock.' };
    const nextLock = { ...current.lock, heartbeatAt: now() };
    const fd = fs.openSync(lockPath, 'w');
    try {
      fs.writeFileSync(fd, JSON.stringify(nextLock), 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return { ok: true, lock: nextLock };
  }

  async function verifySharedProjectLock(fileToken, instanceId) {
    const filePath = resolvePath(fileToken);
    const current = readLockFile(filePath);
    if (!current.ok) return { ok: false, message: current.message };
    if (!current.lock) return { ok: false, message: 'No shared lock exists for this project.' };
    if (current.lock.instanceId !== instanceId) return { ok: false, message: 'This instance no longer owns the shared lock.' };
    return { ok: true, lock: current.lock };
  }

  async function releaseSharedProjectLock(fileToken, instanceId) {
    const filePath = resolvePath(fileToken);
    const lockPath = lockFilePath(filePath);
    const current = readLockFile(filePath);
    if (!current.ok) return { ok: false, message: current.message };
    if (!current.lock) return { ok: false, message: 'No lock exists for this project.' };
    if (current.lock.instanceId !== instanceId) return { ok: false, message: 'This instance does not own the lock.' };
    fs.unlinkSync(lockPath);
    return { ok: true };
  }

  async function readSharedProjectLock(fileToken) {
    const filePath = resolvePath(fileToken);
    const current = readLockFile(filePath);
    if (!current.ok) return { ok: false, message: current.message };
    return { ok: true, lock: current.lock };
  }

  async function forceUnlockSharedProjectLock(fileToken, instanceId, confirmationText) {
    const filePath = resolvePath(fileToken);
    const lockPath = lockFilePath(filePath);
    const current = readLockFile(filePath);
    if (!current.ok) return { ok: false, message: current.message };
    if (!current.lock) return { ok: false, message: 'No lock exists for this project.' };
    if (confirmationText !== 'FORCE UNLOCK') return { ok: false, message: 'Type FORCE UNLOCK to remove a stale lock.' };
    fs.unlinkSync(lockPath);
    return { ok: true };
  }

  async function saveSharedProjectFile(fileToken, instanceId, expectedHash, expectedProjectRevision, contents) {
    validateProjectFileContents(contents);
    if (typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/i.test(expectedHash)) {
      return { ok: false, message: 'Invalid project file hash.' };
    }
    if (!Number.isInteger(expectedProjectRevision) || expectedProjectRevision < 0) {
      return { ok: false, message: 'Invalid project revision.' };
    }

    const ownership = await verifySharedProjectLock(fileToken, instanceId);
    if (!ownership.ok) {
      return { ok: false, message: ownership.message };
    }

    const filePath = resolvePath(fileToken);
    const current = readValidatedProjectFile(filePath);
    const currentHash = hashProjectFileContents(current.contents);
    if (currentHash !== expectedHash) {
      return { ok: false, message: 'The project file changed on disk. Save As conflict copy to keep your changes.' };
    }
    if (current.parsed.projectRevision !== expectedProjectRevision) {
      return { ok: false, message: 'The shared project revision changed on disk. Save As conflict copy to keep your changes.' };
    }

    writeProjectFileAtomically(filePath, contents);
    return { ok: true, hash: hashProjectFileContents(contents), message: 'Project file saved.' };
  }

  return {
    acquireSharedProjectLock,
    heartbeatSharedProjectLock,
    verifySharedProjectLock,
    releaseSharedProjectLock,
    readSharedProjectLock,
    forceUnlockSharedProjectLock,
    saveSharedProjectFile,
    heartbeatIntervalMs: heartbeatPath(),
  };
}

module.exports = {
  LOCK_FORMAT,
  LOCK_VERSION,
  HEARTBEAT_INTERVAL_MS,
  createSharedProjectLockPolicy,
};
