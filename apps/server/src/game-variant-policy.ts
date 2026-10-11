import type {
  GameCatalogEntry,
  ModuleManifest,
} from '@tablemax/game-sdk/module-manifest';
import { availableModules } from './module-loader';

export function retiredVariantPolicies(seed = availableModules()) {
  return new Map(
    seed.map((module) => [module.id, new Set(module.retiredVariantIds ?? [])]),
  );
}
export function retiredVariant(
  gameId: string,
  variantId: string | undefined,
  policies: ReturnType<typeof retiredVariantPolicies>,
) {
  return variantId !== undefined && !!policies.get(gameId)?.has(variantId);
}
/** Filter copies only: historical signed descriptors and package bytes are immutable. */
export function currentCatalogModules(
  items: (GameCatalogEntry | ModuleManifest)[],
  policies: ReturnType<typeof retiredVariantPolicies>,
) {
  const modules = new Map<string, GameCatalogEntry | ModuleManifest>();
  for (const item of items) {
    const variants = item.variants?.filter(
      (v) => !retiredVariant(item.id, v.id, policies),
    );
    if (item.variants?.length && !variants?.length) continue;
    modules.set(
      item.id,
      variants
        ? {
            ...item,
            variants,
            defaultVariantId: variants.some(
              (v) => v.id === item.defaultVariantId,
            )
              ? item.defaultVariantId!
              : variants[0]!.id,
          }
        : item,
    );
  }
  return [...modules.values()];
}
