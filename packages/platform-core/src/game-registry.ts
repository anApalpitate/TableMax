import type { BotStrategy, GameRules } from '@tablemax/game-sdk';

export interface GameCatalogEntry {
  id: string;
  name: string;
  min: number;
  max: number;
}
export interface LoadedGame {
  rules: GameRules;
  bot: BotStrategy;
}
export interface GameRegistration {
  catalog: GameCatalogEntry;
  load(): Promise<LoadedGame>;
}

/** Metadata is available without importing any game's rules, cards or strategy. */
export class GameRegistry {
  constructor(private readonly entries: readonly GameRegistration[]) {
    if (
      new Set(entries.map((entry) => entry.catalog.id)).size !== entries.length
    )
      throw new Error('duplicate-game');
  }
  catalog(): GameCatalogEntry[] {
    return this.entries.map((entry) => ({ ...entry.catalog }));
  }
  async load(id: string): Promise<LoadedGame> {
    const entry = this.entries.find((candidate) => candidate.catalog.id === id);
    if (!entry) throw new Error('unknown-game');
    const game = await entry.load();
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
    return game;
  }
}
