const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPreloadApi() {
  const source = fs.readFileSync(path.resolve(__dirname, '../electron/preload.cjs'), 'utf8');
  const calls = [];
  let exposed;
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, api) {
        exposed = { name, api };
      },
    },
    ipcRenderer: {
      invoke(channel, ...args) {
        calls.push([channel, ...args]);
        return Promise.resolve(null);
      },
    },
  };
  const sandbox = {
    require(id) {
      if (id === 'electron') return electron;
      throw new Error(`Unexpected preload dependency: ${id}`);
    },
  };

  vm.runInNewContext(source, sandbox, { filename: 'electron/preload.cjs' });
  return { exposed, calls };
}

test('desktop preload exposes the complete project-folder intake API', async () => {
  const { exposed, calls } = loadPreloadApi();
  assert.equal(exposed.name, 'editorialTracker');

  await exposed.api.scanProjectFolder();
  await exposed.api.resumeProjectFolder();
  await exposed.api.inspectProjectDocx('CH01/Initial/file.docx');
  await exposed.api.forgetProjectFolder();
  await exposed.api.openFolderForFile('C:\\Reports\\scan.csv');

  assert.deepEqual(calls, [
    ['scan-project-folder'],
    ['resume-project-folder'],
    ['inspect-project-docx', 'CH01/Initial/file.docx'],
    ['forget-project-folder'],
    ['open-folder-for-file', 'C:\\Reports\\scan.csv'],
  ]);
});

test('desktop preload sends Save As exports in the main-process payload shape', async () => {
  const { exposed, calls } = loadPreloadApi();

  await exposed.api.saveLocalExport('report.csv', 'chapter_id,title');

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'save-local-export');
  assert.equal(calls[0][1].filename, 'report.csv');
  assert.equal(calls[0][1].contents, 'chapter_id,title');
});

test('desktop preload forwards bounded manuscript compiler requests', async () => {
  const { exposed, calls } = loadPreloadApi();
  const request = { format: 'docx', projectName: 'Book', chapters: [] };

  await exposed.api.compileManuscript(request);

  assert.deepEqual(calls, [['compile-manuscript', request]]);
});
