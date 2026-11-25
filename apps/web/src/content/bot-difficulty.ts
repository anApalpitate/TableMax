import type { BotDifficulty, RoomView } from '@tablemax/protocol';

export const botDifficultyNames: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
  mischief: '捣蛋王',
};

const legacyDifficulties: readonly BotDifficulty[] = [
  'default',
  'doubao',
  'juewu',
];

export function availableBotDifficulties(
  game: RoomView['game'] | undefined,
): readonly BotDifficulty[] {
  return game?.botDifficulties ?? legacyDifficulties;
}
