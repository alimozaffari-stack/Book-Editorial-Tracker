const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Dependency injection for testing
let fsRealpathSync = fs.realpathSync;
let fsLstatSync = fs.lstatSync;
let fsCreateReadStream = fs.createReadStream;

function setTestDependencies(realpathSync, lstatSync, createReadStream) {
  fsRealpathSync = realpathSync;
  fsLstatSync = lstatSync;
  fsCreateReadStream = createReadStream;
}

function isSha256(value) {
  if (typeof value !== 'string') return false;
  return /^[a-fA-F0-9]{64}$/.test(value);
}

function validateStageSourceRequest(request) {
  if (!request || typeof request !== 'object') {
    return { ok: false, message: 'Invalid document source request' };
  }
  if (request.action !== 'open' && request.action !== 'reveal') {
    return { ok: false, message: 'Invalid document action' };
  }
  const hasRelativePath = typeof request.sourceRelativePath === 'string' && request.sourceRelativePath.length > 0;
  const hasHash = typeof request.sourceSha256 === 'string' && request.sourceSha256.length > 0;
  if (!hasRelativePath && !hasHash) {
    return { ok: false, message: 'Invalid document source request' };
  }
  if ((request.sourceRelativePath !== undefined && !hasRelativePath) ||
      (request.sourceSha256 !== undefined && !hasHash)) {
    return { ok: false, message: 'Invalid document source request' };
  }
  return { ok: true };
}

function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsCreateReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function isPathSafe(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return false;
  
  // Check for absolute paths, UNC paths, file URLs, or traversal
  if (path.isAbsolute(relativePath) || 
      /^[A-Za-z]:/.test(relativePath) ||
      relativePath.startsWith('\\\\') || 
      relativePath.startsWith('//') || 
      relativePath.startsWith('file:') ||
      relativePath.includes('../') ||
      relativePath.includes('..\\')) {
    return false;
  }
  
  return true;
}

function resolveProjectStageFile(sourceRelativePath, selectedProjectRoot) {
  // Validate inputs
  if (!sourceRelativePath || !selectedProjectRoot) {
    return { ok: false, message: 'Source path and project root are required' };
  }
  
  if (!isPathSafe(sourceRelativePath)) {
    return { ok: false, message: 'Invalid source path' };
  }
  
  try {
    // Resolve paths
    const realRoot = fsRealpathSync(selectedProjectRoot);
    const candidatePath = path.join(selectedProjectRoot, sourceRelativePath);
    const realCandidate = fsRealpathSync(candidatePath);
    
    // Check if candidate is within root
    const relative = path.relative(realRoot, realCandidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { ok: false, message: 'File must be within the selected project root' };
    }
    
    // Check file properties
    const stat = fsLstatSync(realCandidate);
    if (!stat.isFile()) {
      return { ok: false, message: 'Path is not a file' };
    }
    
    if (stat.isSymbolicLink()) {
      return { ok: false, message: 'Symbolic links are not allowed' };
    }
    
    // Check file extension
    if (!realCandidate.toLowerCase().endsWith('.docx')) {
      return { ok: false, message: 'File must be a DOCX document' };
    }
    
    // Check file size (25 MiB limit)
    const maxSize = 25 * 1024 * 1024; // 25 MiB
    if (stat.size > maxSize) {
      return { ok: false, message: 'File is too large (max 25 MiB)' };
    }
    
    return { ok: true, filePath: realCandidate };
  } catch (error) {
    return { ok: false, message: 'File not found or inaccessible' };
  }
}

async function resolveStageSourceFile({
  sourceRelativePath,
  sourceSha256,
  selectedProjectRoot,
  indexPath,
}) {
  const hasRelativePath = typeof sourceRelativePath === 'string' && sourceRelativePath.length > 0;
  const hasHash = typeof sourceSha256 === 'string' && sourceSha256.length > 0;
  let relativeFailureMessage;

  if (hasRelativePath && selectedProjectRoot) {
    const relativeResult = resolveProjectStageFile(sourceRelativePath, selectedProjectRoot);
    if (relativeResult.ok) return relativeResult;
    relativeFailureMessage = relativeResult.message;
  }

  if (hasHash) {
    const indexedResult = await resolveIndexedStageFile(sourceSha256, indexPath);
    if (indexedResult.ok) return indexedResult;
    if (!hasRelativePath || !selectedProjectRoot) {
      return indexedResult;
    }
  }

  if (relativeFailureMessage) {
    return { ok: false, message: relativeFailureMessage };
  }

  return { ok: false, message: 'This document is not available on this computer. Choose the project folder in Backups & intake, or select the document again.' };
}

async function resolveIndexedStageFile(sourceSha256, indexPath) {
  // Validate hash
  if (!isSha256(sourceSha256)) {
    return { ok: false, message: 'Invalid SHA-256 hash' };
  }
  
  try {
    // Read index file
    if (!fs.existsSync(indexPath)) {
      return { ok: false, message: 'This document is not available on this computer. Choose the project folder in Backups & intake, or select the document again.' };
    }
    
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const index = JSON.parse(indexContent);
    
    if (!index.entries || !index.entries[sourceSha256]) {
      return { ok: false, message: 'This document is not available on this computer. Choose the project folder in Backups & intake, or select the document again.' };
    }
    
    const filePath = index.entries[sourceSha256];
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { ok: false, message: 'This document is not available on this computer. Choose the project folder in Backups & intake, or select the document again.' };
    }
    
    // Calculate current hash and compare
    const currentHash = await calculateSha256(filePath);
    if (currentHash !== sourceSha256) {
      return { ok: false, message: 'File content has changed since it was recorded' };
    }
    
    // Check file properties
    const stat = fsLstatSync(filePath);
    if (!stat.isFile()) {
      return { ok: false, message: 'Path is not a file' };
    }
    
    if (stat.isSymbolicLink()) {
      return { ok: false, message: 'Symbolic links are not allowed' };
    }
    
    // Check file extension
    if (!filePath.toLowerCase().endsWith('.docx')) {
      return { ok: false, message: 'File must be a DOCX document' };
    }
    
    // Check file size (25 MiB limit)
    const maxSize = 25 * 1024 * 1024; // 25 MiB
    if (stat.size > maxSize) {
      return { ok: false, message: 'File is too large (max 25 MiB)' };
    }
    
    return { ok: true, filePath };
  } catch (error) {
    return { ok: false, message: 'This document is not available on this computer. Choose the project folder in Backups & intake, or select the document again.' };
  }
}

module.exports = {
  isSha256,
  resolveProjectStageFile,
  resolveIndexedStageFile,
  resolveStageSourceFile,
  validateStageSourceRequest,
  calculateSha256,
  setTestDependencies
};
