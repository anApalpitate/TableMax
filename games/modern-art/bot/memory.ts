import type { JsonValue } from '../../../packages/game-sdk/src';
import { CARD_IDS } from '../data/catalog';
import type { ModernArtView } from '../ui/view';

export type ArtMemory = {
  version: 1;
  round: number;
  lastLog: number;
  remembered: string[];
  auctionId: string | null;
  raises: number;
};

export function validateMemory(input: unknown): JsonValue {
  if (input === null) return null;
  const value = input as ArtMemory;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      'auctionId,lastLog,raises,remembered,round,version' ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.round) ||
    value.round < 1 ||
    value.round > 4 ||
    !Number.isSafeInteger(value.lastLog) ||
    value.lastLog < 0 ||
    !Array.isArray(value.remembered) ||
    value.remembered.length > 70 ||
    new Set(value.remembered).size !== value.remembered.length ||
    value.remembered.some((id) => !CARD_IDS.includes(id)) ||
    (value.auctionId !== null &&
      (typeof value.auctionId !== 'string' ||
        value.auctionId.length > 80 ||
        !/^r[1-4]-a\d+$/.test(value.auctionId))) ||
    !Number.isInteger(value.raises) ||
    value.raises < 0 ||
    value.raises > 3
  )
    throw new Error('现代艺术策略记忆无效。');
  return structuredClone(value);
}

export function observeMemory(
  input: JsonValue,
  view: ModernArtView,
  level: number,
): ArtMemory {
  const previous = validateMemory(input) as ArtMemory | null;
  const memory: ArtMemory = previous ?? {
    version: 1,
    round: view.round,
    lastLog: 0,
    remembered: [],
    auctionId: null,
    raises: 0,
  };
  if (memory.round > view.round) throw new Error('现代艺术策略记忆轮次无效。');
  if (memory.round !== view.round) {
    // A weaker player loses old card tracking, never the visible price board.
    memory.remembered = memory.remembered.slice(-[2, 14, 70][level]!);
    memory.round = view.round;
  }
  for (const entry of view.history) {
    const serial = Number(entry.id.slice(4));
    if (serial <= memory.lastLog) continue;
    for (const card of entry.cards) {
      memory.remembered = memory.remembered.filter((id) => id !== card.id);
      memory.remembered.push(card.id);
    }
  }
  memory.lastLog = Math.max(
    memory.lastLog,
    ...view.history.map((entry) => Number(entry.id.slice(4))),
  );
  for (const card of [
    ...Object.values(view.players).flatMap((player) => player.collection),
    ...(view.auction?.cards ?? []),
  ])
    if (!memory.remembered.includes(card.id)) memory.remembered.push(card.id);
  memory.remembered = memory.remembered.slice(-[8, 28, 70][level]!);
  if (memory.auctionId !== (view.auction?.id ?? null)) {
    memory.auctionId = view.auction?.id ?? null;
    memory.raises = 0;
  }
  return memory;
}
