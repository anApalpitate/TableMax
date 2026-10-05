import { build } from 'esbuild';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
/** Real independent rules/strategies for a standalone service test directory. */
export async function prepareModuleFixture(directory: string) {
  const modules = [];
  const entryPoints: Record<string, string> = {};
  for (const entry of await readdir(resolve('games'), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    let item;
    try {
      item = JSON.parse(
        await readFile(
          resolve('games', entry.name, 'game-module.json'),
          'utf8',
        ),
      );
    } catch {
      continue;
    }
    entryPoints['games/' + item.id] = resolve(item.entries.rules);
    entryPoints['bots/' + item.id] = resolve(item.entries.bot);
    modules.push({
      ...item,
      entries: {
        ...item.entries,
        rules: 'games/' + item.id + '.cjs',
        bot: 'bots/' + item.id + '.cjs',
      },
    });
  }
  await build({
    entryPoints,
    outdir: directory,
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'silent',
  });
  await writeFile(join(directory, 'modules.json'), JSON.stringify(modules));
}
