import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { URL } from 'node:url';

// Deliberately no SPA fallback, rewrite, directory listing or Firebase credentials.
const root = resolve('dist/da-bubble/browser');
const port = Number(process.argv[2] ?? 4302);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};
/** Resolves existing assets without interpreting Angular routes or hidden server files. */
async function assetPath(url) {
  const path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  let file = resolve(root, '.' + path);
  const outside = file !== root && !file.startsWith(root + sep);
  if (outside || path.split('/').some((part) => part.startsWith('.')))
    throw new Error('Forbidden path');
  if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
  return file;
}

/** Returns explicit content types without caching outdated local build assets. */
function respond(response, status, type, body) {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
}

/** Models FTP hosting that serves files and returns a genuine 404 for missing paths. */
async function serve(request, response) {
  try {
    const file = await assetPath(request.url);
    const body = await readFile(file);
    respond(response, 200, types[extname(file)] ?? 'application/octet-stream', body);
  } catch {
    respond(response, 404, 'text/plain', 'Not found');
  }
}

createServer(serve).listen(port, '127.0.0.1', () =>
  console.log(`Static build without rewrite: http://127.0.0.1:${port}`),
);
