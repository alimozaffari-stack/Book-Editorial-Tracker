import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { extractFile, listPackage } from '@electron/asar';

function countToken(text, token) {
  if (!text || !token) return 0;
  const sourceText = text.toLowerCase();
  const escaped = token.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  return (sourceText.match(regex) || []).length;
}

test('explicit public app.asar contains runtime files without private configuration or development residue', () => {
  assert.ok(process.env.BET_PUBLIC_ASAR_PATH, 'Set BET_PUBLIC_ASAR_PATH to the exact freshly packaged app.asar.');
  const asarPath = resolve(process.env.BET_PUBLIC_ASAR_PATH);
  assert.equal(existsSync(asarPath), true, `Expected packaged public archive at ${asarPath}.`);

  const archiveText = readFileSync(asarPath).toString('latin1');
  const counts = {
    ownerEmail: countToken(archiveText, 'ali0mozaffari@gmail.com'),
  };
  assert.equal(counts.ownerEmail, 0, 'Public app.asar still contains the owner email.');

  const files = listPackage(asarPath);
  const hasConfig = files.some(f => f.includes('firebase-applet-config.json'));
  assert.equal(hasConfig, false, 'Public app.asar still contains firebase-applet-config.json as a packaged file.');
  const residue = files.filter(file => /(^|[\\/])(?:\.git|\.codex|\.codex-remote-attachments|\.kilo|user-data|tests|src)(?:[\\/]|$)/i.test(file)
    && !/^[\\/]node_modules[\\/]/i.test(file));
  assert.deepEqual(residue, [], 'Package contains development or user-data residue');
  assert.equal(files.some(file => /(?:project-file-tokens\.json|\.betp\.json|\.env(?:\.local)?)$/i.test(file)), false);
  const manifest = JSON.parse(extractFile(asarPath, 'package.json').toString('utf8'));
  const expectedManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, expectedManifest.version, 'Package version must match the checked source');
  assert.ok(files.some(file => file.replaceAll('\\', '/') === '/dist/index.html'));
  assert.ok(files.some(file => file.replaceAll('\\', '/') === '/electron/main.cjs'));
  assert.ok(files.some(file => file.replaceAll('\\', '/') === '/node_modules/jszip/package.json'), 'JSZip runtime dependency is required');
  for (const runtimeFile of ['dist/index.html', 'electron/main.cjs']) {
    const contents = extractFile(asarPath, runtimeFile).toString('utf8');
    assert.doesNotMatch(contents, /AIza[0-9A-Za-z_-]{35}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/);
  }
});
