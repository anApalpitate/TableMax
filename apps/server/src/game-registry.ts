import { GameRegistry } from '@tablemax/platform-core';
import {
  availableModules,
  installedModules,
  loadInstalledModule,
} from './module-loader';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { PackageStore } from './game-packages/store';
import type { GameRules, BotStrategy } from '@tablemax/game-sdk';
import type { Save } from '@tablemax/platform-core';
import {
  currentCatalogModules,
  retiredVariantPolicies,
} from './game-variant-policy';
import type {
  GameCatalogEntry,
  ModuleManifest,
} from '@tablemax/game-sdk/module-manifest';
const isRuntimeModule = (
  item: GameCatalogEntry | ModuleManifest,
): item is ModuleManifest => 'entries' in item && 'compatibility' in item;
export function createGameRegistry(
  includeTemplate = false,
  store?: PackageStore,
) {
  const snapshot = store?.snapshot();
  const seed = store ? availableModules() : installedModules();
  const policies = retiredVariantPolicies(seed);
  const current = currentCatalogModules(seed, policies);
  const currentIds = new Set(current.map((item) => item.id));
  const historical = snapshot
    ? Object.values(snapshot.index.releases)
        .filter((release) => !currentIds.has(release.gameId))
        .map((release) => release.module)
    : [];
  const entries = new Map(
    [...historical, ...current].map((item) => [item.id, item]),
  );
  return new GameRegistry(
    [...entries.values()]
      .filter((item) => includeTemplate || !item.internal)
      .map((item) => {
        const defaultVariantId = item.defaultVariantId;
        const load = async (
          variantId?: string,
          releaseRef?: string,
          saved?: Save,
        ) => {
          const ref =
            releaseRef ?? store?.current(item.id, variantId)?.releaseId;
          const installed = ref ? store?.resolveModule(ref) : undefined;
          if (store && !installed) throw new Error('missing-game-release');
          if (
            !saved &&
            store &&
            ref !== store.current(item.id, variantId)?.releaseId
          )
            throw new Error('incompatible-game-release');
          const descriptor = installed?.release.module ?? item;
          if (!isRuntimeModule(descriptor))
            throw new Error('missing-game-release');
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
          const exports = module as unknown as {
            rulesByVariant?: Record<string, GameRules>;
            botsByVariant?: Record<string, BotStrategy>;
          };
          if (saved && variantId === undefined) {
            variantId =
              installed?.release.variantId ??
              Object.entries(exports.rulesByVariant ?? {}).find(
                ([, rules]) =>
                  rules.manifest.rulesVersion ===
                    saved.manifest?.rulesVersion &&
                  rules.manifest.gameVersion === saved.manifest?.gameVersion &&
                  rules.manifest.stateVersion === saved.manifest?.stateVersion,
              )?.[0];
          }
          if (
            installed &&
            (installed.release.gameId !== item.id ||
              installed.release.variantId !== variantId)
          )
            throw new Error('incompatible-game-variant');
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
          const actual = selected.rules.manifest;
          // Source-only legacy exports are checked against the saved exact fingerprint.
          if (
            !expected &&
            !(
              saved &&
              !installed &&
              policies.get(item.id)?.has(variantId!) &&
              saved.manifest?.rulesVersion === actual.rulesVersion &&
              saved.manifest?.gameVersion === actual.gameVersion &&
              saved.manifest?.stateVersion === actual.stateVersion
            )
          )
            throw new Error('incompatible-game-variant');
          if (
            actual.id !== item.id ||
            actual.players.min !== descriptor.catalog.min ||
            actual.players.max !== descriptor.catalog.max ||
            (expected &&
              (actual.rulesVersion !== expected.rulesVersion ||
                actual.stateVersion !== expected.stateVersion ||
                actual.sdkVersion !== expected.sdk ||
                actual.gameVersion !== expected.gameVersion ||
                selected.bot.version !== expected.strategyVersion)) ||
            selected.bot.rulesVersion !== actual.rulesVersion
          )
            throw new Error('incompatible-game-module');
          return {
            ...(saved &&
            store &&
            store.current(item.id, variantId)?.releaseId !== ref
              ? { restoreOnly: true }
              : {}),
            rules: selected.rules,
            bot: selected.bot,
            ...(variantId ? { variantId } : {}),
            ...(ref ? { releaseRef: ref } : {}),
          };
        };
        return {
          ...(!currentIds.has(item.id) ? { restoreOnly: true } : {}),
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
          load,
          loadSaved: (save: Save, ref?: string) =>
            load(save.variantId, ref, save),
        };
      }),
  );
}
