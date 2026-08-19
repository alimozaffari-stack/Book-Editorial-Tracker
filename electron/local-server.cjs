const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

/**
 * Start a local HTTP server that serves the packaged Electron application.
 * By default it binds to a stable origin `127.0.0.1:43119` to satisfy the
 * authentication persistence requirements. Callers may request a random port
 * by passing `0` as the `port` argument.
 *
 * @param {string} inputPath - Absolute path to the built `index.html` file.
 * @param {function(string):void} log - Optional logger function.
 * @param {number} [port=43119] - TCP port to bind. Use `0` for an OS-assigned port.
 * @returns {Promise<{server: import('node:http').Server, url: string}>}
 */
function startLocalAppServer(inputPath, log = () => {}, port = 43119) {
  if (!path.isAbsolute(inputPath)) {
    throw new Error(`Application input path must be absolute: ${inputPath}`);
  }

  let requests = 0;
  let failures = 0;
  const server = http.createServer((request, response) => {
    requests += 1;
    const requestPath = new URL(request.url || '/', 'http://localhost').pathname;
    if (request.method !== 'GET' || !['/', '/index.html'].includes(requestPath)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    fs.readFile(inputPath, (error, contents) => {
      if (error) {
        failures += 1;
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Application could not be loaded');
        log(`local_server_read_failed input=${inputPath} requests=${requests} failures=${failures}`);
        return;
      }

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(contents);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      // Log a readable startup error before rejecting.
      log(`local_server_error input=${inputPath} error=${err.message}`);
      reject(err);
    });
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Local application server did not receive a TCP port'));
        return;
      }
      const url = `http://localhost:${address.port}`;
      log(`local_server_started input=${inputPath} output=${url} requests=0 failures=0`);
      resolve({ server, url });
    });
  });
}

module.exports = { startLocalAppServer };
