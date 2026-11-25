import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import type { LoadedGame } from './game-registry';
import type { BotData } from './model';
import { requireThat } from './errors';

export interface BotModelBinding {
  gameId: string;
  variantId?: string;
  releaseRef: string;
  rulesVersion: string;
  strategyId: string;
  strategyVersion: string;
  difficulty: BotDifficulty;
}

export interface BotModelProvider {
  active(binding: BotModelBinding): string | undefined;
  load(binding: BotModelBinding, ref: string): JsonValue;
}

export function botModelBinding(
  game: LoadedGame | null,
  difficulty: BotDifficulty,
): BotModelBinding | undefined {
  if (!game?.releaseRef || !game.bot.model?.difficulties.includes(difficulty))
    return undefined;
  return {
    gameId: game.rules.manifest.id,
    ...(game.variantId === undefined ? {} : { variantId: game.variantId }),
    releaseRef: game.releaseRef,
    rulesVersion: game.rules.manifest.rulesVersion,
    strategyId: game.bot.id,
    strategyVersion: game.bot.version,
    difficulty,
  };
}

export function resolveBotModel(
  provider: BotModelProvider | undefined,
  game: LoadedGame | null,
  data: BotData,
): JsonValue | undefined {
  if (data.modelRef === undefined) return undefined;
  const binding = botModelBinding(game, data.difficulty ?? 'default');
  requireThat(provider && binding && game?.bot.model, 'missing-bot-model');
  requireThat(
    data.id === binding.strategyId && data.version === binding.strategyVersion,
    'incompatible-bot-model',
  );
  const model = provider.load(binding, data.modelRef);
  try {
    return game.bot.model.validate(model);
  } catch {
    throw new Error('incompatible-bot-model');
  }
}
