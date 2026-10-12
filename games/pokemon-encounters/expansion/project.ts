import type { Viewer } from '@tablemax/game-sdk';
import { card, abilityTextForProfile } from './cards';
import { task } from './research';
import { actor, stateRulesProfile, type State } from './state';
import type { RulesProfile } from './config/types';
import {
  currentEvent,
  currentWeather,
  effectiveCard,
  weatherDelta,
  type Weather,
  type ScoreEffect,
} from './events';
export const face = (
  instance: string,
  abilityUsed = false,
  profile: RulesProfile = 'research-buffer-v2',
  overrides: Readonly<Record<string, string>> = {},
  weather: Weather | null = null,
  faceUp = true,
) => {
  const original = card(instance, profile);
  const effectiveBase = effectiveCard(instance, profile, overrides);
  const c = effectiveCard(instance, profile, overrides, weather, faceUp);
  const delta = faceUp ? weatherDelta(effectiveBase, weather) : 0;
  return {
    categoryId: c.categoryId,
    assetId: c.categoryId,
    name: c.name,
    value: c.value,
    ...(profile === 'events-research-v3'
      ? {
          originalCategoryId: original.categoryId,
          printedValue: original.value,
          effectiveValue: c.value,
          scoreEffect: (weather && delta
            ? { kind: weather, delta }
            : null) as ScoreEffect | null,
          types: [...c.types],
        }
      : {}),
    ability: c.ability,
    abilityUsed,
    abilityText: c.ability
      ? abilityTextForProfile(profile)[c.ability]
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
  const profile = stateRulesProfile(s);
  const weather = currentWeather(s);
  const visibleFace = (instance: string, onBoard = false, faceUp = true) =>
    face(
      instance,
      s.usedAbilityIds?.includes(instance) ?? false,
      profile,
      s.cardOverrides,
      onBoard ? weather : null,
      faceUp,
    );
  const own =
    viewer.role === 'player' && s.seatOrder.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  const peekAuthorized = (seat: string, index: number) =>
    own === s.turnSeat &&
    ['charizard-view', 'mewtwo-choice'].includes(s.phase) &&
    s.targetSeat === seat &&
    s.peekSlots.includes(index);
  const boardFace = (seat: string, index: number): Face => {
    const slot = s.boards[seat]![index]!;
    const result = visibleFace(slot.instanceId, true, slot.faceUp);
    if (profile !== 'events-research-v3') return result;
    if (!result.copy) return result;
    const settled = s.roundResult?.scores[seat];
    if (settled) {
      result.value = result.effectiveValue = settled.values[index]!;
      const copy = settled.copies.find((entry) => entry.slot === index);
      const anchor = copy?.path.at(-1);
      if (anchor !== undefined) {
        const inherited = boardFace(seat, anchor).scoreEffect;
        result.scoreEffect = inherited
          ? { ...inherited, inherited: true }
          : null;
      }
      return result;
    }
    const inheritedEffects: (ScoreEffect | null)[] = [];
    const resolve = (at: number, visited: number[] = []): number[] | null => {
      if (visited.includes(at)) return [];
      const target = s.boards[seat]![at]!;
      if (!target.faceUp && !peekAuthorized(seat, at)) return null;
      const known = visibleFace(target.instanceId, true, target.faceUp);
      if (!known.copy) {
        inheritedEffects.push(known.scoreEffect ?? null);
        return known.value === null ? null : [known.value];
      }
      const neighbors =
        known.copy === 'vertical'
          ? [at - 3, at + 3].filter((n) => n >= 0 && n < 9)
          : [at - 1, at + 1].filter(
              (n) =>
                n >= 0 && n < 9 && Math.floor(n / 3) === Math.floor(at / 3),
            );
      const values = neighbors.map((n) => resolve(n, [...visited, at]));
      return values.some((v) => v === null) ? null : values.flatMap((v) => v!);
    };
    const values = resolve(index);
    if (values && values.length && new Set(values).size === 1) {
      result.value = result.effectiveValue = values[0]!;
      const effect = inheritedEffects[0];
      if (
        effect &&
        inheritedEffects.every(
          (entry) =>
            entry?.kind === effect.kind && entry.delta === effect.delta,
        )
      )
        result.scoreEffect = { ...effect, inherited: true };
    }
    return result;
  };
  return structuredClone({
    variantId: 'expansion' as const,
    ...(profile === 'events-research-v3'
      ? {
          currentEvent: currentEvent(s),
          bondPlaceholders: s.bondPlaceholders ?? [],
        }
      : {}),
    ...(s.rulesProfile
      ? {
          rulesProfile: s.rulesProfile,
          buffersBySeat: Object.fromEntries(
            s.seatOrder.map((id) => [
              id,
              s.buffersBySeat![id] ? visibleFace(s.buffersBySeat![id]!) : null,
            ]),
          ),
        }
      : {}),
    roundNumber: s.roundNumber,
    seatOrder: s.seatOrder,
    winsBySeat: s.winsBySeat,
    boards: Object.fromEntries(
      s.seatOrder.map((id) => [
        id,
        s.boards[id]!.map((c, i) => ({
          slotId: `${id}:${i}`,
          faceUp: c.faceUp,
          card: c.faceUp ? boardFace(id, i) : null,
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
    discardOptions: s.discard
      .slice(s.rulesProfile ? -1 : -2)
      .reverse()
      .map((instance) => visibleFace(instance)),
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
              card: boardFace(s.targetSeat!, slot),
            })),
          }
        : null,
    researchCandidates: s.researchCandidates.map((id) =>
      task(id, stateRulesProfile(s)),
    ),
    votedSeats: s.seatOrder.filter((id) => s.votesBySeat[id] !== undefined),
    ownVote: own ? (s.votesBySeat[own] ?? null) : null,
    voteCounts: s.voteCounts,
    activeResearch: s.activeResearch.map((id) =>
      task(id, stateRulesProfile(s)),
    ),
    hoennTriggered: s.activeResearch.length === 2,
    arceusUsed: s.arceusUsed,
    rowAbility: s.rowAbility,
    roundResult: s.roundResult,
    matchWinners: s.matchWinners,
    events: s.events,
  });
}
export type View = ReturnType<typeof project>;
