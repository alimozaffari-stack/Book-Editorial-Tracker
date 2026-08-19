const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const { startLocalAppServer } = require('../electron/local-server.cjs');

test('serves the packaged application from a stable localhost origin (port 43119)', async (t) => {
  const inputPath = path.resolve(__dirname, '..', 'index.html');
  const messages = [];
  const instance = await startLocalAppServer(inputPath, (message) => messages.push(message));
  t.after(() => instance.server.close());

  // The server should bind to the fixed stable origin.
  assert.equal(instance.url, 'http://localhost:43119');
  const response = await fetch(instance.url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<html/);
  assert.ok(messages.some((message) => message.includes(`input=${inputPath}`)));
});

test('does not expose arbitrary files beside the packaged application', async (t) => {
  const inputPath = path.resolve(__dirname, '..', 'index.html');
  const instance = await startLocalAppServer(inputPath);
  t.after(() => instance.server.close());

  const response = await fetch(`${instance.url}/package.json`);
  assert.equal(response.status, 404);
});

test('fails to start when the stable port is already in use', async (t) => {
  const http = require('node:http');
  const inputPath = path.resolve(__dirname, '..', 'index.html');
  // Occupy the stable port.
  const occupied = http.createServer(() => {});
  await new Promise((resolve, reject) => {
    occupied.once('error', reject);
    occupied.listen(43119, '127.0.0.1', resolve);
  });
  const messages = [];
  // Attempt to start another server on the same port; it should reject.
  await assert.rejects(
    startLocalAppServer(inputPath, (msg) => messages.push(msg), 43119),
    /EADDRINUSE/
  );
  // Verify that a readable error was logged.
  assert.ok(messages.some((m) => m.includes('local_server_error')));
  occupied.close();
});
