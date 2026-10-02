import { expect, it } from 'vitest';
import type { PublicAction } from '@tablemax/game-sdk';
import { RoomFeedbackSchema } from '../../../packages/protocol/src/index';
import fixtures from '../../../docs/games/pokemon-encounters/scenarios.json';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { rules, type Action } from './index';
import { actor, type State } from './state';
import type { PokemonView } from './project';

function scenario(id: string) {
  const fixture = fixtures.scenarios.find((entry) => entry.id === id)!
    .fixture as unknown as {
    boards: State['boards'];
    deckBottomToTop: string[];
    discardBottomToTop: string[];
    held: string | null;
    turnSeat: string;
    phase: State['phase'];
    winsBySeat: State['winsBySeat'];
  };
  const seats = Object.keys(fixture.boards);
  return {
    ...(rules.initialize({ seats, random: new RandomSource(1) }) as State),
    boards: structuredClone(fixture.boards),
    deck: [...fixture.deckBottomToTop],
    discard: [...fixture.discardBottomToTop],
    held: fixture.held,
    turnSeat: fixture.turnSeat,
    phase: fixture.phase,
    initialDone: seats,
    winsBySeat: { ...fixture.winsBySeat },
  } as State;
}
function apply(state: State, action: Action, random = { next: () => 0.9 }) {
  const acting = actor(state);
  const result = rules.apply(state, action, acting, {
    seats: state.seatOrder,
    random,
  });
  const next = result.state as State;
  expect(rules.validateState(next, next.seatOrder)).toEqual(next);
  expect(result.events!.length).toBeGreaterThan(0);
  const announcement = result.events!.at(-1)!.action!;
  expect(announcement.actor).toBe(acting);
  expect(
    RoomFeedbackSchema.safeParse({
      instanceId: crypto.randomUUID(),
      revision: next.step,
      branch: 0,
      events: result.events,
    }).success,
  ).toBe(true);
  expect(next.events.at(-1)!.action).toEqual(announcement);
  for (const viewer of [
    { role: 'public' },
    { role: 'player', seatId: state.seatOrder.at(-1)! },
  ] as const)
    expect(
      (rules.project(next, viewer) as PokemonView).events.at(-1)!.action,
    ).toEqual(announcement);
  return { next, announcement };
}
const draw = (id: string) =>
  apply(scenario(id), { type: 'draw', source: 'deck' });

it('announces actual Mew and Zapdos actors, card categories and follow-up ability context through the complete effect', () => {
  let state = draw('V03').next;
  const first = apply(state, { type: 'mew-target', seat: 'S2', slot: 5 });
  expect(first.announcement).toMatchObject({
    actor: 'S1',
    verb: 'mew-target',
    cardCategory: 'special-mew',
    ability: 'special-mew',
    targets: [{ seat: 'S2', slots: [5] }],
  });
  state = first.next;
  const incoming = state.held!.split('#')[0];
  const second = apply(state, { type: 'replace', slot: 1 });
  expect(second.announcement).toMatchObject({
    actor: 'S1',
    verb: 'replace',
    cardCategory: incoming,
    ability: 'special-mew',
    targets: [{ seat: 'S1', slots: [1] }],
  });
  expect(second.next.phase).toBe('round-result');
  state = draw('V06').next;
  for (const slot of [5, 1, 2]) {
    const incoming = state.held!.split('#')[0];
    const acting = actor(state);
    const result = apply(state, { type: 'replace', slot });
    expect(result.announcement).toEqual({
      actor: acting,
      verb: 'zapdos-pass',
      cardCategory: incoming,
      ability: 'special-zapdos',
      targets: [{ seat: acting, slots: [slot] }],
    });
    state = result.next;
  }
  expect(state.phase).toBe('round-result');
  expect(state.events.at(-1)!.kind).toBe('round-result');
  expect(state.events.at(-1)!.action!.verb).toBe('zapdos-pass');
});

it('announces Rocket full refill and Snorlax swaps with public target slots', () => {
  const rocket = draw('V05');
  expect(rocket.announcement).toMatchObject({
    verb: 'draw',
    source: 'deck',
    cardCategory: 'special-team-rocket',
    ability: 'special-team-rocket',
  });
  const refill = apply(rocket.next, { type: 'replace', slot: 5 });
  expect(refill.announcement.verb).toBe('rocket-refill');
  expect(refill.announcement.targets).toEqual(
    refill.next.seatOrder.map((seat) => ({ seat, slots: [5] })),
  );
  let state = draw('V07').next;
  state = apply(state, { type: 'replace', slot: 1 }).next;
  const swapped = apply(state, { type: 'swap', a: 1, b: 2 });
  expect(swapped.announcement).toEqual({
    actor: 'S1',
    verb: 'swap',
    cardCategory: 'special-snorlax',
    ability: 'special-snorlax',
    targets: [{ seat: 'S1', slots: [1, 2] }],
  });
  const declined = apply(state, { type: 'decline-ability' });
  expect(declined.announcement).toEqual({
    actor: 'S1',
    verb: 'decline',
    cardCategory: 'special-snorlax',
    ability: 'special-snorlax',
    targets: [],
  });
});

it('keeps Charizard peek position and private card out of every public event and feedback', () => {
  let state = draw('V08').next;
  state = apply(state, { type: 'replace', slot: 1 }).next;
  const peek = apply(state, { type: 'peek', slot: 2 });
  expect(peek.announcement).toEqual({
    actor: 'S1',
    verb: 'peek',
    cardCategory: 'special-charizard',
    ability: 'special-charizard',
    targets: [{ seat: 'S1', slots: [] }],
  });
  const ownerView = rules.project(peek.next, {
    role: 'player',
    seatId: 'S1',
  }) as PokemonView;
  expect(ownerView.peek).not.toBeNull();
  expect(
    (rules.project(peek.next, { role: 'public' }) as PokemonView).peek,
  ).toBeNull();
  const serialized = JSON.stringify(peek.announcement);
  expect(serialized).not.toContain(peek.next.boards.S1![2]!.instanceId);
  expect(serialized).not.toContain('peekSlot');
  expect(serialized).not.toContain('peekCard');
  const closed = apply(peek.next, { type: 'close-peek' });
  expect(closed.announcement).toEqual({
    ...peek.announcement,
    verb: 'close-peek',
  });
  expect(
    (
      rules.project(closed.next, {
        role: 'player',
        seatId: 'S1',
      }) as PokemonView
    ).peek,
  ).toBeNull();
});

it('validates optional action metadata, rejects secret-shaped extensions and keeps legacy events compatible', () => {
  const state = draw('V08').next;
  const original = state.events.at(-1)!.action!;
  const mutations: unknown[] = [
    { ...original, actor: 'unknown-seat' },
    { ...original, cardCategory: 'ordinary-0#01' },
    { ...original, ability: 'unknown-card' },
    { ...original, targets: [{ seat: 'S1', slots: [6] }] },
    { ...original, targets: [{ seat: 'S1', slots: [1, 1] }] },
    { ...original, peekCard: 'ordinary-9' },
    {
      ...original,
      verb: 'peek',
      cardCategory: 'special-charizard',
      ability: 'special-charizard',
      targets: [{ seat: 'S1', slots: [2] }],
    },
  ];
  for (const mutated of mutations) {
    const damaged = structuredClone(state);
    damaged.events.at(-1)!.action = mutated as PublicAction;
    expect(() => rules.validateState(damaged, damaged.seatOrder)).toThrow(
      'Invalid Pokemon state',
    );
  }
  const legacy = structuredClone(state);
  for (const event of legacy.events) delete event.action;
  expect(rules.validateState(legacy, legacy.seatOrder)).toEqual(legacy);
  const finish = apply(draw('V03').next, {
    type: 'mew-target',
    seat: 'S2',
    slot: 5,
  });
  const ended = apply(finish.next, { type: 'replace', slot: 1 }).next;
  // This adopted fixture ends at the ability boundary; lifecycle metadata names
  // public deal slots without any card identities or future deck information.
  expect(ended.phase).toBe('round-result');
  const lifecycle = rules.applyLifecycle(
    ended,
    { type: 'next-round' },
    { seats: ended.seatOrder, random: new RandomSource(13) },
  );
  expect(lifecycle.events!.at(-1)!.action).toEqual({
    actor: null,
    verb: 'deal',
    cardCategory: null,
    ability: null,
    targets: ended.seatOrder.map((seat) => ({
      seat,
      slots: [0, 1, 2, 3, 4, 5],
    })),
  });
  expect(rules.validateState(lifecycle.state, ended.seatOrder)).toEqual(
    lifecycle.state,
  );
});
