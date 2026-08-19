import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

function shouldIgnorePath(resourcePath) {
  const normalizedPath = String(resourcePath).replaceAll('\\', '/');
  if (/(^|\/)node_modules(\/|$)/i.test(normalizedPath)) return true;
  if (/(^|\/)(src|tests|docs|coverage|evidence)(\/|$)/i.test(normalizedPath)) return true;
  if (/(^|\/)(\.git|out|graphify-index-app|graphify-index-manuscript|graphify-out|\.code-review-graph)(\/|$)/i.test(normalizedPath)) return true;
  if (/(^|\/)\.vscode(\/|$)/i.test(normalizedPath)) return true;
  if (/(^|\/).*\.(txt|log|csv|md)$/i.test(normalizedPath)) return true;
  if (/(^|\/)(metadata\.json|firebase-blueprint\.json|tokens\.css|lint-output\.txt|bun\.lock|package-lock\.json|vite\.config\.ts|forge\.config\.js|firebase\.json)$/i.test(normalizedPath)) return true;
  if (process.env.VITE_APP_VARIANT === 'public' && /(^|\/)firebase-applet-config\.json$/i.test(normalizedPath)) return true;
  return false;
}

export default {
  packagerConfig: {
    asar: true,
    prune: false,
    icon: './assets/editorial-review-tracker.ico',
    ignore: shouldIgnorePath,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: './assets/editorial-review-tracker.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
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
