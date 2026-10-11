import type {
  GameCatalogEntry,
  GameDetails,
  GameWebManifest,
  ModuleManifest,
  RuntimeModuleManifest,
} from './module-manifest';
export type {
  GameCatalogEntry,
  GameDetails,
  GameWebManifest,
  RuntimeModuleManifest,
} from './module-manifest';

export function projectGameCatalog(
  module: ModuleManifest,
  cover?: string | null,
): GameCatalogEntry;
export function projectGameDetails(
  module: ModuleManifest | GameDetails,
): GameDetails;
export function projectGameRuntime(
  module: ModuleManifest,
  overrides?: Partial<
    Pick<ModuleManifest, 'cover' | 'entries' | 'details' | 'styles'>
  >,
): RuntimeModuleManifest;
export function projectGameWeb(module: ModuleManifest): GameWebManifest;
