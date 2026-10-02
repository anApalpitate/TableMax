import { build } from 'esbuild';
import { build as buildWeb } from 'vite';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('build/desktop');
const project = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir(output, { recursive: true });
await buildWeb({ configFile: resolve('apps/web/vite.config.ts') });
await build({
  entryPoints: ['apps/server/src/entry.ts'],
  outfile: `${output}/server.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info',
});
await build({
  entryPoints: ['apps/server/src/bot-worker.ts'],
  outfile: `${output}/bot-worker.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info',
});
await build({
  entryPoints: ['apps/desktop/src/preload.ts'],
  outfile: `${output}/preload.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  logLevel: 'info',
});
await build({
  entryPoints: ['apps/desktop/src/main.ts'],
  outfile: `${output}/main.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  logLevel: 'info',
});
await writeFile(
  `${output}/package.json`,
  JSON.stringify(
    {
      name: 'tablemax-desktop',
      version: project.version,
      private: true,
      main: 'main.cjs',
      description: 'TableMax local board-game platform',
      author: 'TableMax',
      license: 'UNLICENSED',
    },
    null,
    2,
  ) + '\n',
);
console.log('Built desktop shell, service, and local web assets.');
