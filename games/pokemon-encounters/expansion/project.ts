import type { Viewer } from '@tablemax/game-sdk';
import { card, abilityText } from './cards';
import { task } from './research';
import { actor, type State } from './state';
export const face = (instance: string, abilityUsed = false) => {
  const c = card(instance);
  return {
    categoryId: c.categoryId,
    assetId: c.categoryId,
    name: c.name,
    value: c.value,
    ability: c.ability,
    abilityUsed,
    abilityText: c.ability
      ? abilityText[c.ability]
      : c.copy === 'horizontal'
        ? '结算时复制左右紧邻的有效值。'
        : c.copy === 'vertical'
          ? '结算时复制上下紧邻的有效值。'
          : null,
    copy: c.copy,
  };
};
export type Face = ReturnType<typeof face>;
export function project(s: State, viewer: Viewer) {
  const visibleFace = (instance: string) =>
    face(instance, s.usedAbilityIds?.includes(instance) ?? false);
  const own =
    viewer.role === 'player' && s.seatOrder.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  return structuredClone({
    variantId: 'expansion' as const,
    roundNumber: s.roundNumber,
    seatOrder: s.seatOrder,
    winsBySeat: s.winsBySeat,
    boards: Object.fromEntries(
      s.seatOrder.map((id) => [
        id,
        s.boards[id]!.map((c, i) => ({
          slotId: `${id}:${i}`,
          faceUp: c.faceUp,
          card: c.faceUp ? visibleFace(c.instanceId) : null,
        })),
      ]),
    ),
    phase: s.phase,
    turnSeat: s.turnSeat,
    actorSeat: [
      'research-vote',
      'initial-flip',
      'round-result',
      'match-result',
    ].includes(s.phase)
      ? null
      : actor(s),
    initialDone: s.initialDone,
    deckCount: s.deck.length,
    discardCount: s.discard.length,
    discardTop: s.discard.length ? visibleFace(s.discard.at(-1)!) : null,
    discardOptions: s.discard.slice(-2).reverse().map(visibleFace),
    held: s.held ? visibleFace(s.held) : null,
    drawSource: s.drawSource,
    coin: s.coin,
    relaySeats:
      s.phase === 'zapdos-self' || s.phase === 'zapdos-receive'
        ? s.recipientQueue.slice(s.recipientIndex)
        : [],
    passProgress:
      s.phase === 'zapdos-receive'
        ? { completed: s.recipientIndex, total: s.recipientQueue.length }
        : null,
    peek:
      own === s.turnSeat &&
      ['charizard-view', 'mewtwo-choice'].includes(s.phase)
        ? {
            seat: s.targetSeat!,
            cards: s.peekSlots.map((slot) => ({
              slot,
              card: visibleFace(s.boards[s.targetSeat!]![slot]!.instanceId),
            })),
          }
        : null,
    researchCandidates: s.researchCandidates.map(task),
    votedSeats: s.seatOrder.filter((id) => s.votesBySeat[id] !== undefined),
    ownVote: own ? (s.votesBySeat[own] ?? null) : null,
    voteCounts: s.voteCounts,
    activeResearch: s.activeResearch.map(task),
    hoennTriggered: s.activeResearch.length === 2,
    arceusUsed: s.arceusUsed,
    rowAbility: s.rowAbility,
    roundResult: s.roundResult,
    matchWinners: s.matchWinners,
    events: s.events,
  });
}
export type View = ReturnType<typeof project>;
