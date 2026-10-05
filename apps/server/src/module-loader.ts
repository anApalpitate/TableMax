import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { ModuleManifest } from '../../../packages/game-sdk/src/module-manifest';
import type { LoadedGame } from '@tablemax/platform-core';
const compiled = typeof __filename === 'string' && __filename.endsWith('.cjs');
const root = compiled ? __dirname : resolve('.');
export function installedModules(): ModuleManifest[] {
  let items: ModuleManifest[];
  if (compiled)
    items = JSON.parse(readFileSync(join(root, 'modules.json'), 'utf8'));
  else
    items = readdirSync(resolve('games'), { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() &&
          existsSync(resolve('games', e.name, 'game-module.json')),
      )
      .map((e) =>
        JSON.parse(
          readFileSync(resolve('games', e.name, 'game-module.json'), 'utf8'),
        ),
      );
  for (const item of items) {
    if (
      item.schemaVersion !== 1 ||
      !/^[a-z][a-z0-9-]*$/.test(item.id) ||
      item.compatibility.sdk !== 1 ||
      item.compatibility.protocol !== 6 ||
      item.compatibility.webHost !== 1
    )
      throw new Error('incompatible-game-module');
  }
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new Error('duplicate-game-module');
  return items.sort((a, b) => a.order - b.order);
}
export async function loadInstalledModule(
  id: string,
  part: 'rules' | 'bot',
): Promise<LoadedGame> {
  const item = installedModules().find((e) => e.id === id);
  if (!item) throw new Error('uninstalled-game');
  const entry = item.entries[part];
  if (
    compiled &&
    (entry.includes('..') ||
      entry.startsWith('/') ||
      entry.includes('\\') ||
      !entry.startsWith((part === 'rules' ? 'games' : 'bots') + '/'))
  )
    throw new Error('invalid-module-path');
  if (compiled)
    return createRequire(join(root, 'module-loader.cjs'))(
      './' + entry,
    ) as LoadedGame;
  return import(pathToFileURL(resolve(entry)).href) as Promise<LoadedGame>;
}
