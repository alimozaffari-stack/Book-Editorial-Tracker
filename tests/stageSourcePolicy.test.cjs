const { describe, it } = require('node:test');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  isSha256,
  resolveProjectStageFile,
  resolveIndexedStageFile,
  resolveStageSourceFile,
  validateStageSourceRequest,
  setTestDependencies,
  calculateSha256
} = require('../electron/stage-source-policy.cjs');

// Mock dependencies for testing
const mockRealpathSync = (p) => {
  if (p === '/project/root') return '/real/project/root';
  if (p === '/project/root/chapters/ch01.docx') return '/real/project/root/chapters/ch01.docx';
  if (p === '/outside/root/chapters/ch01.docx') return '/outside/root/chapters/ch01.docx';
  if (p === '/junction/outside/chapters/ch01.docx') return '/outside/root/chapters/ch01.docx';
  if (p === '/project/root/chapters/large.docx') return '/real/project/root/chapters/large.docx';
  if (p === '/project/root/chapters/notdoc.txt') return '/real/project/root/chapters/notdoc.txt';
  // For path.join results
  if (p === path.join('/project/root', 'chapters/ch01.docx')) return '/real/project/root/chapters/ch01.docx';
  if (p === path.join('/project/root', 'chapters/large.docx')) return '/real/project/root/chapters/large.docx';
  if (p === path.join('/project/root', 'chapters/notdoc.txt')) return '/real/project/root/chapters/notdoc.txt';
  if (p === path.join('/junction/outside', 'chapters/ch01.docx')) return '/outside/root/chapters/ch01.docx';
  return p;
};

const mockLstatSync = (p) => {
  if (p === '/real/project/root/chapters/ch01.docx') {
    return {
      isFile: () => true,
      isSymbolicLink: () => false,
      size: 1000000 // 1MB
    };
  }
  if (p === '/junction/outside/chapters/ch01.docx') {
    return {
      isFile: () => true,
      isSymbolicLink: () => true, // This is a junction
      size: 1000000 // 1MB
    };
  }
  if (p === '/outside/root/chapters/ch01.docx') {
    return {
      isFile: () => true,
      isSymbolicLink: () => false,
      size: 1000000 // 1MB
    };
  }
  if (p === '/real/project/root/chapters/large.docx') {
    return {
      isFile: () => true,
      isSymbolicLink: () => false,
      size: 30 * 1024 * 1024 // 30MB - too large
    };
  }
  if (p === '/real/project/root/chapters/notdoc.txt') {
    return {
      isFile: () => true,
      isSymbolicLink: () => false,
      size: 1000000 // 1MB
    };
  }
  return {
    isFile: () => true,
    isSymbolicLink: () => false,
    size: 1000000 // 1MB
  };
};

const mockCreateReadStream = (p) => {
  const stream = require('stream');
  const readable = new stream.Readable({
    read() {
      this.push('test content');
      this.push(null);
    }
  });
  return readable;
};

// Set test dependencies
setTestDependencies(mockRealpathSync, mockLstatSync, mockCreateReadStream);

describe('stageSourcePolicy', () => {
  describe('validateStageSourceRequest', () => {
    it('rejects a malformed request or an action other than open or reveal', () => {
      assert.deepStrictEqual(
        validateStageSourceRequest({ sourceSha256: 'a'.repeat(64), action: 'download' }),
        { ok: false, message: 'Invalid document action' }
      );
      assert.deepStrictEqual(
        validateStageSourceRequest({ action: 'open' }),
        { ok: false, message: 'Invalid document source request' }
      );
    });

    it('accepts an open or reveal request with one safe source identifier', () => {
      assert.deepStrictEqual(
        validateStageSourceRequest({ sourceRelativePath: 'CH01/submission.docx', action: 'open' }),
        { ok: true }
      );
      assert.deepStrictEqual(
        validateStageSourceRequest({ sourceSha256: 'a'.repeat(64), action: 'reveal' }),
        { ok: true }
      );
    });
  });

  describe('isSha256', () => {
    it('returns true for valid lowercase SHA-256', () => {
      const valid = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
      assert.strictEqual(isSha256(valid), true);
    });

    it('returns true for valid uppercase SHA-256', () => {
      const valid = 'A1B2C3D4E5F67890123456789012345678901234567890123456789012345678';
      assert.strictEqual(isSha256(valid), true);
    });

    it('returns false for invalid length', () => {
      const invalid = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567';
      assert.strictEqual(isSha256(invalid), false);
    });

    it('returns false for non-hex characters', () => {
      const invalid = 'g1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
      assert.strictEqual(isSha256(invalid), false);
    });
  });

  describe('resolveProjectStageFile', () => {
    it('resolves a regular project-relative DOCX inside the selected root', () => {
      const result = resolveProjectStageFile('chapters/ch01.docx', '/project/root');
      assert.deepStrictEqual(result, { ok: true, filePath: '/real/project/root/chapters/ch01.docx' });
    });

    it('rejects traversal and absolute source references', () => {
      let result = resolveProjectStageFile('../file.docx', '/project/root');
      assert.deepStrictEqual(result, { ok: false, message: 'Invalid source path' });

      result = resolveProjectStageFile('C:\\file.docx', '/project/root');
      assert.deepStrictEqual(result, { ok: false, message: 'Invalid source path' });

      result = resolveProjectStageFile('C:chapter.docx', '/project/root');
      assert.deepStrictEqual(result, { ok: false, message: 'Invalid source path' });

      result = resolveProjectStageFile('\\\\server\\file.docx', '/project/root');
      assert.deepStrictEqual(result, { ok: false, message: 'Invalid source path' });

      result = resolveProjectStageFile('file:///C:/file.docx', '/project/root');
      assert.deepStrictEqual(result, { ok: false, message: 'Invalid source path' });
    });

    it('rejects a junction or real path outside the selected root', () => {
      const result = resolveProjectStageFile('chapters/ch01.docx', '/junction/outside');
      assert.deepStrictEqual(result, { ok: false, message: 'File must be within the selected project root' });
    });

    it('rejects non-DOCX and files larger than 25 MiB', () => {
      // Test non-DOCX file
      let result = resolveProjectStageFile('chapters/notdoc.txt', '/project/root');
      assert.deepStrictEqual(result, { ok: false, message: 'File must be a DOCX document' });
      
      // Test large file
      result = resolveProjectStageFile('chapters/large.docx', '/project/root');
      assert.deepStrictEqual(result, { ok: false, message: 'File is too large (max 25 MiB)' });
    });
  });

  describe('resolveIndexedStageFile', () => {
    it('rejects a local-index file whose SHA-256 no longer matches', async () => {
      // Mock fs functions for this test using dependency injection
      const mockFsExistsSync = (p) => {
        if (p.endsWith('stage-document-index.json')) return true;
        if (p === '/path/to/document.docx') return true;
        return false;
      };
      
      const mockFsReadFileSync = (p) => {
        if (p.endsWith('stage-document-index.json')) {
          return JSON.stringify({
            version: 1,
            entries: {
              'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678': '/path/to/document.docx'
            }
          });
        }
        return 'different content';
      };
      
      // Mock createReadStream to return different content
      const mockCreateReadStreamDiff = (p) => {
        const stream = require('stream');
        const readable = new stream.Readable({
          read() {
            this.push('different content');
            this.push(null);
          }
        });
        return readable;
      };
      
      // Temporarily override the dependencies
      const originalRealpathSync = mockRealpathSync;
      const originalLstatSync = mockLstatSync;
      const originalCreateReadStream = mockCreateReadStream;
      
      setTestDependencies(originalRealpathSync, originalLstatSync, mockCreateReadStreamDiff);
      
      // Mock fs functions in the module
      const originalFsExistsSync = fs.existsSync;
      const originalFsReadFileSync = fs.readFileSync;
      fs.existsSync = mockFsExistsSync;
      fs.readFileSync = mockFsReadFileSync;
      
      const result = await resolveIndexedStageFile('a1b2c3d4e5f67890123456789012345678901234567890123456789012345678', '/path/to/stage-document-index.json');
      assert.deepStrictEqual(result, { ok: false, message: 'File content has changed since it was recorded' });
      
      // Restore original functions
      fs.existsSync = originalFsExistsSync;
      fs.readFileSync = originalFsReadFileSync;
      setTestDependencies(originalRealpathSync, originalLstatSync, originalCreateReadStream);
    });

    it('returns unavailable when neither project root nor local hash index resolves', async () => {
      // Mock fs functions for this test using dependency injection
      const mockFsExistsSync = () => false;
      
      // Temporarily override the fs functions
      const originalFsExistsSync = fs.existsSync;
      fs.existsSync = mockFsExistsSync;
      
      const result = await resolveIndexedStageFile('a1b2c3d4e5f67890123456789012345678901234567890123456789012345678', '/path/to/stage-document-index.json');
      assert.deepStrictEqual(result, { ok: false, message: 'This document is not available on this computer. Choose the project folder in Backups & intake, or select the document again.' });
      
      // Restore original functions
      fs.existsSync = originalFsExistsSync;
    });
  });

  describe('resolveStageSourceFile', () => {
    it('falls back to indexed hash when relative-path resolution fails', async () => {
      const relativeHash = crypto.createHash('sha256').update('content for fallback').digest('hex');
      const mockFsExistsSync = (p) => {
        if (p.endsWith('stage-document-index.json')) return true;
        if (p === '/fallback/path.docx') return true;
        return false;
      };
      const mockFsReadFileSync = (p) => {
        if (p.endsWith('stage-document-index.json')) {
          return JSON.stringify({
            version: 1,
            entries: {
              [relativeHash]: '/fallback/path.docx'
            }
          });
        }
        return '';
      };
      const mockCreateReadStreamFallback = () => {
        const stream = require('stream');
        const readable = new stream.Readable({
          read() {
            this.push('content for fallback');
            this.push(null);
          }
        });
        return readable;
      };

      const originalFsExistsSync = fs.existsSync;
      const originalFsReadFileSync = fs.readFileSync;
      const originalCreateReadStream = mockCreateReadStream;

      fs.existsSync = mockFsExistsSync;
      fs.readFileSync = mockFsReadFileSync;
      setTestDependencies(mockRealpathSync, mockLstatSync, mockCreateReadStreamFallback);

      const result = await resolveStageSourceFile({
        sourceRelativePath: 'C:\\chapters\\ch01.docx',
        sourceSha256: relativeHash,
        selectedProjectRoot: '/project/root',
        indexPath: '/path/to/stage-document-index.json',
      });

      assert.deepStrictEqual(result, { ok: true, filePath: '/fallback/path.docx' });

      fs.existsSync = originalFsExistsSync;
      fs.readFileSync = originalFsReadFileSync;
      setTestDependencies(mockRealpathSync, mockLstatSync, originalCreateReadStream);
    });
  });
});
