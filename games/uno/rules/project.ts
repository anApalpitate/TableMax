import type { Viewer } from '@tablemax/game-sdk';
import { getCard } from '../data/catalog';
import type { Card, UnoView } from '../types';
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

export interface UnoDecisionObservation extends UnoMemoryObservation {
  readonly setup?: UnoView['setup'];
  readonly activeColor: UnoView['activeColor'];
  readonly direction: UnoView['direction'];
  readonly players: Readonly<
    Record<
      string,
      Readonly<Pick<UnoView['players'][string], 'handCount' | 'score'>>
    >
  >;
  readonly self:
    | (NonNullable<UnoMemoryObservation['self']> & {
        readonly hand: readonly Card[];
      })
    | null;
  readonly drawFour: UnoView['drawFour'];
}

function publicPlayer(state: State, seat: string) {
  return { handCount: state.hands[seat]!.length, score: state.scores[seat]! };
}

function publicDrawFour(state: State): UnoView['drawFour'] {
  const claim = state.drawFour;
  return claim
    ? {
        offender: claim.offender,
        target: claim.target,
        previousColor: claim.previousColor,
        chosenColor: claim.chosenColor,
      }
    : null;
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

/** Read-only decision input for the acting seat of an isolated rollout. */
export function projectUnoRolloutDecision(
  state: State,
  seat: string,
): UnoDecisionObservation {
  const observation = projectUnoMemoryObservation(state, seat);
  return {
    ...observation,
    ...(state.setup ? { setup: state.setup } : {}),
    activeColor: state.activeColor,
    direction: state.direction,
    players: Object.fromEntries(
      state.seats.map((id) => [id, publicPlayer(state, id)]),
    ),
    self: observation.self && {
      ...observation.self,
      hand: state.hands[seat]!.map(getCard),
    },
    drawFour: publicDrawFour(state),
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
          ...publicPlayer(s, id),
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
    drawFour: publicDrawFour(s),
    unoWindow: s.unoWindow ? { ...s.unoWindow } : null,
    results: structuredClone(s.results),
    winners: [...s.winners],
    latest: s.latest ? structuredClone(s.latest) : null,
  };
}
