import { createRequire } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findElectronZipDir } from '../forge.config.js';

const require = createRequire(import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const variant = process.env.VITE_APP_VARIANT || 'public';

const electronVersion = require('electron/package.json').version;
const electronZipDir =
  process.env.ELECTRON_ZIP_DIR ||
  findElectronZipDir(
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'electron', 'Cache') : undefined,
  );

if (!electronZipDir) {
  throw new Error('Local Electron ZIP cache could not be located. Set ELECTRON_ZIP_DIR explicitly.');
}

const outDir = process.env.BET_PORTABLE_OUT_DIR || (variant === 'team' ? 'out\\portable-exe\\team' : 'out\\portable-exe\\public');

const args = [
  '.',
  packageJson.productName,
  '--platform=win32',
  '--arch=x64',
  `--out=${outDir}`,
  '--overwrite',
  `--electron-version=${electronVersion}`,
  `--electron-zip-dir=${electronZipDir}`,
  '--asar',
  '--prune=true',
  '--icon=assets/editorial-review-tracker.ico',
  '--ignore=^\\.git$',
  '--ignore=^out(?:[\\\\/]|$)',
  '--ignore=.*[\\\\/]out(?:[\\\\/]|$)',
  '--ignore=.*[\\\\/]\\.tmp_[^\\\\/]+(?:[\\\\/]|$)',
  '--ignore=^\\.tmp_bet_make$',
  '--ignore=^\\.tmp_bet_stage$',
  '--ignore=^\\.tmp_bet_stage_log\\.txt$',
  '--ignore=^\\.tmp_build\\.log$',
  '--ignore=^\\.tmp_grep\\.cjs$',
  '--ignore=^\\.tmp_read\\.cjs$',
  '--ignore=^\\.tmp_staging_bet\\.log$',
  '--ignore=^\\.tmp_test\\.log$',
  '--ignore=^\\.code-review-graph$',
  '--ignore=^dist$',
  '--ignore=^tests$',
  '--ignore=^docs$',
  '--ignore=^node_modules/\\.bin$',
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const vitePath = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const packagerPath = path.join(rootDir, 'node_modules', '@electron', 'packager', 'bin', 'electron-packager.js');

const buildResult = spawnSync(process.execPath, [vitePath, 'build'], {
  cwd: rootDir,
  env: { ...process.env, VITE_APP_VARIANT: variant },
  stdio: 'inherit',
  shell: false,
  windowsHide: false,
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const result = spawnSync(process.execPath, [packagerPath, ...args], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
  windowsHide: false,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
