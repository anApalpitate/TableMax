import { GameRegistry } from '@tablemax/platform-core';
import { installedModules, loadInstalledModule } from './module-loader';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { PackageStore } from './game-packages/store';
export function createGameRegistry(
  includeTemplate = false,
  store?: PackageStore,
) {
  return new GameRegistry(
    [
      ...new Map(
        [
          ...installedModules(),
          ...(store
            ? [
                ...store.snapshot().catalog.releases.map((r) => r.module),
                ...Object.values(store.snapshot().index.releases).map(
                  (r) => r.module,
                ),
              ]
            : []),
        ].map((item) => [item.id, item]),
      ).values(),
    ]
      .filter((item) => includeTemplate || !item.internal)
      .map((item) => {
        const usable = (variantId: string) => {
          const release = store?.selected(item.id, variantId);
          return release && store?.resolveModule(release.releaseId);
        };
        const defaultVariantId =
          store && item.defaultVariantId && !usable(item.defaultVariantId)
            ? (item.variants?.find((variant) => usable(variant.id))?.id ??
              item.defaultVariantId)
            : item.defaultVariantId;
        return {
          catalog: {
            ...item.catalog,
            ...(defaultVariantId === undefined
              ? {}
              : {
                  defaultVariantId,
                  variants: (item.variants ?? []).map(
                    ({ id, name, description }) => ({ id, name, description }),
                  ),
                }),
          },
          load: async (variantId?: string, releaseRef?: string) => {
            const ref =
              releaseRef ?? store?.selected(item.id, variantId)?.releaseId;
            const installed = ref ? store?.resolveModule(ref) : undefined;
            if (store && !installed) throw new Error('missing-game-release');
            if (
              installed &&
              (installed.release.gameId !== item.id ||
                installed.release.variantId !== variantId)
            )
              throw new Error('incompatible-game-variant');
            const descriptor = installed?.release.module ?? item;
            const module = installed
              ? {
                  ...createRequire(join(installed.root, 'loader.cjs'))(
                    './' + descriptor.entries.rules,
                  ),
                  ...createRequire(join(installed.root, 'loader.cjs'))(
                    './' + descriptor.entries.bot,
                  ),
                }
              : {
                  ...(await loadInstalledModule(item.id, 'rules')),
                  ...(await loadInstalledModule(item.id, 'bot')),
                };
            const exports = module as typeof module & {
              rulesByVariant?: Record<string, typeof module.rules>;
              botsByVariant?: Record<string, typeof module.bot>;
            };
            const selected =
              variantId === undefined
                ? module
                : {
                    rules: exports.rulesByVariant?.[variantId],
                    bot: exports.botsByVariant?.[variantId],
                  };
            if (!selected.rules || !selected.bot)
              throw new Error('incompatible-game-variant');
            const expected =
              variantId === undefined
                ? descriptor.compatibility
                : descriptor.variants?.find((v) => v.id === variantId)
                    ?.compatibility;
            if (!expected) throw new Error('incompatible-game-variant');
            const actual = selected.rules.manifest;
            if (
              actual.id !== item.id ||
              actual.players.min !== item.catalog.min ||
              actual.players.max !== item.catalog.max ||
              actual.rulesVersion !== expected.rulesVersion ||
              actual.stateVersion !== expected.stateVersion ||
              actual.sdkVersion !== expected.sdk ||
              actual.gameVersion !== expected.gameVersion ||
              selected.bot.version !== expected.strategyVersion ||
              selected.bot.rulesVersion !== expected.rulesVersion
            )
              throw new Error('incompatible-game-module');
            return {
              rules: selected.rules,
              bot: selected.bot,
              ...(ref ? { releaseRef: ref } : {}),
            };
          },
        };
      }),
  );
}
