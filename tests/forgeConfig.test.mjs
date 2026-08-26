import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('Forge configuration exposes a Windows maker', async () => {
  const loaded = await import('../forge.config.js');
  const config = loaded.default || loaded;
  assert.ok(config.makers.some((maker) => maker.name === '@electron-forge/maker-squirrel'));
});

test('packaging excludes development source and node_modules', async () => {
  const loaded = await import('../forge.config.js');
  const config = loaded.default || loaded;
  assert.equal(config.packagerConfig.ignore('/node_modules/firebase/package.json'), true);
  assert.equal(config.packagerConfig.ignore('/src/App.tsx'), true);
  assert.equal(config.packagerConfig.ignore('/full_with_lines.txt'), true);
  assert.equal(config.packagerConfig.ignore('/vite.config.ts'), true);
  assert.equal(config.packagerConfig.ignore('/electron/main.cjs'), false);
  assert.equal(config.packagerConfig.ignore('/dist/index.html'), false);
  process.env.VITE_APP_VARIANT = 'public';
  assert.equal(config.packagerConfig.ignore('/firebase-applet-config.json'), true);
  delete process.env.VITE_APP_VARIANT;
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



test('desktop Save As supports the bounded Word-compatible summary exports', () => {
  const mainSource = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(mainSource, /json\|csv\|md\|doc/);
  assert.match(mainSource, /Word-compatible document/);
});
