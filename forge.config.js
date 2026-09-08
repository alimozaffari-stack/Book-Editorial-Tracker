import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const require = createRequire(import.meta.url);
const electronVersion = require('electron/package.json').version;
const electronZipName = `electron-v${electronVersion}-win32-x64.zip`;

function findElectronZipDir(cacheRoot) {
  if (!cacheRoot || !fs.existsSync(cacheRoot)) return undefined;
  const stack = [cacheRoot];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name === electronZipName) {
        return currentDir;
      }
    }
  }
  return undefined;
}

const electronZipDir = findElectronZipDir(
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'electron', 'Cache') : undefined,
);
const forgeOutDir = process.env.BET_FORGE_OUT_DIR
  ? path.resolve(process.env.BET_FORGE_OUT_DIR)
  : undefined;
const makeProfile = process.env.BET_MAKE_PROFILE ?? 'squirrel';
const includeSquirrelMaker = makeProfile !== 'zip-only';
const useLegacyAsarConfig = makeProfile === 'squirrel-no-asar' || makeProfile === 'installer-legacy';
const asarConfig = useLegacyAsarConfig ? true : { unpack: '**/node_modules/**' };

function shouldIgnorePath(resourcePath) {
  const normalizedPath = String(resourcePath).replaceAll('\\', '/');
  if (/(^|\/)\.(agents|codex|codex-remote-attachments|kilo)(\/|$)/i.test(normalizedPath)) return true;
  if (/(^|\/)(src|tests|docs|coverage|evidence)(\/|$)/i.test(normalizedPath)) return true;
  if (/(^|\/)(\.git|out|graphify-index-app|graphify-index-manuscript|graphify-out|\.code-review-graph)(\/|$)/i.test(normalizedPath)) return true;
  if (/(^|\/)\.vscode(\/|$)/i.test(normalizedPath)) return true;
  if (/(^|\/).*\.(txt|log|csv|md)$/i.test(normalizedPath)) return true;
  if (/(^|\/)(metadata\.json|firebase-blueprint\.json|tokens\.css|lint-output\.txt|bun\.lock|package-lock\.json|vite\.config\.ts|forge\.config\.js|firebase\.json)$/i.test(normalizedPath)) return true;
  if (process.env.VITE_APP_VARIANT === 'public' && /(^|\/)firebase-applet-config\.json$/i.test(normalizedPath)) return true;
  return false;
}

export default {
  ...(forgeOutDir ? { outDir: forgeOutDir } : {}),
  packagerConfig: {
    // NuGet cannot package the large monolithic archive produced when all
    // runtime modules are inside app.asar. Keep application code in ASAR and
    // place runtime modules in app.asar.unpacked for Squirrel to package.
    asar: asarConfig,
    // Keep declared runtime dependencies such as jszip, but do not embed the
    // development toolchain in the application archive.
    prune: true,
    icon: './assets/editorial-review-tracker.ico',
    ...(electronZipDir ? { electronZipDir } : {}),
    ignore: shouldIgnorePath,
  },
  rebuildConfig: {
    onlyModules: [],
  },
  makers: [
    ...(includeSquirrelMaker
      ? [
          {
            name: '@electron-forge/maker-squirrel',
            config: {
              setupIcon: './assets/editorial-review-tracker.ico',
            },
          },
        ]
      : []),
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export { findElectronZipDir, shouldIgnorePath };
