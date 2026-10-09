import type { Viewer } from '@tablemax/game-sdk';
import { getCard } from '../data/catalog';
import type { UnoView } from '../types';
import type { State } from './state';
export function project(s: State, viewer: Viewer): UnoView {
  const seat =
    viewer.role === 'player' && s.seats.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  return {
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
          challengeEvidence:
            s.evidence?.challenger === seat
              ? {
                  challenger: seat,
                  offender: s.evidence.offender,
                  previousColor: s.evidence.previousColor,
                  cards: s.evidence.cardIds.map((id) => ({ ...getCard(id) })),
                  guilty: s.evidence.guilty,
                }
              : null,
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
