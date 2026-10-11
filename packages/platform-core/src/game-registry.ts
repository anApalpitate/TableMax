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
  /** Historical configuration may continue its saved match, never initialize again. */
  restoreOnly?: boolean;
  /** Immutable reviewed package identity; absent only for source development. */
  releaseRef?: string;
  variantId?: string;
  rules: GameRules;
  bot: BotStrategy;
}
export interface GameRegistration {
  /** Available for exact restoration, excluded from new-game browsing. */
  restoreOnly?: boolean;
  catalog: GameCatalogEntry;
  load(variantId?: string, releaseRef?: string): Promise<LoadedGame>;
  loadSaved?(save: Save, releaseRef?: string): Promise<LoadedGame>;
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
    return structuredClone(
      this.entries
        .filter((entry) => !entry.restoreOnly)
        .map((entry) => entry.catalog),
    );
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
    if (entry.restoreOnly) throw new Error('unknown-game');
    const selected = variantId ?? entry.catalog.defaultVariantId;
    if (
      selected !== undefined &&
      !entry.catalog.variants?.some((v) => v.id === selected)
    )
      throw new Error('unknown-game-variant');
    const game = await entry.load(selected, releaseRef);
    if (releaseRef !== undefined && game.releaseRef !== releaseRef)
      throw new Error('missing-game-release');
    return this.validateLoaded(entry, game, selected, releaseRef);
  }
  async loadSaved(save: Save): Promise<LoadedGame> {
    if (!save.manifest) throw new Error('unknown-game');
    const entry = this.entries.find(
      (candidate) => candidate.catalog.id === save.manifest!.id,
    );
    if (!entry) throw new Error('unknown-game');
    const ref = save.releaseRef ?? this.resolveSavedRelease?.(save);
    if (!entry.loadSaved)
      return this.load(save.manifest.id, save.variantId, ref);
    const game = await entry.loadSaved(save, ref);
    const selected = game.variantId ?? save.variantId;
    const loaded = this.validateLoaded(entry, game, selected, ref);
    if (
      ['id', 'gameVersion', 'rulesVersion', 'stateVersion'].some(
        (key) =>
          save.manifest![key as keyof typeof save.manifest] !==
          loaded.rules.manifest[key as keyof typeof loaded.rules.manifest],
      )
    )
      throw new Error('incompatible-save');
    return {
      ...loaded,
      ...(entry.restoreOnly ||
      (selected !== undefined &&
        !entry.catalog.variants?.some((v) => v.id === selected))
        ? { restoreOnly: true }
        : {}),
    };
  }
  private validateLoaded(
    entry: GameRegistration,
    game: LoadedGame,
    selected?: string,
    releaseRef?: string,
  ): LoadedGame {
    const id = entry.catalog.id;
    if (releaseRef !== undefined && game.releaseRef !== releaseRef)
      throw new Error('missing-game-release');
    const manifest = game.rules.manifest;
    // A reviewed package keeps its own capabilities when browsing metadata updates.
    const versioned = game.releaseRef !== undefined;
    if (
      (versioned && !/^[a-f0-9]{64}$/.test(game.releaseRef!)) ||
      manifest.id !== id ||
      manifest.sdkVersion !== 1 ||
      !manifest.name ||
      !Number.isSafeInteger(manifest.players.min) ||
      !Number.isSafeInteger(manifest.players.max) ||
      manifest.players.min < 1 ||
      manifest.players.max < manifest.players.min ||
      (!versioned &&
        (manifest.name !== entry.catalog.name ||
          manifest.players.min !== entry.catalog.min ||
          manifest.players.max !== entry.catalog.max)) ||
      game.bot.gameId !== id ||
      game.bot.rulesVersion !== manifest.rulesVersion
    )
      throw new Error('incompatible-game');
    return selected === undefined ? game : { ...game, variantId: selected };
  }
}
