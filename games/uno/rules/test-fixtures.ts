import type { RuleContext } from '@tablemax/game-sdk';
import { CARD_IDS, getCard, RULES_VERSION } from '../data/catalog';
import type { State } from './state';
export function context(seed = 1, seats = ['a', 'b', 'c']): RuleContext {
  let randomState = seed >>> 0 || 1;
  return {
    seats,
    random: {
      next() {
        randomState ^= randomState << 13;
        randomState ^= randomState >>> 17;
        randomState ^= randomState << 5;
        return (randomState >>> 0) / 0x100000000;
      },
    },
  };
}
export function fixture(
  hands: Record<string, string[]>,
  top = 'red-5-a',
  turnSeat = Object.keys(hands)[0]!,
): State {
  const seats = Object.keys(hands),
    used = [...Object.values(hands).flat(), top];
  if (new Set(used).size !== used.length)
    throw new Error('Fixture duplicates a card');
  const zero = Object.fromEntries(seats.map((seat) => [seat, 0]));
  return {
    rulesVersion: RULES_VERSION,
    stateVersion: 1,
    seats,
    phase: 'playing',
    stage: 'turn',
    roundNumber: 1,
    turnNumber: 1,
    actionSerial: 0,
    dealer: seats.at(-1)!,
    turnSeat,
    direction: 1,
    activeColor: getCard(top).color,
    deck: CARD_IDS.filter((id) => !used.includes(id)),
    discard: [top],
    hands: structuredClone(hands),
    scores: zero,
    wins: { ...zero },
    unoDeclared: Object.fromEntries(seats.map((seat) => [seat, false])),
    drawnCardId: null,
    drawFour: null,
    unoWindow: null,
    evidence: null,
    results: [],
    winners: [],
    latest: null,
  };
}
