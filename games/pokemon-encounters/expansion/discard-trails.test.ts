import { describe, expect, it } from 'vitest';
import type { RuleContext } from '@tablemax/game-sdk';
import { RoomFeedbackSchema } from '../../../packages/protocol/src';
import { createInitialState, pokemonExpansion as rules } from './index';
import { actor, type Action } from './state';
import type { RulesProfile } from './config/types';

function playing(profile: RulesProfile, count = 3) {
  const context: RuleContext = {
    seats: Array.from({ length: count }, (_, i) => `S${i + 1}`),
    random: { next: () => 0.9 },
  };
  let state = createInitialState(context, profile);
  const apply = (action: Action, seat = actor(state)) => {
    const result = rules.apply(state, action, seat, context);
    state = result.state;
    expect(rules.validateState(state, context.seats)).toEqual(state);
    expect(
      RoomFeedbackSchema.safeParse({
        instanceId: '45bc4dd7-aa1b-43c2-bf86-ef07e1be6797',
        revision: state.step,
        branch: 0,
        events: result.events,
      }).success,
    ).toBe(true);
    return state;
  };
  for (const seat of context.seats)
    apply(
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
    );
  for (const seat of context.seats)
    apply({ type: 'initial-flip', slot: 0 }, seat);
  const take = (instance: string) => {
    const top = state.deck.at(-1)!;
    const index = state.deck.indexOf(instance);
    const discardIndex = state.discard.indexOf(instance);
    if (index >= 0) state.deck[index] = top;
    else if (discardIndex >= 0) state.discard[discardIndex] = top;
    else {
      const cell = Object.values(state.boards)
        .flat()
        .find((slot) => slot.instanceId === instance);
      if (!cell) throw new Error('Missing test instance');
      cell.instanceId = top;
    }
    state.deck[state.deck.length - 1] = instance;
    if (state.randomEvent?.markerInstanceId === instance)
      state.randomEvent.markerInstanceId = state.deck.find(
        (id) => id !== instance,
      )!;
    return apply({ type: 'draw', source: 'deck' });
  };
  return { context, apply, take, state: () => state };
}

describe.each(['research-buffer-v2', 'events-research-v3'] as const)(
  '%s saved discard origins',
  (profile) => {
    it('deals one initial discard, records real discards and keeps origins outside generic feedback', () => {
      const game = playing(profile);
      expect(game.state().discard).toHaveLength(1);
      game.take('ordinary-1#01');
      const discarded = game.apply({ type: 'discard-held' });
      expect(discarded.events.at(-1)!.effect?.discardSources).toEqual([
        '@held',
      ]);
      game.take('ordinary-1#02');
      const seat = actor(game.state());
      const placed = game.apply({ type: 'replace', slot: 1 });
      expect(placed.events.at(-1)!.effect?.discardSources).toEqual([
        { seat, slot: 1 },
      ]);
      const publicView = rules.project(placed, { role: 'public' });
      expect(publicView.events).toEqual(placed.events);
      const tampered = structuredClone(placed);
      tampered.events.at(-1)!.effect!.discardSources = [{ seat, slot: 9 }];
      expect(() => rules.validateState(tampered, game.context.seats)).toThrow();
    });
    it('records no discard during relay and exactly the last receiver’s outgoing position at its end', () => {
      const game = playing(profile);
      game.take('special-zapdos#01');
      game.apply({ type: 'pass-direction', direction: 'clockwise' });
      for (let i = 0; i < game.context.seats.length; i++) {
        const seat = actor(game.state());
        const next = game.apply({ type: 'replace', slot: 1 });
        expect(next.events.at(-1)!.effect?.discardSources).toEqual(
          i === game.context.seats.length - 1 ? [{ seat, slot: 1 }] : [],
        );
      }
    });
    it('records Rocket’s held card and every same-position discard, and Mew’s final self replacement', () => {
      const rocket = playing(profile);
      const drawn = rocket.take('special-team-rocket#01');
      expect(drawn.coin).toBe('pikachu');
      const order = drawn.seatOrder.map(
        (_, i) =>
          drawn.seatOrder[
            (drawn.seatOrder.indexOf(drawn.turnSeat) + i) %
              drawn.seatOrder.length
          ]!,
      );
      expect(
        rocket.apply({ type: 'replace', slot: 1 }).events.at(-1)!.effect
          ?.discardSources,
      ).toEqual(['@held', ...order.map((seat) => ({ seat, slot: 1 }))]);
      const mew = playing(profile);
      const held = mew.take('special-mew#01');
      const other = held.seatOrder.find((seat) => seat !== held.turnSeat)!;
      const targeted = mew.apply({ type: 'mew-target', seat: other, slot: 1 });
      expect(targeted.events.at(-1)!.effect?.discardSources).toBeUndefined();
      const seat = held.turnSeat;
      expect(
        mew.apply({ type: 'replace', slot: 1 }).events.at(-1)!.effect
          ?.discardSources,
      ).toEqual([{ seat, slot: 1 }]);
    });
  },
);

it('keeps legacy two-discard initialization and old action receipts unchanged', () => {
  const game = playing('legacy', 2);
  expect(game.state().discard).toHaveLength(2);
  game.take('ordinary-1#01');
  expect(
    game.apply({ type: 'discard-held' }).events.at(-1)!.effect,
  ).toBeUndefined();
});
