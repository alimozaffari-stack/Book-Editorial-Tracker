import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { listPackage } from '@electron/asar';

function countToken(text, token) {
  if (!text || !token) return 0;
  const sourceText = text.toLowerCase();
  const escaped = token.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  return (sourceText.match(regex) || []).length;
}

test('public app.asar contains no owner Firebase identifiers or config filename', () => {
  const asarPath = resolve('out', 'Book Editorial Tracker-win32-x64', 'resources', 'app.asar');
  assert.equal(existsSync(asarPath), true, `Expected packaged public archive at ${asarPath}.`);

  const ownerConfig = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8'));
  const archiveText = readFileSync(asarPath).toString('latin1');
  const counts = {
    ownerProjectId: countToken(archiveText, ownerConfig.projectId),
    ownerApiKey: countToken(archiveText, ownerConfig.apiKey),
    ownerEmail: countToken(archiveText, 'ali0mozaffari@gmail.com'),
  };

  assert.equal(counts.ownerProjectId, 0, 'Public app.asar still contains the owner project identifier.');
  assert.equal(counts.ownerApiKey, 0, 'Public app.asar still contains the owner API key.');
  assert.equal(counts.ownerEmail, 0, 'Public app.asar still contains the owner email.');

  const files = listPackage(asarPath);
  const hasConfig = files.some(f => f.includes('firebase-applet-config.json'));
  assert.equal(hasConfig, false, 'Public app.asar still contains firebase-applet-config.json as a packaged file.');
});
