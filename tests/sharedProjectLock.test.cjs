const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createProjectFilePolicy,
  hashProjectFileContents,
} = require('../electron/project-file-policy.cjs');
const {
  createSharedProjectLockPolicy,
} = require('../electron/shared-project-lock.cjs');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bet-shared-lock-'));
  const lower = root.toLowerCase();
  assert.equal(lower.includes('google drive'), false);
  assert.equal(lower.includes('my drive'), false);
  return root;
}

function prepareSharedPolicy(root) {
  const filePolicy = createProjectFilePolicy({ userDataPath: root });
  const lockPolicy = createSharedProjectLockPolicy({
    resolveFilePath: (token) => filePolicy.resolveSharedTokenPath(token),
  });
  return { filePolicy, lockPolicy };
}

function createProjectFile(filePath, name) {
  const contents = JSON.stringify({
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    savedBy: 'tester',
    project: { name, generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'tester', updatedAt: '2026-01-01T00:00:00.000Z' },
    chapters: [],
    activity: [],
  });
  fs.writeFileSync(filePath, contents, 'utf8');
}

test('shared lock acquisition is exclusive and provides existing lock details', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const { filePolicy, lockPolicy } = prepareSharedPolicy(root);
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);

  const first = await lockPolicy.acquireSharedProjectLock(token, 'First editor', 'instance-first');
  assert.equal(first.ok, true);
  assert.equal(first.lock?.instanceId, 'instance-first');

  const second = await lockPolicy.acquireSharedProjectLock(token, 'Second editor', 'instance-second');
  assert.equal(second.ok, false);
  assert.equal(second.lock?.instanceId, 'instance-first');
  assert.equal(second.lock?.editorLabel, 'First editor');
});

test('shared lock policy reports readable lock details for read-only fallback', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const { filePolicy, lockPolicy } = prepareSharedPolicy(root);
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);

  const first = await lockPolicy.acquireSharedProjectLock(token, 'First editor', 'instance-first');
  assert.equal(first.ok, true);

  const read = await lockPolicy.readSharedProjectLock(token);
  assert.equal(read.ok, true);
  assert.equal(read.lock?.editorLabel, 'First editor');
  assert.equal(read.lock?.instanceId, 'instance-first');
});

test('shared lock heartbeat updates heartbeatAt on the existing lock', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const filePolicy = createProjectFilePolicy({ userDataPath: root });
  const times = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z'];
  const lockPolicy = createSharedProjectLockPolicy({
    resolveFilePath: (token) => filePolicy.resolveSharedTokenPath(token),
    now: () => times.shift(),
  });
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);

  const first = await lockPolicy.acquireSharedProjectLock(token, 'Editor', 'instance-first');
  assert.equal(first.ok, true);
  assert.equal(typeof first.lock?.acquiredAt, 'string');

  const heartbeat = await lockPolicy.heartbeatSharedProjectLock(token, 'instance-first');
  assert.equal(heartbeat.ok, true);
  assert.equal(heartbeat.lock?.heartbeatAt, '2026-01-01T00:00:10.000Z');
});

test('only owning instance can release a shared lock', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const { filePolicy, lockPolicy } = prepareSharedPolicy(root);
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);

  const first = await lockPolicy.acquireSharedProjectLock(token, 'Owner', 'instance-owner');
  assert.equal(first.ok, true);

  const rejected = await lockPolicy.releaseSharedProjectLock(token, 'someone-else');
  assert.equal(rejected.ok, false);
  const read = await lockPolicy.readSharedProjectLock(token);
  assert.equal(read.ok, true);

  const released = await lockPolicy.releaseSharedProjectLock(token, 'instance-owner');
  assert.equal(released.ok, true);
  const gone = await lockPolicy.readSharedProjectLock(token);
  assert.equal(gone.ok, true);
  assert.equal(gone.lock, null);
});

test('stale lock inspection reads details and does not remove the lock automatically', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const filePolicy = createProjectFilePolicy({ userDataPath: root });
  const lockPolicy = createSharedProjectLockPolicy({
    resolveFilePath: (token) => filePolicy.resolveSharedTokenPath(token),
  });
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);

  const staleLock = {
    format: 'book-editorial-tracker-lock',
    version: 1,
    instanceId: 'stale-instance',
    editorLabel: 'Stale editor',
    acquiredAt: '2026-01-01T00:00:00.000Z',
    heartbeatAt: '2026-01-01T00:00:00.000Z',
  };
  fs.writeFileSync(`${projectPath}.lock`, JSON.stringify(staleLock), 'utf8');

  const read = await lockPolicy.readSharedProjectLock(token);
  assert.equal(read.ok, true);
  assert.equal(read.lock?.instanceId, 'stale-instance');

  const second = await lockPolicy.acquireSharedProjectLock(token, 'Later', 'another-instance');
  assert.equal(second.ok, false);

  const existsAfter = await lockPolicy.readSharedProjectLock(token);
  assert.equal(existsAfter.ok, true);
  assert.equal(existsAfter.lock?.instanceId, 'stale-instance');
});

test('explicit FORCE UNLOCK removes lock with exact confirmation phrase', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const { filePolicy, lockPolicy } = prepareSharedPolicy(root);
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);

  const first = await lockPolicy.acquireSharedProjectLock(token, 'Owner', 'instance-owner');
  assert.equal(first.ok, true);

  const rejected = await lockPolicy.forceUnlockSharedProjectLock(token, 'instance-other', 'FORCE');
  assert.equal(rejected.ok, false);

  const forced = await lockPolicy.forceUnlockSharedProjectLock(token, 'instance-other', 'FORCE UNLOCK');
  assert.equal(forced.ok, true);
  const after = await lockPolicy.readSharedProjectLock(token);
  assert.equal(after.ok, true);
  assert.equal(after.lock, null);
});

test('two synthetic shared clients can rotate from first editor to second editor', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const { filePolicy, lockPolicy } = prepareSharedPolicy(root);
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);

  const first = await lockPolicy.acquireSharedProjectLock(token, 'First editor', 'editor-one');
  assert.equal(first.ok, true);
  const secondAttempt = await lockPolicy.acquireSharedProjectLock(token, 'Second editor', 'editor-two');
  assert.equal(secondAttempt.ok, false);
  assert.equal(secondAttempt.lock?.editorLabel, 'First editor');

  const released = await lockPolicy.releaseSharedProjectLock(token, 'editor-one');
  assert.equal(released.ok, true);

  const second = await lockPolicy.acquireSharedProjectLock(token, 'Second editor', 'editor-two');
  assert.equal(second.ok, true);
  assert.equal(second.lock?.instanceId, 'editor-two');
});

test('shared save rejects a non-owner instance without changing canonical content', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const { filePolicy, lockPolicy } = prepareSharedPolicy(root);
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);
  const original = fs.readFileSync(projectPath, 'utf8');
  const originalHash = hashProjectFileContents(original);

  const first = await lockPolicy.acquireSharedProjectLock(token, 'Owner', 'instance-owner');
  assert.equal(first.ok, true);

  const result = await lockPolicy.saveSharedProjectFile(token, 'instance-other', originalHash, 1, validReplacementContents('Changed project'));
  assert.equal(result.ok, false);
  assert.match(result.message, /owns the shared lock/i);
  assert.equal(fs.readFileSync(projectPath, 'utf8'), original);
});

test('shared save rejects a stale hash without changing canonical content', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const { filePolicy, lockPolicy } = prepareSharedPolicy(root);
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);
  const original = fs.readFileSync(projectPath, 'utf8');

  const first = await lockPolicy.acquireSharedProjectLock(token, 'Owner', 'instance-owner');
  assert.equal(first.ok, true);

  const result = await lockPolicy.saveSharedProjectFile(token, 'instance-owner', '0'.repeat(64), 1, validReplacementContents('Changed project'));
  assert.equal(result.ok, false);
  assert.match(result.message, /changed on disk/i);
  assert.equal(fs.readFileSync(projectPath, 'utf8'), original);
});

test('shared save rejects a stale project revision without changing canonical content', async () => {
  const root = tempRoot();
  const projectPath = path.join(root, 'shared-project.betp.json');
  createProjectFile(projectPath, 'Project');
  const { filePolicy, lockPolicy } = prepareSharedPolicy(root);
  const token = filePolicy.rememberSharedProjectFileForTest(projectPath);
  const original = fs.readFileSync(projectPath, 'utf8');
  const originalHash = hashProjectFileContents(original);

  const first = await lockPolicy.acquireSharedProjectLock(token, 'Owner', 'instance-owner');
  assert.equal(first.ok, true);

  const result = await lockPolicy.saveSharedProjectFile(token, 'instance-owner', originalHash, 0, validReplacementContents('Changed project'));
  assert.equal(result.ok, false);
  assert.match(result.message, /project revision/i);
  assert.equal(fs.readFileSync(projectPath, 'utf8'), original);
});

function validReplacementContents(name) {
  return JSON.stringify({
    format: 'book-editorial-tracker-project',
    version: 1,
    projectRevision: 2,
    savedAt: '2026-01-01T00:01:00.000Z',
    savedBy: 'tester',
    project: { name, generationId: 'g1', startedAt: '2026-01-01T00:00:00.000Z', startedBy: 'tester', updatedAt: '2026-01-01T00:01:00.000Z' },
    chapters: [],
    activity: [],
  });
}
