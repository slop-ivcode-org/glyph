'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.obj': 'text/plain' };
const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Invalid URL');
    return;
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  fs.realpath(file, (error, realFile) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end('File unavailable');
      return;
    }
    const realRelative = path.relative(root, realFile);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    fs.stat(realFile, (statError, stat) => {
      if (statError || !stat.isFile()) {
        response.writeHead(statError ? 500 : 404);
        response.end('File unavailable');
        return;
      }
      response.writeHead(200, {
        'Content-Type': `${types[path.extname(realFile).toLowerCase()] || 'application/octet-stream'}; charset=utf-8`,
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
      });
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = fs.createReadStream(realFile);
      stream.on('error', error => { console.error(error.message); response.destroy(error); });
      stream.pipe(response);
    });
  });
});
server.on('error', error => { console.error(`Could not start server: ${error.message}`); process.exitCode = 1; });
server.listen(8080, '127.0.0.1', () => console.log('GLYPH: http://localhost:8080 (Ctrl+C to stop)'));
