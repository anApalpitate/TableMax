import type { BotStrategy, GameRules } from '@tablemax/game-sdk';
import type { Save } from './model';

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
  /** Immutable reviewed package identity; absent only for source development. */
  releaseRef?: string;
  variantId?: string;
  rules: GameRules;
  bot: BotStrategy;
}
export interface GameRegistration {
  catalog: GameCatalogEntry;
  load(variantId?: string, releaseRef?: string): Promise<LoadedGame>;
}

/** Metadata is available without importing any game's rules, cards or strategy. */
export class GameRegistry {
  resolveSavedRelease?: (save: Save) => string | undefined;
  constructor(private entries: readonly GameRegistration[]) {
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
  registrations(): readonly GameRegistration[] {
    return this.entries;
  }
  /** Replace metadata for future selections; loaded instances remain intact. */
  refresh(entries: readonly GameRegistration[]) {
    this.entries = new GameRegistry(entries).entries;
  }
  async load(
    id: string,
    variantId?: string,
    releaseRef?: string,
  ): Promise<LoadedGame> {
    const entry = this.entries.find((candidate) => candidate.catalog.id === id);
    if (!entry) throw new Error('unknown-game');
    const selected = variantId ?? entry.catalog.defaultVariantId;
    if (
      selected !== undefined &&
      !entry.catalog.variants?.some((v) => v.id === selected)
    )
      throw new Error('unknown-game-variant');
    const game = await entry.load(selected, releaseRef);
    if (releaseRef !== undefined && game.releaseRef !== releaseRef)
      throw new Error('missing-game-release');
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
