import type { Viewer } from '@tablemax/game-sdk';
import { card, numeric } from './cards';
import { actor, type State } from './state';

export function face(instance: string) {
  const c = card(instance);
  return {
    categoryId: c.categoryId,
    name: c.displayName,
    value: numeric(instance),
    ability: c.abilityDefinition?.adoptedText ?? null,
  };
}
export type Face = ReturnType<typeof face>;
export function project(s: State, viewer: Viewer) {
  return {
    roundNumber: s.roundNumber,
    seatOrder: s.seatOrder,
    winsBySeat: s.winsBySeat,
    boards: Object.fromEntries(
      s.seatOrder.map((seat) => [
        seat,
        s.boards[seat]!.map((slot, index) => ({
          slotId: `${seat}:${index}`,
          faceUp: slot.faceUp,
          card: slot.faceUp ? face(slot.instanceId) : null,
        })),
      ]),
    ),
    phase: s.phase,
    turnSeat: s.turnSeat,
    actorSeat: ['round-result', 'match-result', 'initial-flip'].includes(
      s.phase,
    )
      ? null
      : actor(s),
    initialDone: s.initialDone,
    deckCount: s.deck.length,
    discardCount: s.discard.length,
    discardTop: s.discard.length ? face(s.discard.at(-1)!) : null,
    discard: viewer.role === 'public' ? s.discard.map(face) : null,
    held: s.held ? face(s.held) : null,
    coin: s.coin,
    passProgress:
      s.phase === 'zapdos-receive'
        ? { completed: s.recipientIndex, total: s.recipientQueue.length }
        : null,
    peek:
      viewer.role === 'player' &&
      viewer.seatId === s.turnSeat &&
      s.phase === 'charizard-view'
        ? {
            slot: s.peekSlot!,
            card: face(s.boards[s.turnSeat]![s.peekSlot!]!.instanceId),
          }
        : null,
    roundResult: s.roundResult,
    matchWinners: s.matchWinners,
    events: s.events,
  };
}
export type PokemonView = ReturnType<typeof project>;
