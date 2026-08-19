const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createProjectFilePolicy,
  hashProjectFileContents,
  writeProjectFileAtomically,
} = require('../electron/project-file-policy.cjs');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bet-project-file-'));
  assert.equal(root.toLowerCase().includes('google drive'), false);
  assert.equal(root.toLowerCase().includes('my drive'), false);
  return root;
}

function validContents(name = 'Local') {
  return JSON.stringify({
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'tester',
    project: { name, generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'tester', updatedAt: '2026-01-01T00:00:00.000Z' },
    chapters: [],
    activity: [],
  });
}

test('project-file policy returns opaque tokens only when choosing a file', async () => {
  const root = tempRoot();
  const filePath = path.join(root, 'project.betp.json');
  fs.writeFileSync(filePath, validContents(), 'utf8');
  const policy = createProjectFilePolicy({
    userDataPath: root,
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [filePath] }) },
  });

  const result = await policy.chooseProjectFile();
  assert.equal(result.cancelled, false);
  assert.equal(typeof result.fileToken, 'string');
  assert.equal(result.fileToken.includes(root), false);
  assert.equal(result.contents.includes(filePath), false);
});

test('project-file policy writes through a sibling temporary file and replaces atomically', async () => {
  const root = tempRoot();
  const filePath = path.join(root, 'project.betp.json');
  fs.writeFileSync(filePath, validContents('Before'), 'utf8');
  const policy = createProjectFilePolicy({ userDataPath: root });
  const fileToken = policy.rememberProjectFileForTest(filePath);
  const expectedHash = hashProjectFileContents(fs.readFileSync(filePath, 'utf8'));

  const result = await policy.saveProjectFile(fileToken, expectedHash, validContents('After'));
  assert.equal(result.ok, true);
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).project.name, 'After');
  assert.equal(fs.readdirSync(root).some(name => name.includes('.tmp-')), false);
});

test('project-file policy rejects a stale canonical hash without changing the file', async () => {
  const root = tempRoot();
  const filePath = path.join(root, 'project.betp.json');
  fs.writeFileSync(filePath, validContents('Original'), 'utf8');
  const policy = createProjectFilePolicy({ userDataPath: root });
  const fileToken = policy.rememberProjectFileForTest(filePath);

  const result = await policy.saveProjectFile(fileToken, '0'.repeat(64), validContents('Replacement'));
  assert.equal(result.ok, false);
  assert.match(result.message, /changed on disk/);
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).project.name, 'Original');
});

test('project-file policy save-as conflict copy keeps the original file and returns a new token', async () => {
  const root = tempRoot();
  const originalPath = path.join(root, 'project.betp.json');
  fs.writeFileSync(originalPath, validContents('Original'), 'utf8');
  const copyPath = path.join(root, 'project-copy.betp.json');
  const policy = createProjectFilePolicy({
    userDataPath: root,
    dialog: {
      showOpenDialog: async () => ({ canceled: false, filePaths: [originalPath] }),
      showSaveDialog: async () => ({ canceled: false, filePath: copyPath }),
    },
  });

  const opened = await policy.chooseProjectFile();
  assert.equal(opened.cancelled, false);
  const staleContents = validContents('Replacement');
  const staleSave = await policy.saveProjectFile(opened.fileToken, '0'.repeat(64), staleContents);
  assert.equal(staleSave.ok, false);
  const saved = await policy.saveProjectFileAs(staleContents);
  assert.equal(saved.cancelled, false);
  assert.equal(saved.fileToken !== opened.fileToken, true);
  assert.equal(fs.readFileSync(originalPath, 'utf8').includes('Replacement'), false);
  assert.equal(fs.readFileSync(copyPath, 'utf8').includes('Replacement'), true);
  assert.equal(opened.fileToken.includes(root), false);
});

test('ordinary local project-file mode rejects Google Drive-like paths', () => {
  const root = tempRoot();
  const localDriveLikePath = path.join(root, 'Google Drive', 'project.betp.json');
  const policy = createProjectFilePolicy({ userDataPath: root });

  assert.throws(() => {
    policy.rememberProjectFileForTest(localDriveLikePath);
  }, /outside Google Drive/);
});

test('shared project-file routing permits the same Google Drive-like path class with opaque shared tokens only', () => {
  const root = tempRoot();
  const sharedDriveLikePath = path.join(root, 'Google Drive', 'shared-project.betp.json');
  const policy = createProjectFilePolicy({ userDataPath: root });

  const sharedToken = policy.rememberSharedProjectFileForTest(sharedDriveLikePath);

  assert.equal(typeof sharedToken, 'string');
  assert.equal(sharedToken.includes(root), false);
  assert.equal(policy.resolveSharedTokenPath(sharedToken), sharedDriveLikePath);
  assert.throws(() => {
    policy.resolveTokenPath(sharedToken);
  }, /shared-folder token/);
});

test('generic local save rejects a shared-folder token', async () => {
  const root = tempRoot();
  const sharedDriveLikePath = path.join(root, 'Google Drive', 'shared-project.betp.json');
  const policy = createProjectFilePolicy({ userDataPath: root });
  const sharedToken = policy.rememberSharedProjectFileForTest(sharedDriveLikePath);

  await assert.rejects(async () => {
    await policy.saveProjectFile(sharedToken, '0'.repeat(64), validContents('Replacement'));
  }, /shared-folder token/);
});

test('writeProjectFileAtomically uses exclusive creation and retries on EEXIST', () => {
  const root = tempRoot();
  const filePath = path.join(root, 'project.betp.json');
  const uuids = ['clash-uuid', 'next-uuid'];
  let uuidIndex = 0;
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = () => uuids[uuidIndex++];

  try {
    const firstTempPath = path.join(root, `.${path.basename(filePath)}.tmp-${uuids[0]}`);
    const staleContents = 'stale';
    fs.writeFileSync(firstTempPath, staleContents, 'utf8');

    // Test that save succeeds using a different filename
    writeProjectFileAtomically(filePath, validContents('Retried'));

    // Verify the final canonical project file is valid
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).project.name, 'Retried');

    // Verify the pre-existing collision file remains unchanged
    assert.equal(fs.readFileSync(firstTempPath, 'utf8'), staleContents);
  } finally {
    crypto.randomUUID = originalRandomUUID;
  }
});

test('writeProjectFileAtomically throws error when all attempts collide', () => {
  const root = tempRoot();
  const filePath = path.join(root, 'project.betp.json');
  const uuids = ['clash-uuid-1', 'clash-uuid-2', 'clash-uuid-3', 'clash-uuid-4', 'clash-uuid-5'];
  let uuidIndex = 0;
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = () => uuids[uuidIndex++];

  try {
    // Create temp files for all attempts
    for (const uuid of uuids) {
      const tempPath = path.join(root, `.${path.basename(filePath)}.tmp-${uuid}`);
      fs.writeFileSync(tempPath, 'stale', 'utf8');
    }

    // Should throw error when all attempts collide
    assert.throws(() => {
      writeProjectFileAtomically(filePath, validContents('Should not be written'));
    }, /Failed to create temporary file due to repeated collisions/);

    // Verify all pre-existing files remain untouched
    for (const uuid of uuids) {
      const tempPath = path.join(root, `.${path.basename(filePath)}.tmp-${uuid}`);
      assert.equal(fs.readFileSync(tempPath, 'utf8'), 'stale');
    }

    // Verify canonical file doesn't exist
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    crypto.randomUUID = originalRandomUUID;
  }
});
