import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

export async function serveFixture(directory) {
  const root = resolve(directory);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.ogg': 'audio/ogg',
  };
  const server = createServer(async (request, response) => {
    try {
      const requested = decodeURIComponent(
        new URL(request.url, 'http://127.0.0.1').pathname,
      );
      const file = resolve(
        root,
        '.' + (requested === '/' ? '/index.html' : requested),
      );
      if (!file.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      const data = await readFile(file);
      response
        .writeHead(200, {
          'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        })
        .end(data);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  return {
    url: 'http://127.0.0.1:' + server.address().port + '/index.html',
    close: () => new Promise((done) => server.close(done)),
  };
}
