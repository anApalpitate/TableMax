import type { LatestAction, UnoView } from '../types';

export type UnoCue =
  | 'place'
  | 'draw'
  | 'skip'
  | 'reverse'
  | 'draw-two'
  | 'wild'
  | 'draw-four'
  | 'accept-four'
  | 'uno'
  | 'catch-uno'
  | 'challenge'
  | 'challenge-success'
  | 'challenge-failure'
  | 'win';

/** Classify only the public saved record; authorized challenge evidence stays private. */
export function unoSavedCue(
  latest: LatestAction | null,
  phase: UnoView['phase'],
): UnoCue | null {
  if (!latest) return null;
  if (phase !== 'playing' || /ended|result|round-won/.test(latest.verb))
    return 'win';
  if (latest.verb === 'catch-uno') return 'catch-uno';
  if (latest.verb === 'challenge-draw-four') {
    // The public penalty target identifies the verdict even if the draw pile
    // cannot supply all four/six cards. No text parsing or private hand is needed.
    const target = latest.targets[0];
    if (!latest.actor || !target) return 'challenge';
    return target === latest.actor ? 'challenge-failure' : 'challenge-success';
  }
  if (/challenge/.test(latest.verb)) return 'challenge';
  if (latest.verb === 'declare-uno') return 'uno';
  if (latest.verb === 'play' && /\bUNO\b/.test(latest.text)) return 'uno';
  if (latest.verb === 'accept-draw-four') return 'accept-four';
  if (latest.verb === 'choose-color') return 'wild';
  if (latest.verb === 'draw' || latest.verb === 'accept-draw-penalty')
    return 'draw';
  switch (latest.card?.kind) {
    case 'skip':
    case 'reverse':
    case 'draw-two':
    case 'wild':
      return latest.card.kind;
    case 'wild-draw-four':
      return 'draw-four';
    default:
      return latest.verb === 'play' ? 'place' : null;
  }
}

export const unoCuePresentation = {
  place: { kind: 'number', symbol: '', caption: '', celebration: false },
  draw: { kind: 'draw', symbol: '', caption: '', celebration: false },
  skip: { kind: 'skip', symbol: '⊘', caption: '跳过', celebration: false },
  reverse: {
    kind: 'reverse',
    symbol: '↔',
    caption: '反转',
    celebration: false,
  },
  'draw-two': {
    kind: 'draw-two',
    symbol: '+2',
    caption: '摸二',
    celebration: false,
  },
  wild: { kind: 'wild', symbol: '◇', caption: '变色', celebration: true },
  'draw-four': {
    kind: 'wild-draw-four',
    symbol: '+4',
    caption: '万能摸四',
    celebration: true,
  },
  'accept-four': {
    kind: 'draw',
    symbol: '+4',
    caption: '接受摸四',
    celebration: false,
  },
  uno: { kind: 'uno', symbol: 'UNO!', caption: '剩一张', celebration: true },
  'catch-uno': {
    kind: 'challenge',
    symbol: 'UNO?',
    caption: '抓到漏喊',
    celebration: false,
  },
  challenge: {
    kind: 'challenge',
    symbol: '+4 ?',
    caption: '质疑结果',
    celebration: false,
  },
  'challenge-success': {
    kind: 'challenge',
    symbol: '+4 ✓',
    caption: '质疑成功',
    celebration: true,
  },
  'challenge-failure': {
    kind: 'challenge',
    symbol: '+6',
    caption: '质疑失败',
    celebration: false,
  },
  win: { kind: 'win', symbol: '★', caption: '本局获胜', celebration: true },
} as const satisfies Record<
  UnoCue,
  {
    kind: string;
    symbol: string;
    caption: string;
    celebration: boolean;
  }
>;

export function unoCueSymbol(cue: UnoCue, latest: LatestAction): string {
  if (cue === 'challenge-failure' || cue === 'accept-four')
    return latest.drawCount > 0
      ? `+${latest.drawCount}`
      : cue === 'challenge-failure'
        ? '×'
        : '↓';
  return unoCuePresentation[cue].symbol;
}
