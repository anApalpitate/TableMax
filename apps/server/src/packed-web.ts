import type { FastifyInstance } from 'fastify';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { brotliDecompress } from 'node:zlib';

const decompress = promisify(brotliDecompress);
const contentTypes = {
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
} as const;

/** Preserve the public URLs and identity response for the packed shared runtime. */
export function registerPackedWeb(app: FastifyInstance, root: string): void {
  for (const directory of ['assets', 'runtime/v1', 'runtime/v1/assets']) {
    const location = join(root, directory);
    if (!existsSync(location)) continue;
    for (const file of readdirSync(location, { withFileTypes: true })) {
      const match = /^([\w-]+\.(js|css))\.br$/.exec(file.name);
      if (!file.isFile() || !match || existsSync(join(location, match[1]!)))
        continue;
      const [name, extension] = match.slice(1) as [
        string,
        keyof typeof contentTypes,
      ];
      app.get('/' + directory + '/' + name, async (_request, reply) => {
        const packed = await readFile(join(location, file.name));
        const data = await decompress(packed, {
          maxOutputLength: 4 * 1024 * 1024,
        });
        return reply.type(contentTypes[extension]).send(data);
      });
    }
  }
}
