import {
  projectGameCatalog,
  type GameCatalogEntry,
} from '@tablemax/game-sdk/metadata';
import type { ModuleManifest } from '@tablemax/game-sdk/module-manifest';
const definitions = import.meta.glob<ModuleManifest>(
  '../../../games/*/game-module.json',
  { eager: true, import: 'default' },
);
const covers = import.meta.glob<string>('../../../assets/games/*/cover*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
export const moduleCatalog: GameCatalogEntry[] = Object.values(definitions)
  .sort((a, b) => a.order - b.order)
  .map((item) =>
    projectGameCatalog(item, covers['../../../' + item.cover] ?? null),
  );
export const moduleFor = (id: string | undefined) =>
  moduleCatalog.find((item) => item.id === id);
