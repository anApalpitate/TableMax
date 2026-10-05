import { GameRegistry } from '@tablemax/platform-core';
import { installedModules, loadInstalledModule } from './module-loader';
export function createGameRegistry(includeTemplate = false) {
  return new GameRegistry(
    installedModules()
      .filter((item) => includeTemplate || !item.internal)
      .map((item) => ({
        catalog: item.catalog,
        load: async () => {
          const module = {
            ...(await loadInstalledModule(item.id, 'rules')),
            ...(await loadInstalledModule(item.id, 'bot')),
          };
          const actual = module.rules.manifest;
          if (
            actual.id !== item.id ||
            actual.players.min !== item.catalog.min ||
            actual.players.max !== item.catalog.max ||
            actual.rulesVersion !== item.compatibility.rulesVersion ||
            actual.stateVersion !== item.compatibility.stateVersion ||
            actual.sdkVersion !== item.compatibility.sdk ||
            actual.gameVersion !== item.compatibility.gameVersion ||
            module.bot.version !== item.compatibility.strategyVersion ||
            module.bot.rulesVersion !== item.compatibility.rulesVersion
          )
            throw new Error('incompatible-game-module');
          return module;
        },
      })),
  );
}
