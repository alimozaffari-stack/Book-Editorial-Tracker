const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { isPathInsideRoot, isPathInsideResolvedRoot } = require('../electron/project-path-policy.cjs');

test('blocks Save As targets inside the selected project root', () => {
  const root = path.resolve('G:\\My Drive\\Book');
  assert.equal(isPathInsideRoot(root, path.join(root, 'report.csv')), true);
  assert.equal(isPathInsideRoot(root, path.resolve('C:\\Exports\\report.csv')), false);
});

test('blocks a Save As destination whose resolved parent aliases the selected root', () => {
  const root = path.resolve(String.raw`G:\My Drive\Book`);
  const aliases = new Map([
    [root, root],
    [path.resolve(String.raw`C:\AliasIntoBook`), root],
  ]);
  const realpath = target => aliases.get(path.resolve(target)) ?? target;
  assert.equal(isPathInsideResolvedRoot(root, path.resolve(String.raw`C:\AliasIntoBook\report.csv`), realpath), true);
});
