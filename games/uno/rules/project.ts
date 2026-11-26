import type { Viewer } from '@tablemax/game-sdk';
import { getCard } from '../data/catalog';
import type { UnoView } from '../types';
import type { State } from './state';

type OwnCards = NonNullable<UnoView['self']>;

export interface UnoMemoryObservation {
  readonly roundNumber: number;
  readonly seatOrder: readonly string[];
  readonly latest: Readonly<NonNullable<UnoView['latest']>> | null;
  readonly self: Readonly<
    Pick<OwnCards, 'seatId' | 'challengeEvidence'>
  > | null;
}

function challengeFor(
  state: State,
  seat: string,
): OwnCards['challengeEvidence'] {
  const evidence = state.evidence;
  if (evidence?.challenger !== seat) return null;
  return {
    challenger: seat,
    offender: evidence.offender,
    previousColor: evidence.previousColor,
    cards: evidence.cardIds.map((id) => ({ ...getCard(id) })),
    guilty: evidence.guilty,
  };
}

export function projectUnoMemoryObservation(
  state: State,
  seat: string,
): UnoMemoryObservation {
  return {
    roundNumber: state.roundNumber,
    seatOrder: state.seats,
    latest: state.latest,
    self: state.seats.includes(seat)
      ? { seatId: seat, challengeEvidence: challengeFor(state, seat) }
      : null,
  };
}

export function project(s: State, viewer: Viewer): UnoView {
  const seat =
    viewer.role === 'player' && s.seats.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  return {
    ...(s.setup ? { setup: { ...s.setup } } : {}),
    ...(s.drawPenalty !== undefined
      ? { drawPenalty: s.drawPenalty ? { ...s.drawPenalty } : null }
      : {}),
    gameId: 'uno',
    rulesVersion: s.rulesVersion,
    phase: s.phase,
    stage: s.stage,
    seatOrder: [...s.seats],
    roundNumber: s.roundNumber,
    turnNumber: s.turnNumber,
    dealer: s.dealer,
    turnSeat: s.turnSeat,
    direction: s.direction,
    activeColor: s.activeColor,
    topCard: { ...getCard(s.discard.at(-1)!) },
    discardCount: s.discard.length,
    drawCount: s.deck.length,
    players: Object.fromEntries(
      s.seats.map((id) => [
        id,
        {
          handCount: s.hands[id]!.length,
          score: s.scores[id]!,
          wins: s.wins[id]!,
          uno: s.unoDeclared[id]!,
        },
      ]),
    ),
    self: seat
      ? {
          seatId: seat,
          hand: s.hands[seat]!.map((id) => ({ ...getCard(id) })),
          drawnCardId: s.turnSeat === seat ? s.drawnCardId : null,
          challengeEvidence: challengeFor(s, seat),
        }
      : null,
    drawFour: s.drawFour
      ? {
          offender: s.drawFour.offender,
          target: s.drawFour.target,
          previousColor: s.drawFour.previousColor,
          chosenColor: s.drawFour.chosenColor,
        }
      : null,
    unoWindow: s.unoWindow ? { ...s.unoWindow } : null,
    results: structuredClone(s.results),
    winners: [...s.winners],
    latest: s.latest ? structuredClone(s.latest) : null,
  };
}
