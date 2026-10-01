import { describe, expect, it } from 'vitest';
import fixtures from '../../../docs/games/pokemon-encounters/scenarios.json';
import { rules, type Action } from './index';
import { actor, type State } from './state';
import { scoreBoard } from './scoring';
import { bot } from '../bot';
import { RandomSource } from '../../../packages/platform-core/src/random';
import type { JsonValue } from '@tablemax/game-sdk';
import type { PokemonView } from './project';

type Fixture = {
  boards: State['boards'];
  deckBottomToTop: string[];
  discardBottomToTop: string[];
  held: string | null;
  turnSeat: string;
  phase: string;
  winsBySeat: Record<string, number>;
};
export function fixture(id: string): State {
  const f = fixtures.scenarios.find((s) => s.id === id)!.fixture as Fixture;
  const base = rules.initialize({
    seats: Object.keys(f.boards),
    random: new RandomSource(1),
  }) as State;
  return {
    ...base,
    boards: structuredClone(f.boards),
    deck: [...f.deckBottomToTop],
    discard: [...f.discardBottomToTop],
    held: f.held,
    turnSeat: f.turnSeat,
    phase: f.phase === 'initial' ? 'initial-flip' : (f.phase as State['phase']),
    initialDone: f.phase === 'initial' ? [] : Object.keys(f.boards),
    winsBySeat: { ...f.winsBySeat },
  };
}
function apply(
  s: State,
  a: Action,
  seat = actor(s),
  random = new RandomSource(17),
): State {
  const next = rules.apply(s, a, seat, { seats: s.seatOrder, random })
    .state as State;
  expect(rules.validateState(next, s.seatOrder)).toEqual(next);
  return next;
}
const draw = (s: State, random = new RandomSource(17)) =>
  apply(s, { type: 'draw', source: 'deck' }, s.turnSeat, random);

describe('Pokemon adopted rules V00–V11', () => {
  it('V00 replays three complete 56-instance round traces with authoritative scores', () => {
    let s = fixture('V00');
    for (let number = 1; number <= 3; number++) {
      s.roundNumber = number;
      const steps = fixtures.scenarios[0]!.steps as {
        round: number;
        action: string;
        seat: string;
        parameters: Record<string, JsonValue>;
        expectedHeldCategory?: string;
      }[];
      for (const step of steps.filter(
        (step) => step.round === number && step.action !== 'next-round',
      )) {
        s = apply(
          s,
          { type: step.action, ...step.parameters } as Action,
          step.seat!,
        );
        if (step.expectedHeldCategory)
          expect(s.held!.split('#')[0]).toBe(step.expectedHeldCategory);
      }
      expect(s.roundResult!.scores.S1!.columns).toEqual([13, 4, 9]);
      expect(s.roundResult!.scores.S1!.total).toBe(26);
      expect(s.roundResult!.scores.S2!.total).toBe(28);
      expect(s.winsBySeat.S1).toBe(number);
      if (number < 3) {
        const next = rules.applyLifecycle(
          s,
          { type: 'next-round' },
          { seats: s.seatOrder, random: new RandomSource(31) },
        ).state as State;
        expect(next.turnSeat).toBe('S1');
        expect(next.discard).toEqual([]);
        expect(rules.validateState(next, next.seatOrder)).toEqual(next);
        // Specification injects a saved card order per round, independently of PRNG implementation.
        s = { ...fixture('V00'), winsBySeat: next.winsBySeat };
      }
    }
    expect(s.phase).toBe('match-result');
    expect(s.matchWinners).toEqual(['S1']);
    expect(rules.lifecycleActions(s)).toEqual([]);
  });
  it('V01 deals round robin for 2–5 seats and waits for every initial choice without abilities', () => {
    for (let count = 2; count <= 5; count++) {
      const seats = Array.from({ length: count }, (_, i) => `S${i + 1}`);
      let s = rules.initialize({
        seats,
        hostSeat: seats[1]!,
        random: new RandomSource(13),
      }) as State;
      expect(s.turnSeat).toBe(seats[1]);
      expect(s.deck).toHaveLength(56 - 6 * count);
      const firstCard = s.boards[seats[1]!]![0]!.instanceId;
      const replay = rules.initialize({
        seats,
        hostSeat: seats[1]!,
        random: new RandomSource(13),
      }) as State;
      expect(replay.boards[seats[1]!]![0]!.instanceId).toBe(firstCard);
      for (const seat of seats) {
        s = apply(s, { type: 'initial-flip', slot: 0 }, seat);
        expect(s.boards[seat]!.filter((c) => c.faceUp)).toHaveLength(1);
      }
      expect(s.phase).toBe('draw');
      expect(s.discard).toEqual([]);
      expect(s.turnSeat).toBe(seats[1]);
    }
  });
  it('V02 enforces source-specific placement, direct discard, and unchanged rejected state', () => {
    let s = fixture('V00');
    s = apply(s, { type: 'initial-flip', slot: 0 }, 'S1');
    s = apply(s, { type: 'initial-flip', slot: 0 }, 'S2');
    expect(rules.legalActions(s, 'S1')).toEqual([
      { type: 'draw', source: 'deck' },
    ]);
    const before = structuredClone(s);
    expect(() =>
      rules.apply(s, { type: 'draw', source: 'discard' }, 'S1', {
        seats: s.seatOrder,
        random: new RandomSource(1),
      }),
    ).toThrow();
    expect(s).toEqual(before);
    s = draw(s);
    const held = s.held;
    s = apply(s, { type: 'discard-held' });
    expect(s.discard.at(-1)).toBe(held);
    expect(s.boards.S1!.filter((c) => c.faceUp)).toHaveLength(1);
    s = apply(s, { type: 'draw', source: 'discard' });
    expect(
      rules
        .legalActions(s, 'S2')
        .some((a) => (a as Action).type === 'discard-held'),
    ).toBe(false);
    const outgoing = s.boards.S2![1]!.instanceId;
    s = apply(s, { type: 'replace', slot: 1 });
    expect(s.discard.at(-1)).toBe(outgoing);
  });
  it('V03 Mew finishes second placement after the other board becomes fully visible', () => {
    let s = draw(fixture('V03'));
    expect(s.phase).toBe('mew-other');
    s = apply(s, { type: 'mew-target', seat: 'S2', slot: 5 });
    expect(s.phase).toBe('mew-self');
    expect(s.boards.S2!.every((c) => c.faceUp)).toBe(true);
    expect(s.roundResult).toBeNull();
    s = apply(s, { type: 'replace', slot: 1 });
    expect(s.phase).toBe('round-result');
    expect(s.held).toBeNull();
  });
  it('V04 coin is saved before selection and Meowth completes the replacement', () => {
    const base = fixture('V04');
    const random = { next: () => 0.1 };
    let s = rules.apply(base, { type: 'draw', source: 'deck' }, 'S1', {
      seats: base.seatOrder,
      random,
    }).state as State;
    expect(s.coin).toBe('meowth');
    expect(s.phase).toBe('rocket-meowth');
    const after = apply(s, { type: 'replace', slot: 5 });
    expect(after.phase).toBe('round-result');
    expect(after.discard.at(-1)).toBe(s.boards.S1![5]!.instanceId);
    s = rules.validateState(
      JSON.parse(JSON.stringify(s)),
      s.seatOrder,
    ) as State;
    expect(s.coin).toBe('meowth');
  });
  it('V05 Pikachu places all same-slot discards in exact P03 order and refills without chaining', () => {
    const base = fixture('V05');
    const random = { next: () => 0.9 };
    let s = rules.apply(base, { type: 'draw', source: 'deck' }, 'S1', {
      seats: base.seatOrder,
      random,
    }).state as State;
    const ids = s.seatOrder.map((seat) => s.boards[seat]![5]!.instanceId);
    const rocket = s.held!;
    s = apply(s, { type: 'replace', slot: 5 });
    expect(s.discard.slice(0, 4)).toEqual([ids[2], ids[1], rocket, ids[0]]);
    expect(s.boards.S3![5]!.faceUp).toBe(true);
    expect(s.phase).toBe('round-result');
    expect(s.held).toBeNull();
  });
  it('V06 Zapdos preserves origin turn while each remaining player chooses once', () => {
    let s = draw(fixture('V06'));
    s = apply(s, { type: 'replace', slot: 5 });
    expect(s.turnSeat).toBe('S1');
    expect(actor(s)).toBe('S2');
    expect(s.roundResult).toBeNull();
    s = apply(s, { type: 'replace', slot: 1 });
    expect(actor(s)).toBe('S3');
    expect(s.turnSeat).toBe('S1');
    const last = s.boards.S3![2]!.instanceId;
    s = apply(s, { type: 'replace', slot: 2 });
    expect(s.discard[0]).toBe(last);
    expect(s.phase).toBe('round-result');
  });
  it('V07 Snorlax swap preserves orientation and decline is a separate legal choice', () => {
    let s = draw(fixture('V07'));
    s = apply(s, { type: 'replace', slot: 1 });
    expect(s.phase).toBe('snorlax-choice');
    expect(rules.legalActions(s, 'S1')).toHaveLength(16);
    const board = structuredClone(s.boards.S1!);
    const swapped = apply(s, { type: 'swap', a: 1, b: 2 });
    expect(swapped.boards.S1![1]).toEqual(board[2]);
    expect(swapped.boards.S1![2]).toEqual(board[1]);
    const declined = apply(s, { type: 'decline-ability' });
    expect(declined.boards.S1).toEqual(board);
    expect(() => rules.validateAction({ type: 'swap', a: 1, b: 1 })).toThrow();
  });
  it('V08 Charizard peek belongs only to the actor and is erased on close; no target skips', () => {
    let s = draw(fixture('V08'));
    s = apply(s, { type: 'replace', slot: 1 });
    expect(s.phase).toBe('charizard-choice');
    s = apply(s, { type: 'peek', slot: 2 });
    expect(
      (rules.project(s, { role: 'player', seatId: 'S1' }) as PokemonView).peek,
    ).not.toBeNull();
    for (const viewer of [
      { role: 'public' },
      { role: 'player', seatId: 'S2' },
    ] as const)
      expect((rules.project(s, viewer) as PokemonView).peek).toBeNull();
    expect(s.boards.S1![2]!.faceUp).toBe(false);
    s = apply(s, { type: 'close-peek' });
    expect(
      (rules.project(s, { role: 'player', seatId: 'S1' }) as PokemonView).peek,
    ).toBeNull();
    s = draw(fixture('V08'));
    s.boards.S1!.forEach((c, i) => {
      c.faceUp = i !== 5;
    });
    s = apply(s, { type: 'replace', slot: 5 });
    expect(s.phase).toBe('round-result');
  });
  it('V09 recycles the entire discard deterministically, including Rocket refills', () => {
    const base = fixture('V03');
    base.discard = base.deck;
    base.deck = [];
    const a = draw(base, new RandomSource(67)),
      b = draw(base, new RandomSource(67));
    expect(a).toEqual(b);
    expect(a.discard).toEqual([]);
    expect(a.deck).toHaveLength(base.discard.length - 1);
    const rocket = fixture('V05');
    rocket.discard = rocket.deck;
    rocket.deck = [];
    const id = 'special-team-rocket#01';
    rocket.discard.splice(rocket.discard.indexOf(id), 1);
    rocket.held = id;
    rocket.phase = 'rocket-pikachu';
    rocket.coin = 'pikachu';
    rocket.drawSource = 'deck';
    const restored = apply(rocket, { type: 'replace', slot: 5 });
    expect(restored.discard).toEqual([]);
    expect(restored.boards.S3![5]).toBeTruthy();
  });
  it('V10 optimizes complete-board pairing, handles chained Ditto, negative pairs and fixed ties', () => {
    expect(
      scoreBoard(fixture('V10').boards.S1!.map((c) => c.instanceId)),
    ).toMatchObject({
      values: [1, 5, 5, 0, 5, 9],
      columns: [1, 0, 14],
      total: 15,
    });
    expect(
      scoreBoard([
        'special-ditto#01',
        'special-ditto#02',
        'ordinary-4#01',
        'ordinary-4#02',
        'ordinary-4#03',
        'ordinary-0#01',
      ]).values,
    ).toEqual([4, 4, 4, 4, 4, 0]);
    expect(
      scoreBoard([
        'ordinary--2#01',
        'ordinary-0#01',
        'ordinary-1#01',
        'ordinary--2#02',
        'ordinary-0#02',
        'ordinary-1#02',
      ]).total,
    ).toBe(0);
    expect(
      scoreBoard([
        'ordinary-1#01',
        'special-ditto#01',
        'ordinary-1#02',
        'ordinary-3#01',
        'ordinary-0#01',
        'ordinary-5#01',
      ]).copies[0]!.direction,
    ).toBe('left');
  });
  it('V11 ties give every winner a victory and simultaneous third wins end jointly', () => {
    let s = fixture('V00');
    s.phase = 'place';
    s.initialDone = s.seatOrder;
    s.drawSource = 'deck';
    const id = s.deck.pop()!;
    s.held = id;
    // Keep identical numeric boards with distinct instances, reassemble unused deck.
    const values = [
      'ordinary--2',
      'ordinary-0',
      'ordinary-1',
      'ordinary-3',
      'ordinary-4',
      'ordinary-5',
    ];
    s.boards = Object.fromEntries(
      s.seatOrder.map((seat, i) => [
        seat,
        values.map((v) => ({ instanceId: `${v}#0${i + 1}`, faceUp: true })),
      ]),
    );
    const used = new Set(
      Object.values(s.boards)
        .flat()
        .map((c) => c.instanceId),
    );
    const original = rules.initialize({
      seats: s.seatOrder,
      random: new RandomSource(1),
    }) as State;
    const all = [
      ...original.deck,
      ...Object.values(original.boards)
        .flat()
        .map((c) => c.instanceId),
    ];
    s.held = all.find((c) => !used.has(c))!;
    s.deck = all.filter((c) => !used.has(c) && c !== s.held);
    s.winsBySeat = { S1: 2, S2: 2 };
    s = apply(s, { type: 'discard-held' });
    expect(s.phase).toBe('match-result');
    expect(s.matchWinners).toEqual(['S1', 'S2']);
  });
  it('rejects duplicate cards, wrong versions, damaged queues and revealed hidden identity leaks', () => {
    const s = fixture('V03');
    const damaged = structuredClone(s);
    damaged.deck[0] = damaged.boards.S1![0]!.instanceId;
    expect(() => rules.validateState(damaged, s.seatOrder)).toThrow();
    expect(() =>
      rules.validateState({ ...s, rulesVersion: 'old' }, s.seatOrder),
    ).toThrow();
    const view = rules.project(s, { role: 'public' });
    const serialized = JSON.stringify(view);
    for (const slot of Object.values(s.boards)
      .flat()
      .filter((c) => !c.faceUp))
      expect(serialized).not.toContain(slot.instanceId);
    for (const id of s.deck) expect(serialized).not.toContain(id);
    expect(() =>
      rules.validateAction({ type: 'replace', slot: 0, instanceId: 'secret' }),
    ).toThrow();
  });
});

it('V17/18 deterministic bots finish 2–5 player three-win matches over fixed seeds without using RNG or hidden cards', async () => {
  const phases = new Set<string>();
  for (let count = 2; count <= 5; count++)
    for (const seed of [1, 13, 31, 101, 739]) {
      const seats = Array.from({ length: count }, (_, i) => `S${i + 1}`);
      const random = new RandomSource(seed);
      let s = rules.initialize({ seats, random }) as State;
      let steps = 0;
      while (!rules.ended(s) && steps++ < 1500) {
        phases.add(s.phase);
        if (s.phase === 'round-result') {
          s = rules.applyLifecycle(s, { type: 'next-round' }, { seats, random })
            .state as State;
          continue;
        }
        const decision = rules.decisions(s)[0]!;
        const view = rules.project(s, {
          role: 'player',
          seatId: decision.seatId,
        });
        const result = await bot.decide({
          view,
          actions: rules.legalActions(s, decision.seatId),
          decision,
          memory: null,
          signal: new AbortController().signal,
          random: {
            next() {
              throw new Error('Basic strategy must not draw RNG');
            },
          },
        });
        expect(rules.legalActions(s, decision.seatId)).toContainEqual(
          result.action,
        );
        s = rules.apply(s, result.action as JsonValue, decision.seatId, {
          seats,
          random,
        }).state as State;
        rules.validateState(s, seats);
      }
      expect(steps).toBeLessThan(1500);
      expect(s.matchWinners.length).toBeGreaterThan(0);
    }
  for (const phase of [
    'initial-flip',
    'draw',
    'place',
    'mew-other',
    'mew-self',
    'rocket-meowth',
    'rocket-pikachu',
    'zapdos-self',
    'zapdos-receive',
    'snorlax-choice',
    'charizard-choice',
    'charizard-view',
  ])
    expect(phases.has(phase), phase).toBe(true);
});
