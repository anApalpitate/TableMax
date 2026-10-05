import { GameRegistry } from '@tablemax/platform-core';
import { installedModules, loadInstalledModule } from './module-loader';
export function createGameRegistry(includeTemplate = false) {
  return new GameRegistry(
    installedModules()
      .filter((item) => includeTemplate || !item.internal)
      .map((item) => ({
        catalog: {
          ...item.catalog,
          ...(item.defaultVariantId === undefined
            ? {}
            : {
                defaultVariantId: item.defaultVariantId,
                variants: (item.variants ?? []).map(
                  ({ id, name, description }) => ({ id, name, description }),
                ),
              }),
        },
        load: async (variantId?: string) => {
          const module = {
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
              ? item.compatibility
              : item.variants?.find((v) => v.id === variantId)?.compatibility;
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
          return { rules: selected.rules, bot: selected.bot };
        },
      })),
  );
}
