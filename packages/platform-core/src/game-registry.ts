import type { BotStrategy, GameRules } from '@tablemax/game-sdk';

export interface GameCatalogEntry {
  id: string;
  name: string;
  min: number;
  max: number;
  decisionTimer?: boolean;
  defaultVariantId?: string;
  variants?: { id: string; name: string; description: string }[];
}
export interface LoadedGame {
  variantId?: string;
  rules: GameRules;
  bot: BotStrategy;
}
export interface GameRegistration {
  catalog: GameCatalogEntry;
  load(variantId?: string): Promise<LoadedGame>;
}

/** Metadata is available without importing any game's rules, cards or strategy. */
export class GameRegistry {
  constructor(private readonly entries: readonly GameRegistration[]) {
    if (
      new Set(entries.map((entry) => entry.catalog.id)).size !== entries.length
    )
      throw new Error('duplicate-game');
    for (const { catalog } of entries) {
      const variants = catalog.variants ?? [];
      if (
        new Set(variants.map((variant) => variant.id)).size !==
          variants.length ||
        variants.some((variant) => !/^[a-z][a-z0-9-]*$/.test(variant.id)) ||
        (catalog.defaultVariantId !== undefined &&
          !variants.some(
            (variant) => variant.id === catalog.defaultVariantId,
          )) ||
        (variants.length > 0 && catalog.defaultVariantId === undefined)
      )
        throw new Error('invalid-game-variants');
    }
  }
  catalog(): GameCatalogEntry[] {
    return structuredClone(this.entries.map((entry) => entry.catalog));
  }
  async load(id: string, variantId?: string): Promise<LoadedGame> {
    const entry = this.entries.find((candidate) => candidate.catalog.id === id);
    if (!entry) throw new Error('unknown-game');
    const selected = variantId ?? entry.catalog.defaultVariantId;
    if (
      selected !== undefined &&
      !entry.catalog.variants?.some((v) => v.id === selected)
    )
      throw new Error('unknown-game-variant');
    const game = await entry.load(selected);
    const manifest = game.rules.manifest;
    if (
      manifest.id !== id ||
      manifest.sdkVersion !== 1 ||
      manifest.name !== entry.catalog.name ||
      manifest.players.min !== entry.catalog.min ||
      manifest.players.max !== entry.catalog.max ||
      game.bot.gameId !== id ||
      game.bot.rulesVersion !== manifest.rulesVersion
    )
      throw new Error('incompatible-game');
    return selected === undefined ? game : { ...game, variantId: selected };
  }
}
