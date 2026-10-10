import type { ModuleManifest } from '../../../packages/game-sdk/src/module-manifest';
const definitions = import.meta.glob<ModuleManifest>(
  '../../../games/*/game-module.json',
  { eager: true, import: 'default' },
);
const covers = import.meta.glob<string>(
  '../../../assets/games/*/cover-*.webp',
  { eager: true, query: '?url', import: 'default' },
);
export const moduleCatalog: ModuleManifest[] = Object.values(definitions)
  .sort((a, b) => a.order - b.order)
  .map((item) => ({
    ...item,
    cover: covers['../../../' + item.cover] ?? null,
  }));
export const moduleFor = (id: string | undefined) =>
  moduleCatalog.find((item) => item.id === id);
