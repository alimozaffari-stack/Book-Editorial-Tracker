import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const releasing = readFileSync(new URL('../docs/RELEASING.md', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('public beta docs describe the current release and storage boundaries', () => {
  assert.ok(existsSync(new URL('../LICENSE', import.meta.url)));
  assert.match(readme, new RegExp(`Version ${packageJson.version.replace(/\./g, '\\.')}`));
  assert.match(readme, /Local project file: one editor at a time\./);
  assert.match(readme, /Shared-folder project: one editor at a time; later conflicting saves are blocked, not merged\./);
  assert.match(readme, /Firebase team: live collaboration using the user'?s own Firebase project\./i);
  assert.match(readme, /selected source documents\/folders are never edited, renamed, moved, or deleted/i);
  assert.match(readme, /public installer contains no owner Firebase configuration/i);
});

test('release docs include checklist commands and current changelog themes', () => {
  assert.match(releasing, /cmd \/c npm test/);
  assert.match(releasing, /cmd \/c npm run lint/);
  assert.match(releasing, /cmd \/c npm run build:public/);
  assert.match(releasing, /node --test tests\/publicPackageArchive\.test\.mjs/);
  assert.match(releasing, /git diff --check/);
  assert.match(releasing, /app\.asar/i);
  assert.match(changelog, new RegExp(`## ${packageJson.version.replace(/\./g, '\\.')}`));
  assert.match(changelog, /scan-based chapter inventory creation/i);
  assert.match(changelog, /public-package Firebase-boundary protection/i);
  assert.match(changelog, /local-mode startup correction/i);
  assert.match(changelog, /storage-choice back navigation/i);
});

test('sidebar version display is sourced from the build-time app version constant', () => {
  assert.match(appSource, /import\.meta\.env\.VITE_APP_VERSION/);
  assert.match(appSource, /Version \{appVersion\}/);
});
