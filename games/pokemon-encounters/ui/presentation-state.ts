import type { PublicAction } from '../../../packages/protocol/src';
import type { PokemonView } from '../rules/project';

export type EffectTheme = 'mew' | 'zapdos' | 'snorlax' | 'charizard' | 'rocket';
export type SoundCue =
  | 'draw'
  | 'replace'
  | 'effect-complete'
  | 'round-result'
  | 'match-result'
  | 'mew'
  | 'zapdos'
  | 'snorlax'
  | 'charizard'
  | 'rocket'
  | 'rocket-return'
  | 'meowth'
  | 'pikachu'
  | 'error';

const themes: Record<string, EffectTheme> = {
  'special-mew': 'mew',
  'special-zapdos': 'zapdos',
  'special-snorlax': 'snorlax',
  'special-charizard': 'charizard',
  'special-team-rocket': 'rocket',
};

/** Only committed public metadata and the viewer's authorized projection enter here. */
export function actionEffects(
  action: PublicAction | undefined,
  view?: PokemonView | null,
) {
  const theme = action?.ability ? themes[action.ability] : undefined;
  const targets =
    action?.targets.flatMap(({ seat, slots }) =>
      slots.map((slot) => `${seat}:${slot}`),
    ) ?? [];
  const active =
    action && !['decline', 'close-peek', 'deal'].includes(action.verb);
  const coin =
    action?.verb === 'draw' && action.ability === 'special-team-rocket'
      ? view?.coin
      : null;
  const rocketReturns =
    action &&
    theme &&
    action.verb !== 'draw' &&
    (theme !== 'rocket' || action.verb === 'rocket-refill')
      ? action.targets.flatMap(({ seat, slots }) =>
          slots
            .filter(
              (slot) =>
                view?.boards[seat]?.[slot]?.card?.categoryId ===
                'special-team-rocket',
            )
            .map((slot) => `${seat}:${slot}`),
        )
      : [];
  return { theme: active ? theme : undefined, targets, coin, rocketReturns };
}

export function soundCues(
  kind: string,
  action: PublicAction | undefined,
  view?: PokemonView | null,
): SoundCue[] {
  const effects = actionEffects(action, view);
  const cues: SoundCue[] = [];
  if (effects.coin) cues.push('rocket', effects.coin);
  else if (effects.theme) cues.push(effects.theme);
  else if (['draw', 'replace', 'effect-complete'].includes(kind))
    cues.push(kind as SoundCue);
  if (effects.rocketReturns.length) cues.push('rocket-return');
  if (kind === 'round-result')
    cues.push(view?.matchWinners.length ? 'match-result' : 'round-result');
  return cues;
}

/** A Ditto is certain only when all visible anchored choices agree; unknown cards stay unknown. */
export function publicZeroColumns(view: PokemonView, seat: string): number[] {
  const board = view.boards[seat];
  if (!board) return [];
  const settled =
    view.roundResult?.scores[seat]?.columns ?? view.publicColumns?.[seat];
  if (settled)
    return settled.flatMap((score, index) => (score === 0 ? [index] : []));
  const resolve = (slot: number, path: number[] = []): Set<number | null> => {
    if (path.includes(slot)) return new Set();
    const item = board[slot];
    if (!item?.faceUp || !item.card) return new Set([null]);
    if (item.card.value !== null) return new Set([item.card.value]);
    const choices = new Set<number | null>();
    for (const next of [slot - 1, slot + 1]) {
      if (
        next >= 0 &&
        next < 6 &&
        Math.floor(next / 3) === Math.floor(slot / 3)
      )
        for (const value of resolve(next, [...path, slot])) choices.add(value);
    }
    return choices;
  };
  return [0, 1, 2].filter((column) => {
    if (!board[column]?.faceUp || !board[column + 3]?.faceUp) return false;
    const first = resolve(column),
      second = resolve(column + 3);
    if (
      first.size !== 1 ||
      second.size !== 1 ||
      first.has(null) ||
      second.has(null)
    )
      return false;
    const a = [...first][0]!,
      b = [...second][0]!;
    return a === b || a + b === 0;
  });
}

export function decisionProgress(view: PokemonView) {
  switch (view.phase) {
    case 'initial-flip':
      return {
        labels: view.seatOrder.map((_, i) => `玩家 ${i + 1}`),
        completed: view.initialDone.length,
        label: '初始翻牌',
        total: view.seatOrder.length,
      };
    case 'mew-other':
      return {
        labels: ['取牌', '朋友的牌', '自己换入'],
        completed: 1,
        label: '梦幻交换',
        total: 3,
      };
    case 'mew-self':
      return {
        labels: ['取牌', '朋友的牌', '自己换入'],
        completed: 2,
        label: '梦幻交换',
        total: 3,
      };
    case 'zapdos-self':
      return {
        labels: view.seatOrder.map((_, i) =>
          i === 0 ? '自己换入' : `传牌 ${i}`,
        ),
        completed: 0,
        label: '闪电鸟传牌',
        total: view.seatOrder.length,
      };
    case 'zapdos-receive':
      return {
        labels: view.seatOrder.map((_, i) =>
          i === 0 ? '自己换入' : `传牌 ${i}`,
        ),
        completed: 1 + (view.passProgress?.completed ?? 0),
        label: '闪电鸟传牌',
        total: view.seatOrder.length,
      };
    case 'rocket-meowth':
    case 'rocket-pikachu':
      return {
        labels: ['取牌', '抛硬币', '换牌'],
        completed: 2,
        label: '火箭队',
        total: 3,
      };
    case 'snorlax-choice':
    case 'charizard-choice':
      return {
        labels: ['取牌', '换入', '能力'],
        completed: 2,
        label: '本次操作',
        total: 3,
      };
    case 'charizard-view':
      return {
        labels: ['取牌', '换入', '查看', '关闭'],
        completed: 3,
        label: '喷火龙查看',
        total: 4,
      };
    case 'place':
      return {
        labels: ['取牌', '换入或弃掉'],
        completed: 1,
        label: '本次操作',
        total: 2,
      };
    default:
      return {
        labels: ['取牌', '换入或弃掉'],
        completed: 0,
        label: '本次操作',
        total: 2,
      };
  }
}

export function heldDescription(
  view: PokemonView,
  names: Record<string, string>,
) {
  const actor = names[view.actorSeat ?? view.turnSeat] ?? '当前玩家';
  if (view.phase === 'mew-self') return `${actor} 从朋友处拿到 · 等待换入`;
  if (view.phase === 'zapdos-receive') return `传递给 ${actor} · 等待换入`;
  if (view.phase === 'rocket-pikachu')
    return `${actor} 暂持 · 等待全员同位换牌`;
  return `${actor} 暂持 · 尚未放入场地`;
}
