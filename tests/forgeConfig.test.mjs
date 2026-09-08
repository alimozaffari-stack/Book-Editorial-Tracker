import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('Forge configuration exposes a Windows maker', async () => {
  const loaded = await import('../forge.config.js');
  const config = loaded.default || loaded;
  assert.ok(config.makers.some((maker) => maker.name === '@electron-forge/maker-squirrel'));
});

test('packaging excludes development source but keeps runtime dependencies', async () => {
  const loaded = await import('../forge.config.js');
  const config = loaded.default || loaded;
  const { findElectronZipDir, shouldIgnorePath } = loaded;
  assert.deepEqual(config.packagerConfig.asar, { unpack: '**/node_modules/**' });
  assert.equal(config.packagerConfig.prune, true);
  assert.deepEqual(config.rebuildConfig.onlyModules, []);
  const electronVersion = require('electron/package.json').version;
  assert.ok(config.packagerConfig.electronZipDir);
  assert.equal(
    existsSync(resolve(config.packagerConfig.electronZipDir, `electron-v${electronVersion}-win32-x64.zip`)),
    true,
  );
  assert.equal(config.packagerConfig.ignore('/node_modules/jszip/package.json'), false);
  assert.equal(config.packagerConfig.ignore('/.kilo/node_modules/example/package.json'), true);
  assert.equal(config.packagerConfig.ignore('/.codex-remote-attachments/upload.jpg'), true);
  assert.equal(config.packagerConfig.ignore('/src/App.tsx'), true);
  assert.equal(config.packagerConfig.ignore('/full_with_lines.txt'), true);
  assert.equal(config.packagerConfig.ignore('/vite.config.ts'), true);
  assert.equal(config.packagerConfig.ignore('/electron/main.cjs'), false);
  assert.equal(config.packagerConfig.ignore('/dist/index.html'), false);
  process.env.VITE_APP_VARIANT = 'public';
  assert.equal(config.packagerConfig.ignore('/firebase-applet-config.json'), true);
  delete process.env.VITE_APP_VARIANT;
});

test('findElectronZipDir locates electron archive in nested cache directory', async () => {
  const loaded = await import('../forge.config.js');
  const { findElectronZipDir } = loaded;
  const electronVersion = require('electron/package.json').version;
  const zipName = `electron-v${electronVersion}-win32-x64.zip`;
  const stagingRoot = mkdtempSync(join(tmpdir(), 'bet-fg-'));
  const zipRoot = join(stagingRoot, 'nested', 'cache', 'v1');
  const zipPath = join(zipRoot, zipName);

  try {
    mkdirSync(zipRoot, { recursive: true });
    writeFileSync(zipPath, '');
    const found = findElectronZipDir(stagingRoot);
    assert.equal(found, zipRoot);
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
});

test('shouldIgnorePath applies variant and workspace boundary rules consistently', async () => {
  const loaded = await import('../forge.config.js');
  const { shouldIgnorePath } = loaded;
  assert.equal(shouldIgnorePath('/.kilo/node_modules/example/package.json'), true);
  assert.equal(shouldIgnorePath('/src/App.tsx'), true);
  assert.equal(shouldIgnorePath('/dist/index.html'), false);
  assert.equal(shouldIgnorePath('/assets/icon.png'), false);
  assert.equal(shouldIgnorePath('/node_modules/jszip/package.json'), false);
  process.env.VITE_APP_VARIANT = 'public';
  try {
    assert.equal(shouldIgnorePath('/firebase-applet-config.json'), true);
  } finally {
    delete process.env.VITE_APP_VARIANT;
  }
});

test('Electron version is known to the Forge ABI registry', () => {
  const electronVersion = require('electron/package.json').version;
  const { getAbi } = require('node-abi');
  assert.doesNotThrow(() => getAbi(electronVersion, 'electron'));
});

test('package declares an existing Electron entry point', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(packageJson.author?.trim());
  assert.ok(packageJson.description?.trim());
  assert.equal(typeof packageJson.main, 'string');
  assert.ok(existsSync(resolve(packageJson.main)));
});

test('desktop and application branding use Book Editorial Tracker', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.equal(packageJson.productName, 'Book Editorial Tracker');
  assert.match(html, /<title>Book Editorial Tracker<\/title>/);
  assert.match(appSource, /Book Editorial Tracker/);
  assert.doesNotMatch(html, /My Google AI Studio App/);
  assert.doesNotMatch(appSource, /Volume Editor Tracker/);
});

test('Squirrel lifecycle creates and removes Windows shortcuts', () => {
  const mainSource = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(mainSource, /--createShortcut/);
  assert.match(mainSource, /--removeShortcut/);
});



test('Windows Electron startup disables hardware acceleration before readiness', () => {
  const mainSource = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(mainSource, /if \(process\.platform === 'win32'\) \{\s*app\.disableHardwareAcceleration\(\);\s*\}/);
});

test('portable build script accepts an explicit output directory', () => {
  const scriptSource = readFileSync(new URL('../scripts/make-portable-exe.mjs', import.meta.url), 'utf8');
  assert.match(scriptSource, /process\.env\.BET_PORTABLE_OUT_DIR/);
});

test('portable build script excludes the root output tree', () => {
  const scriptSource = readFileSync(new URL('../scripts/make-portable-exe.mjs', import.meta.url), 'utf8');
  assert.match(scriptSource, /--ignore=\^out/);
});

test('portable build script invokes the installed packager through Node', () => {
  const scriptSource = readFileSync(new URL('../scripts/make-portable-exe.mjs', import.meta.url), 'utf8');
  assert.match(scriptSource, /node_modules', '@electron', 'packager', 'bin', 'electron-packager\.js/);
  assert.match(scriptSource, /spawnSync\(process\.execPath/);
});

test('desktop Save As supports the bounded Word-compatible summary exports', () => {
  const mainSource = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(mainSource, /json\|csv\|md\|doc/);
  assert.match(mainSource, /Word-compatible document/);
});
