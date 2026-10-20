import type { Viewer } from '@tablemax/game-sdk';
import type { State } from './state';
export function project(s: State, viewer: Viewer) {
  const own =
    viewer.role === 'player' && s.seats.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  return {
    seats: [...s.seats],
    turn: s.turn,
    serial: s.serial,
    handCounts: Object.fromEntries(
      s.seats.map((id) => [id, s.hands[id]!.length]),
    ),
    piles: structuredClone(s.piles),
    ownHand: own ? [...s.hands[own]!] : [],
    offer: s.offer
      ? {
          sender: s.offer.sender,
          target: s.offer.target,
          claim: s.offer.claim,
          seen: [...s.offer.seen],
          passing: s.offer.passing,
          route: structuredClone(s.offer.route),
          knownCard: own && s.offer.seen.includes(own) ? s.offer.card : null,
        }
      : null,
    last: s.last ? { ...s.last } : null,
    loser: s.loser,
    winners: [...s.winners],
    threshold: s.seats.length === 2 ? 5 : 4,
  };
}
