import { describe, expect, it } from 'vitest';
import { pokemonExpansion as rules, createInitialState } from '../index';
import { category, card } from '../cards';
import { applyEventEffect } from '../events';
import type { State, Action } from '../state';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import { observeMemory, validateMemory } from './memory';
import { choose } from './strategy';
import { modelCardDefinitions } from './table';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const difficulties = ['default', 'doubao', 'juewu'] as const;
function playing(players = 2) {
  const context = {
    seats: Array.from({ length: players }, (_, i) => `s${i}`),
    random: new RandomSource(121000 + players),
  };
  let state = createInitialState(context, 'events-research-v3');
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state;
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'initial-flip', slot: 0 },
      seat,
      context,
    ).state;
  return { state, context };
}
function put(state: State, seat: string, slot: number, id: string) {
  const outgoing = state.boards[seat]![slot]!.instanceId;
  if (outgoing === id) return;
  const index = state.deck.indexOf(id);
  if (index >= 0) state.deck[index] = outgoing;
  else {
    const discard = state.discard.indexOf(id);
    if (discard >= 0) state.discard[discard] = outgoing;
    else {
      const other = Object.values(state.boards)
        .flat()
        .find((card) => card.instanceId === id)!;
      other.instanceId = outgoing;
    }
  }
  state.boards[seat]![slot] = { instanceId: id, faceUp: true };
}
function top(state: State, id: string) {
  const outgoing = state.deck.at(-1)!;
  const index = state.deck.indexOf(id);
  if (index >= 0) state.deck[index] = outgoing;
  else {
    const discarded = state.discard.indexOf(id);
    if (discarded >= 0) state.discard[discarded] = outgoing;
    else
      Object.values(state.boards)
        .flat()
        .find((slot) => slot.instanceId === id)!.instanceId = outgoing;
  }
  state.deck[state.deck.length - 1] = id;
}

describe('events research v3 authorized bot knowledge and hypotheses', () => {
  it.each(difficulties)(
    '%s: discards the previous round trajectory before research voting and hidden initial deal',
    (difficulty) => {
      const { state: initial, context } = playing();
      const actor = initial.turnSeat;
      const observer = initial.seatOrder.find((seat) => seat !== actor)!;
      top(initial, 'ordinary-1#01');
      initial.randomEvent!.markerInstanceId = initial.deck.find(
        (id) => id !== 'ordinary-1#01',
      )!;
      for (const [slot, physical] of initial.boards[actor]!.entries())
        physical.faceUp = slot !== 8;
      let settled = rules.apply(
        initial,
        { type: 'draw', source: 'deck' },
        actor,
        context,
      ).state;
      settled = rules.apply(
        settled,
        { type: 'replace', slot: 8 },
        actor,
        context,
      ).state;
      expect(settled.phase).toBe('round-result');
      const input = observeMemory(
        null,
        rules.project(settled, { role: 'player', seatId: observer }),
        observer,
        difficulty,
      );
      expect(Object.values(input.known).flat().some(Boolean)).toBe(true);
      let next = rules.applyLifecycle(
        settled,
        { type: 'next-round' },
        context,
      ).state;
      expect(next.phase).toBe('research-vote');
      expect(
        next.events.some((event) => event.action?.verb === 'replace'),
      ).toBe(true);
      const view = rules.project(next, { role: 'player', seatId: observer });
      const reset = observeMemory(input, view, observer, difficulty);
      expect(
        Object.values(reset.known)
          .flat()
          .every((known) => known === null),
      ).toBe(true);
      expect(reset.lastEvent).toBe(next.eventCounter);
      expect(observeMemory(null, view, observer, difficulty).known).toEqual(
        reset.known,
      );
      for (const seat of context.seats)
        next = rules.apply(
          next,
          { type: 'vote-research', taskId: next.researchCandidates[0]! },
          seat,
          context,
        ).state;
      expect(next.phase).toBe('initial-flip');
      const dealt = observeMemory(
        reset,
        rules.project(next, { role: 'player', seatId: observer }),
        observer,
        difficulty,
      );
      expect(
        Object.values(dealt.known)
          .flat()
          .every((known) => known === null),
      ).toBe(true);
      if (difficulty === 'juewu') {
        const directory = resolve(
          'artifacts/maintenance/v1.0.6/pokemon-events-v3-verification/private-bot-diagnostics',
        );
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          join(directory, 'minimal-next-round-memory-reset.json'),
          JSON.stringify(
            {
              classification:
                'Private local minimal regression fixture; not an original failed-seed snapshot. Do not publish.',
              reason:
                'New round memory replayed retained previous-round placement events into empty research-vote boards, then incorrectly retained those roles after a fresh hidden deal.',
              before: settled,
              after: next,
              inputMemory: input,
              resultMemory: dealt,
              authorizedEvents: view.events,
              authorizedView: view,
            },
            null,
            2,
          ) + '\n',
        );
      }
      next = rules.apply(
        next,
        { type: 'initial-flip', slot: 0 },
        observer,
        context,
      ).state;
      const flipped = observeMemory(
        dealt,
        rules.project(next, { role: 'player', seatId: observer }),
        observer,
        difficulty,
      );
      expect(Object.values(flipped.known).flat().filter(Boolean)).toHaveLength(
        1,
      );
      expect(flipped.known[observer]![0]?.category).toBe(
        card(next.boards[observer]![0]!.instanceId, 'events-research-v3')
          .categoryId,
      );
    },
  );

  it.each([false, true])(
    'replays public Greninja placement followed by cover/swap=%s between observations without keeping the old role',
    (swap) => {
      const { state: initial, context } = playing();
      const actor = initial.turnSeat;
      const observer = initial.seatOrder.find((seat) => seat !== actor)!;
      put(initial, actor, 0, 'special-snorlax#01');
      put(initial, actor, 1, 'special-charizard#01');
      top(initial, 'special-greninja#01');
      initial.randomEvent!.markerInstanceId = initial.deck.find(
        (id) => id !== 'special-greninja#01',
      )!;
      const before = structuredClone(initial);
      const input = observeMemory(
        null,
        rules.project(initial, { role: 'player', seatId: observer }),
        observer,
        'juewu',
      );
      let state = rules.apply(
        initial,
        { type: 'draw', source: 'deck' },
        actor,
        context,
      ).state;
      state = rules.apply(
        state,
        { type: 'replace', slot: 0 },
        actor,
        context,
      ).state;
      state = rules.apply(
        state,
        { type: 'ninja-target', seat: actor, a: 0, b: 1, swap },
        actor,
        context,
      ).state;
      const view = rules.project(state, { role: 'player', seatId: observer });
      const observed = observeMemory(input, view, observer, 'juewu');
      expect(view.boards[actor]![0]!.card).toBeNull();
      expect(view.boards[actor]![1]!.card).toBeNull();
      expect(observed.known[actor]![swap ? 1 : 0]).toMatchObject({
        category: 'special-greninja',
        abilityUsed: true,
        source: 'public',
      });
      expect(observed.known[actor]![swap ? 0 : 1]?.category).toBe(
        'special-charizard',
      );
      expect(observeMemory(observed, view, observer, 'juewu')).toEqual(
        observed,
      );
      const directory = resolve(
        'artifacts/maintenance/v1.0.6/pokemon-events-v3-verification/private-bot-diagnostics',
      );
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, `minimal-public-placement-cover-${swap}.json`),
        JSON.stringify(
          {
            classification:
              'Private local minimal regression fixture; not an original failed-seed snapshot. Do not publish.',
            reason:
              'Old observer replayed cover/swap but did not replace stale Snorlax identity with the publicly placed Greninja identity.',
            before,
            after: state,
            inputMemory: input,
            resultMemory: observed,
            authorizedEvents: view.events,
            authorizedView: view,
          },
          null,
          2,
        ) + '\n',
      );
    },
  );

  it('uses public Mewtwo exchange identity and invalidates all unknown Rocket Pikachu supplements', () => {
    const { state } = playing();
    const actor = state.turnSeat;
    const observer = state.seatOrder.find((seat) => seat !== actor)!;
    put(state, observer, 1, 'special-charizard#01');
    const input = observeMemory(
      null,
      rules.project(state, { role: 'player', seatId: observer }),
      observer,
      'juewu',
    );
    const view = rules.project(state, { role: 'player', seatId: observer });
    view.boards[observer]![1] = {
      ...view.boards[observer]![1]!,
      faceUp: false,
      card: null,
    };
    view.events.push({
      id: state.eventCounter + 1,
      kind: 'action',
      text: '公开超梦换入',
      action: {
        actor,
        verb: 'mewtwo-exchange',
        cardCategory: 'special-mewtwo',
        ability: 'mewtwo',
        targets: [{ seat: observer, slots: [1] }],
      },
    });
    const exchanged = observeMemory(input, view, observer, 'juewu');
    expect(exchanged.known[observer]![1]?.category).toBe('special-mewtwo');
    view.events.push(
      {
        id: state.eventCounter + 2,
        kind: 'draw',
        text: '公开火箭队皮卡丘面',
        effect: { coin: 'pikachu', entrance: 'team-rocket' },
        action: {
          actor,
          verb: 'draw',
          cardCategory: 'special-team-rocket',
          ability: null,
          source: 'deck',
          targets: [],
        },
      },
      {
        id: state.eventCounter + 3,
        kind: 'action',
        text: '公开补牌',
        action: {
          actor,
          verb: 'replace',
          cardCategory: 'special-team-rocket',
          ability: 'team-rocket',
          targets: [{ seat: actor, slots: [1] }],
        },
      },
    );
    const replaced = observeMemory(exchanged, view, observer, 'juewu');
    expect(replaced.known[observer]![1]).toBeNull();
    expect(replaced.known[actor]![1]).toBeNull();
  });
  for (const difficulty of difficulties)
    it(`${difficulty}: maps only previously known trick-room roles once and samples transformed overrepresented roles without inventing knowledge`, () => {
      const { state } = playing(),
        seat = state.turnSeat;
      for (let slot = 0; slot < 7; slot++)
        put(
          state,
          seat,
          slot,
          `ordinary-rowlet#${String(slot + 1).padStart(2, '0')}`,
        );
      const before = rules.project(state, { role: 'player', seatId: seat });
      const memory = observeMemory(null, before, seat, difficulty);
      state.randomEvent = {
        markerInstanceId: null,
        kind: 'trick-room',
        triggered: true,
        protected: false,
      };
      applyEventEffect(state);
      for (let slot = 0; slot < 7; slot++)
        state.boards[seat]![slot]!.faceUp = false;
      state.events.push({
        id: ++state.eventCounter,
        kind: 'special-event',
        text: '戏法空间开始',
        effect: { eventKind: 'trick-room' },
      });
      const view = rules.project(state, { role: 'player', seatId: seat });
      const observed = observeMemory(memory, view, seat, difficulty);
      expect(
        observed.known[seat]!.slice(0, 7).every(
          (known) =>
            known?.category === 'ordinary-metagross' &&
            known.originalCategory === 'ordinary-rowlet',
        ),
      ).toBe(true);
      expect(observed.known[seat]![7]).toBe(memory.known[seat]![7]);
      expect(observeMemory(observed, view, seat, difficulty)).toEqual(observed);
      expect(() => validateMemory(observed)).not.toThrow();
      const actions = rules.legalActions(state, seat),
        input = structuredClone({ view, observed, actions });
      expect(actions).toContainEqual(
        choose(
          view,
          actions,
          observed,
          difficulty,
          new RandomSource(1206),
          new AbortController().signal,
        ),
      );
      expect({ view, observed, actions }).toEqual(input);
    }, 15000);

  for (const difficulty of difficulties)
    it(`${difficulty}: samples publicly known effective roles with ambiguous originals after trick-room without over-reserving a physical category`, () => {
      const { state } = playing(),
        seat = state.turnSeat;
      for (let slot = 0; slot < 7; slot++)
        put(
          state,
          seat,
          slot,
          `ordinary-rowlet#${String(slot + 1).padStart(2, '0')}`,
        );
      const input = observeMemory(
        null,
        rules.project(state, { role: 'player', seatId: seat }),
        seat,
        difficulty,
      );
      state.randomEvent = {
        markerInstanceId: null,
        kind: 'trick-room',
        triggered: true,
        protected: false,
      };
      applyEventEffect(state);
      state.events.push({
        id: ++state.eventCounter,
        kind: 'special-event',
        text: '戏法空间',
        effect: { eventKind: 'trick-room' },
      });
      for (let slot = 0; slot < 7; slot++) {
        state.boards[seat]![slot]!.faceUp = false;
        state.events.push({
          id: ++state.eventCounter,
          kind: 'action',
          text: '公开有效角色换入',
          action: {
            actor: seat,
            verb: 'replace',
            cardCategory: 'ordinary-metagross',
            ability: null,
            targets: [{ seat, slots: [slot] }],
          },
        });
      }
      const view = rules.project(state, { role: 'player', seatId: seat });
      const observed = observeMemory(input, view, seat, difficulty);
      expect(
        observed.known[seat]!.slice(0, 7).every(
          (known) =>
            known?.category === 'ordinary-metagross' &&
            known.originalCategory === undefined,
        ),
      ).toBe(true);
      const actions = rules.legalActions(state, seat);
      expect(actions).toContainEqual(
        choose(
          view,
          actions,
          observed,
          difficulty,
          new RandomSource(1207),
          new AbortController().signal,
        ),
      );
    }, 15000);

  for (const difficulty of difficulties)
    it(`${difficulty}: evaluates single-slot Mewtwo targets using only the supplied actions`, () => {
      const { state } = playing(),
        seat = state.turnSeat;
      const view = rules.project(state, { role: 'player', seatId: seat });
      view.phase = 'mewtwo-target';
      const other = state.seatOrder.find((id) => id !== seat)!;
      const actions: Action[] = [
        { type: 'mewtwo-target', seat: other, slot: 0 },
        { type: 'mewtwo-target', seat: other, slot: 1 },
      ];
      const memory = observeMemory(null, view, seat, difficulty);
      const selected = choose(
        view,
        actions,
        memory,
        difficulty,
        new RandomSource(1251),
        new AbortController().signal,
      );
      expect(actions).toContainEqual(selected);
      expect(selected).toHaveProperty('slot');
      expect(selected).not.toHaveProperty('a');
      expect(selected).not.toHaveProperty('b');
    });

  it('resolves weather from the effective role once and does not mutate synthetic definitions', () => {
    const id = 'ordinary-rowlet#01';
    const definitions = {
      [id]: category('ordinary-metagross', 'events-research-v3'),
    };
    const before = structuredClone(definitions);
    expect(
      modelCardDefinitions(
        [id],
        'events-research-v3',
        definitions,
        'sandstorm',
      )[id]!.value,
    ).toBe(3);
    expect(
      modelCardDefinitions(
        [id],
        'events-research-v3',
        definitions,
        'sandstorm',
      )[id]!.value,
    ).toBe(3);
    expect(
      modelCardDefinitions([id], 'events-research-v3', definitions, 'snow')[id]!
        .value,
    ).toBe(5);
    expect(definitions).toEqual(before);
    expect(card(id, 'events-research-v3').categoryId).toBe('ordinary-rowlet');
  });
});
