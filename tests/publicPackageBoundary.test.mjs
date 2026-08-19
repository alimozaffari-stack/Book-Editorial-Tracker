import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function countToken(text, token) {
  if (!text || !token) return 0;
  const sourceText = text.toLowerCase();
  const escaped = token.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  return (sourceText.match(regex) || []).length;
}

function readText(filePath) {
  return readFileSync(filePath, 'utf8');
}

function assertNoSecretTokens(textSource, token, description) {
  assert.equal(countToken(textSource, token), 0, `Source contains ${description}.`);
}

const ROOT = new URL('..', import.meta.url);

test('public package boundary rejects owner project identity and secrets in public packaging artifacts', () => {
  const packageJson = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
  const forgeConfig = readFileSync(new URL('forge.config.js', ROOT), 'utf8');
  const setupSource = readFileSync(new URL('src/components/FirebaseSetupView.tsx', ROOT), 'utf8');
  const appSource = readFileSync(new URL('src/App.tsx', ROOT), 'utf8');
  const mainSource = readFileSync(new URL('electron/main.cjs', ROOT), 'utf8');
  const ownerConfig = JSON.parse(readFileSync(new URL('firebase-applet-config.json', ROOT), 'utf8'));
  const ownerProjectId = ownerConfig.projectId;
  const ownerApiKey = ownerConfig.apiKey;
  const ownerEmail = 'ali0mozaffari@gmail.com';

  assert.equal(packageJson.scripts['build:public'], 'set VITE_APP_VARIANT=public&&vite build');
  assert.equal(packageJson.scripts['make:public'], 'set VITE_APP_VARIANT=public&&electron-forge make');
  assert.match(forgeConfig, /process\.env\.VITE_APP_VARIANT === 'public'/);
  assert.match(
    forgeConfig,
    /process\.env\.VITE_APP_VARIANT === 'public'[\s\S]*firebase-applet-config\\.json\$/i,
  );
  assert.match(setupSource, /Set up your own Firebase project/);
  assert.match(setupSource, /enable Firebase Authentication and Firestore/i);
  assert.match(setupSource, /deploy the supplied Firestore rules yourself/i);

  assertNoSecretTokens(appSource, ownerProjectId, 'owner project id');
  assertNoSecretTokens(appSource, ownerApiKey, 'owner api key');
  assertNoSecretTokens(appSource, ownerEmail, 'owner email');
  assertNoSecretTokens(appSource, 'firebase-applet-config.json', 'forbidden config filename');
  assert.doesNotMatch(mainSource, /require\('\.\.\/firebase-applet-config\.json'\)/);
});
