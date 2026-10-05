import { describe, expect, it } from 'vitest';
import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { bot } from './index';
import {
  EVALUATION_WORLDS,
  integrationPoint,
  PositionEvaluator,
} from './evaluation';
import { observeMemory, type StrategyMemory } from './memory';
import { instances } from '../rules/cards';
import { rules, type Action } from '../rules';
import type { State } from '../rules/state';
import type { PokemonView } from '../rules/project';
import { scoreBoard } from '../rules/scoring';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { basicAction } from './strategy';

type CardSpec = string | { id: string; hidden: true };
const hidden = (id: string): CardSpec => ({ id, hidden: true });
const defaultOther: CardSpec[] = [
  'ordinary-0',
  'ordinary-1',
  hidden('ordinary-3'),
  hidden('ordinary-4'),
  hidden('ordinary-5'),
  hidden('ordinary-6'),
];

function position(
  phase: State['phase'],
  own: CardSpec[],
  options: { opponents?: CardSpec[][]; held?: string; discard?: string } = {},
) {
  const specifications = [own, ...(options.opponents ?? [defaultOther])];
  const seats = specifications.map((_, index) => `S${index + 1}`);
  const state = rules.initialize({
    seats,
    random: new RandomSource(1),
  }) as State;
  const available = [...instances];
  const allocate = (category: string) => {
    const index = available.findIndex(
      (instance) => instance.split('#')[0] === category,
    );
    if (index < 0)
      throw new Error(`Fixture exceeds card quantity: ${category}`);
    return available.splice(index, 1)[0]!;
  };
  state.boards = Object.fromEntries(
    specifications.map((board, index) => [
      seats[index]!,
      board.map((spec) => ({
        instanceId: allocate(typeof spec === 'string' ? spec : spec.id),
        faceUp: typeof spec === 'string',
      })),
    ]),
  );
  state.held = options.held ? allocate(options.held) : null;
  state.discard = options.discard ? [allocate(options.discard)] : [];
  state.deck = available;
  state.phase = phase;
  state.turnSeat = 'S1';
  state.initialDone = seats;
  state.drawSource = state.held ? 'deck' : null;
  if (phase === 'rocket-meowth') state.coin = 'meowth';
  if (phase === 'rocket-pikachu') state.coin = 'pikachu';
  return state;
}
async function choose(
  state: State,
  difficulty: BotDifficulty,
  memory: JsonValue = null,
) {
  const decision = rules
    .decisions(state)
    .find((decision) => decision.seatId === 'S1')!;
  return bot.decide({
    difficulty,
    view: rules.project(state, { role: 'player', seatId: decision.seatId }),
    actions: rules.legalActions(state, decision.seatId),
    decision,
    memory,
    random: {
      next() {
        throw new Error('Deterministic strategy consumed RNG');
      },
    },
    signal: new AbortController().signal,
  });
}
function apply(state: State, action: Action) {
  return rules.apply(state, action, 'S1', {
    seats: state.seatOrder,
    random: new RandomSource(3),
  }).state as State;
}

describe('Three local bot difficulty levels', () => {
  it('uses the previous public winner to break an otherwise equal default-level Mew choice', async () => {
    const opponent = [
      'ordinary--2',
      'ordinary-0',
      hidden('ordinary-1'),
      hidden('ordinary-3'),
      hidden('ordinary-4'),
      hidden('ordinary-5'),
    ];
    const state = position(
      'mew-other',
      [
        'ordinary-9',
        'ordinary-8',
        hidden('ordinary-6'),
        'ordinary-9',
        'ordinary-8',
        hidden('ordinary-7'),
      ],
      { held: 'special-mew', opponents: [opponent, opponent] },
    );
    state.roundNumber = 2;
    const view = rules.project(state, {
      role: 'player',
      seatId: 'S1',
    }) as PokemonView;
    const memory = observeMemory(null, view, 'S1', 'default');
    expect(
      (await choose(state, 'default', memory as JsonValue)).action,
    ).toEqual({
      type: 'mew-target',
      seat: 'S2',
      slot: 0,
    });
    if (memory.version !== 2) throw new Error('Expected current memory');
    memory.summaries = [
      { round: 1, turns: 5, winners: ['S3'], scores: { S1: 12, S2: 5, S3: 0 } },
    ];
    expect(
      (await choose(state, 'default', memory as JsonValue)).action,
    ).toEqual({
      type: 'mew-target',
      seat: 'S3',
      slot: 0,
    });
  });
  it('uses future ordinary turns to change a short-horizon choice within fixed node limits', () => {
    let changed = false;
    for (let seed = 1; seed <= 20 && !changed; seed++) {
      const seats = ['S1', 'S2', 'S3'];
      const random = new RandomSource(seed);
      let state = rules.initialize({ seats, random }) as State;
      for (const seat of seats)
        state = rules.apply(state, { type: 'initial-flip', slot: 0 }, seat, {
          seats,
          random,
        }).state as State;
      state = rules.apply(
        state,
        { type: 'draw', source: 'deck' },
        state.turnSeat,
        { seats, random },
      ).state as State;
      const seat = state.turnSeat;
      const view = rules.project(state, {
        role: 'player',
        seatId: seat,
      }) as PokemonView;
      const memory = observeMemory(null, view, seat);
      const actions = rules.legalActions(state, seat) as Action[];
      for (const difficulty of ['doubao', 'juewu'] as const) {
        const short = new PositionEvaluator(
          view,
          seat,
          memory,
          new AbortController().signal,
          difficulty,
        ).choose(actions, 0);
        const evaluator = new PositionEvaluator(
          view,
          seat,
          memory,
          new AbortController().signal,
          difficulty,
        );
        const future = evaluator.choose(actions);
        expect(evaluator.statistics.worlds).toBe(
          difficulty === 'doubao' ? 8 : 32,
        );
        expect(evaluator.statistics.expandedNodes).toBeLessThanOrEqual(
          difficulty === 'doubao' ? 4096 : 8192,
        );
        expect(evaluator.statistics.cachedScores).toBeLessThanOrEqual(20000);
        changed ||= JSON.stringify(short) !== JSON.stringify(future);
      }
    }
    expect(
      changed,
      'at least one information-set decision accounts for the future',
    ).toBe(true);
  });
  it('all levels exploit a known pair before a blind replacement', async () => {
    const state = position(
      'place',
      [
        hidden('ordinary-4'),
        'ordinary-9',
        'ordinary-8',
        'ordinary-3',
        'ordinary-9',
        hidden('ordinary-5'),
      ],
      { held: 'ordinary-8' },
    );
    expect((await choose(state, 'default')).action).toEqual({
      type: 'replace',
      slot: 5,
    });
    for (const difficulty of ['doubao', 'juewu'] as const)
      expect((await choose(state, difficulty)).action).toEqual({
        type: 'replace',
        slot: 5,
      });
  });
  it('takes a valuable discard and discards a worse card without breaking a pair', async () => {
    const own = [
      hidden('ordinary-4'),
      'ordinary-9',
      'ordinary-8',
      'ordinary-3',
      'ordinary-9',
      hidden('ordinary-5'),
    ];
    const draw = position('draw', own, { discard: 'ordinary-8' });
    expect((await choose(draw, 'default')).action).toEqual({
      type: 'draw',
      source: 'discard',
    });
    for (const difficulty of ['doubao', 'juewu'] as const)
      expect((await choose(draw, difficulty)).action).toEqual({
        type: 'draw',
        source: 'discard',
      });
    const bad = position(
      'place',
      [
        'ordinary-0',
        'ordinary-1',
        hidden('ordinary--2'),
        'ordinary-0',
        'ordinary-1',
        hidden('ordinary--2'),
      ],
      { held: 'ordinary-9' },
    );
    for (const difficulty of ['doubao', 'juewu'] as const)
      expect((await choose(bad, difficulty)).action).toEqual({
        type: 'discard-held',
      });
  });
  it('uses an optional swap to complete two columns', async () => {
    const state = position('snorlax-choice', [
      'ordinary-9',
      'ordinary-8',
      'special-snorlax',
      'ordinary-8',
      'ordinary-9',
      hidden('ordinary-3'),
    ]);
    expect((await choose(state, 'default')).action).toEqual({
      type: 'swap',
      a: 0,
      b: 1,
    });
    for (const difficulty of ['doubao', 'juewu'] as const) {
      const action = (await choose(state, difficulty)).action as Action;
      expect(action.type).toBe('swap');
      const board = apply(state, action).boards.S1!;
      expect(board[0]!.instanceId.split('#')[0]).toBe(
        board[3]!.instanceId.split('#')[0],
      );
      expect(board[1]!.instanceId.split('#')[0]).toBe(
        board[4]!.instanceId.split('#')[0],
      );
    }
  });
  it('jointly evaluates Ditto directions to find the best reachable complete score', async () => {
    for (const a of ['ordinary-0', 'ordinary-1', 'ordinary-4', 'ordinary-9'])
      for (const b of [
        'ordinary-0',
        'ordinary-1',
        'ordinary-4',
        'ordinary-9',
      ]) {
        const state = position('snorlax-choice', [
          'special-ditto',
          a,
          'special-snorlax',
          'ordinary-9',
          'special-ditto',
          b,
        ]);
        const total = (action: Action) =>
          scoreBoard(
            apply(state, action).boards.S1!.map((slot) => slot.instanceId),
          ).total;
        const optimum = Math.min(
          ...(rules.legalActions(state, 'S1') as Action[]).map(total),
        );
        const advanced = (await choose(state, 'juewu')).action as Action;
        const preliminary = (await choose(state, 'doubao')).action as Action;
        expect(total(advanced), `joint board ${a}/${b}`).toBe(optimum);
        expect(total(preliminary)).toBe(optimum);
      }
  });
  it('chooses Mew across every opponent instead of only the next seat', async () => {
    const state = position(
      'mew-other',
      [
        'ordinary-9',
        'ordinary-8',
        hidden('ordinary-1'),
        'ordinary-9',
        'ordinary-8',
        hidden('ordinary-3'),
      ],
      {
        held: 'special-mew',
        opponents: [
          [
            'ordinary-9',
            'ordinary-8',
            hidden('ordinary-6'),
            hidden('ordinary-7'),
            hidden('ordinary-4'),
            hidden('ordinary-5'),
          ],
          [
            'ordinary--2',
            'ordinary-0',
            hidden('ordinary-1'),
            hidden('ordinary-3'),
            hidden('ordinary-4'),
            hidden('ordinary-5'),
          ],
        ],
      },
    );
    expect((await choose(state, 'default')).action).toEqual({
      type: 'mew-target',
      seat: 'S3',
      slot: 0,
    });
    for (const difficulty of ['doubao', 'juewu'] as const)
      expect((await choose(state, difficulty)).action).not.toEqual({
        type: 'mew-target',
        seat: 'S2',
        slot: 2,
      });
  });
  it('takes a guaranteed winning last flip and avoids completing a critical rival via Mew', async () => {
    const win = position(
      'place',
      [
        'ordinary-8',
        'ordinary-9',
        'ordinary-7',
        'ordinary-8',
        'ordinary-9',
        hidden('ordinary-3'),
      ],
      { held: 'ordinary-7' },
    );
    expect((await choose(win, 'juewu')).action).toEqual({
      type: 'replace',
      slot: 5,
    });
    const danger = position(
      'mew-other',
      [
        'ordinary-9',
        'ordinary-8',
        'ordinary-7',
        'ordinary-9',
        'ordinary-8',
        hidden('ordinary-6'),
      ],
      {
        held: 'special-mew',
        opponents: [
          [
            'ordinary-0',
            'ordinary-0',
            'ordinary-1',
            'ordinary-0',
            'ordinary-0',
            hidden('ordinary-1'),
          ],
        ],
      },
    );
    danger.winsBySeat.S2 = 2;
    expect((await choose(danger, 'juewu')).action).not.toEqual({
      type: 'mew-target',
      seat: 'S2',
      slot: 5,
    });
  });
});

describe('Authorized observations and serializable memory', () => {
  it('retains an authorized own peek, moves it with a swap and expires it after public replacement or a new round', async () => {
    const state = position('charizard-view', [
      'special-charizard',
      'ordinary-1',
      hidden('ordinary-9'),
      hidden('ordinary-3'),
      hidden('ordinary-4'),
      hidden('ordinary-5'),
    ]);
    state.peekSlot = 2;
    const result = await choose(state, 'juewu');
    const memory = result.memory as StrategyMemory;
    expect(result.action).toEqual({ type: 'close-peek' });
    expect(memory.cards).toEqual([null, null, 'ordinary-9', null, null, null]);
    const next = apply(state, result.action as Action);
    next.phase = 'snorlax-choice';
    next.turnSeat = 'S1';
    const swapped = await bot.decide({
      view: rules.project(next, { role: 'player', seatId: 'S1' }),
      actions: [{ type: 'swap', a: 2, b: 3 }],
      decision: { id: 'memory-move', seatId: 'S1' },
      memory,
      difficulty: 'juewu',
      random: new RandomSource(1),
      signal: new AbortController().signal,
    });
    expect((swapped.memory as StrategyMemory).cards[2]).toBe('ordinary-9');
    expect((swapped.memory as StrategyMemory).cards[3]).toBeNull();
    const moved = apply(next, swapped.action as Action);
    const view = rules.project(moved, {
      role: 'player',
      seatId: 'S1',
    }) as PokemonView;
    expect(observeMemory(swapped.memory, view, 'S1').cards[3]).toBe(
      'ordinary-9',
    );
    view.boards.S1![3] = {
      ...view.boards.S1![3]!,
      faceUp: true,
      card: view.boards.S1![0]!.card,
    };
    expect(observeMemory(swapped.memory, view, 'S1').cards[3]).toBeNull();
    view.roundNumber++;
    expect(observeMemory(swapped.memory, view, 'S1').cards).toEqual(
      Array(6).fill(null),
    );
    expect(
      bot.validateMemory(JSON.parse(JSON.stringify(swapped.memory))),
    ).toEqual(swapped.memory);
    expect(bot.validateMemory(null)).toBeNull();
    expect(() =>
      bot.validateMemory({
        ...memory,
        cards: [
          'special-ditto',
          'special-ditto',
          'special-ditto',
          null,
          null,
          null,
        ],
      }),
    ).toThrow('Invalid strategy memory');
  });
  it('uses remembered hidden values and ignores changes in hidden state and deck order', async () => {
    const state = position(
      'place',
      [
        hidden('ordinary-9'),
        'ordinary-1',
        hidden('ordinary-4'),
        'ordinary-1',
        'ordinary-0',
        hidden('ordinary-5'),
      ],
      { held: 'ordinary-0' },
    );
    const memory: StrategyMemory = {
      version: 1,
      roundNumber: 1,
      seatId: 'S1',
      cards: ['ordinary-9', null, 'ordinary--2', null, null, null],
    };
    expect((await choose(state, 'juewu', memory)).action).not.toEqual({
      type: 'replace',
      slot: 2,
    });
    const changed = structuredClone(state);
    [changed.boards.S1![0]!.instanceId, changed.boards.S2![2]!.instanceId] = [
      changed.boards.S2![2]!.instanceId,
      changed.boards.S1![0]!.instanceId,
    ];
    changed.deck.reverse();
    expect(rules.project(changed, { role: 'player', seatId: 'S1' })).toEqual(
      rules.project(state, { role: 'player', seatId: 'S1' }),
    );
    for (const difficulty of ['default', 'doubao', 'juewu'] as const)
      expect(
        await choose(
          changed,
          difficulty,
          difficulty === 'default' ? null : memory,
        ),
      ).toEqual(
        await choose(
          state,
          difficulty,
          difficulty === 'default' ? null : memory,
        ),
      );
  });
  it('covers empty-deck refills and cancellation safely', async () => {
    const state = position(
      'rocket-pikachu',
      [
        'ordinary-1',
        'ordinary-0',
        hidden('ordinary-4'),
        hidden('ordinary-6'),
        hidden('ordinary-7'),
        hidden('ordinary-8'),
      ],
      { held: 'special-team-rocket', discard: 'special-ditto' },
    );
    state.discard.push(...state.deck);
    state.deck = [];
    const action = (await choose(state, 'juewu')).action;
    expect(rules.legalActions(state, 'S1')).toContainEqual(action);
    expect(() =>
      rules.validateState(apply(state, action as Action), state.seatOrder),
    ).not.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(
      bot.decide({
        difficulty: 'juewu',
        view: rules.project(state, { role: 'player', seatId: 'S1' }),
        actions: rules.legalActions(state, 'S1'),
        decision: rules.decisions(state)[0]!,
        memory: null,
        random: new RandomSource(1),
        signal: controller.signal,
      }),
    ).rejects.toThrow('Aborted');
    expect(EVALUATION_WORLDS).toBe(32);
    for (let dimension = 0; dimension < 40; dimension++)
      expect(
        new Set(
          Array.from({ length: EVALUATION_WORLDS }, (_, sample) =>
            Math.floor(integrationPoint(sample, dimension) * EVALUATION_WORLDS),
          ),
        ).size,
      ).toBe(EVALUATION_WORLDS);
  });
  it('invalidates peek memory after an opponent Mew or Rocket replacement', async () => {
    const state = position('charizard-view', [
      'special-charizard',
      'ordinary-1',
      hidden('ordinary-9'),
      hidden('ordinary-3'),
      hidden('ordinary-4'),
      hidden('ordinary-5'),
    ]);
    state.peekSlot = 2;
    const peek = await choose(state, 'juewu');
    const closed = apply(state, peek.action as Action);
    for (const category of ['special-mew', 'special-team-rocket']) {
      const next = structuredClone(closed);
      const index = next.deck.findIndex((id) => id.split('#')[0] === category);
      next.held = next.deck.splice(index, 1)[0]!;
      next.turnSeat = 'S2';
      next.drawSource = 'deck';
      next.phase = category === 'special-mew' ? 'mew-other' : 'rocket-pikachu';
      if (category === 'special-team-rocket') next.coin = 'pikachu';
      const action: Action =
        category === 'special-mew'
          ? { type: 'mew-target', seat: 'S1', slot: 2 }
          : { type: 'replace', slot: 2 };
      const changed = rules.apply(next, action, 'S2', {
        seats: next.seatOrder,
        random: new RandomSource(19),
      }).state as State;
      rules.validateState(changed, changed.seatOrder);
      expect(
        observeMemory(
          peek.memory,
          rules.project(changed, {
            role: 'player',
            seatId: 'S1',
          }) as PokemonView,
          'S1',
        ).cards[2],
      ).toBeNull();
    }
  });
});

it('all three levels finish fixed-seed 2–6-player three-win matches with legal authorized choices', async () => {
  const covered = new Map<BotDifficulty, Set<string>>();
  const metrics: unknown[] = [];
  for (const profile of [
    'default',
    'doubao',
    'juewu',
    'mixed',
    'baseline',
  ] as const) {
    const phases = new Set<string>();
    if (profile !== 'mixed' && profile !== 'baseline')
      covered.set(profile, phases);
    for (let count = 2; count <= 6; count++) {
      const seats = Array.from(
        { length: count },
        (_, index) => `S${index + 1}`,
      );
      const random = new RandomSource(31 + count);
      let state = rules.initialize({ seats, random }) as State;
      const memories = Object.fromEntries(
        seats.map((seat) => [seat, null as JsonValue]),
      );
      let steps = 0;
      let turns = 0,
        replacements = 0,
        blind = 0,
        discards = 0;
      const level = (seat: string): BotDifficulty =>
        profile === 'mixed'
          ? (['default', 'doubao', 'juewu'] as const)[seats.indexOf(seat) % 3]!
          : profile === 'baseline'
            ? 'default'
            : profile;
      while (!rules.ended(state) && steps++ < 2000) {
        phases.add(state.phase);
        if (state.phase === 'round-result') {
          state = rules.applyLifecycle(
            state,
            { type: 'next-round' },
            { seats, random },
          ).state as State;
          continue;
        }
        const decision = rules.decisions(state)[0]!;
        const difficulty = level(decision.seatId);
        const ownView = rules.project(state, {
          role: 'player',
          seatId: decision.seatId,
        }) as PokemonView;
        const result =
          profile === 'baseline'
            ? {
                action: basicAction(
                  ownView,
                  rules.legalActions(state, decision.seatId) as Action[],
                  decision.seatId,
                ),
                memory: null,
              }
            : await bot.decide({
                difficulty,
                view: rules.project(state, {
                  role: 'player',
                  seatId: decision.seatId,
                }),
                actions: rules.legalActions(state, decision.seatId),
                decision,
                memory: memories[decision.seatId]!,
                random: {
                  next() {
                    throw new Error('Unexpected strategy RNG');
                  },
                },
                signal: new AbortController().signal,
              });
        expect(rules.legalActions(state, decision.seatId)).toContainEqual(
          result.action,
        );
        const action = result.action as Action;
        if (state.phase === 'place' && action.type === 'replace') {
          replacements++;
          if (
            !ownView.boards[decision.seatId]![action.slot]!.faceUp &&
            !(memories[decision.seatId] as StrategyMemory | null)?.cards[
              action.slot
            ]
          )
            blind++;
        }
        if (action.type === 'discard-held') discards++;
        const previous = state;
        memories[decision.seatId] = bot.validateMemory(result.memory);
        state = rules.apply(state, result.action, decision.seatId, {
          seats,
          random,
        }).state as State;
        if (
          previous.phase !== 'initial-flip' &&
          (previous.turnSeat !== state.turnSeat || state.roundResult)
        )
          turns++;
        if (profile !== 'baseline')
          for (const seat of seats)
            memories[seat] = bot.observe!({
              view: rules.project(state, { role: 'player', seatId: seat }),
              memory: memories[seat]!,
              seatId: seat,
              difficulty: level(seat),
            });
        rules.validateState(state, seats);
      }
      expect(steps, `${profile}/${count} stalled`).toBeLessThan(2000);
      expect(state.matchWinners.length).toBeGreaterThan(0);
      metrics.push({
        profile,
        players: count,
        seed: 31 + count,
        steps,
        ordinaryTurns: turns,
        replacements,
        blind,
        blindRatio: replacements ? blind / replacements : 0,
        discards,
        discardRatio: turns ? discards / turns : 0,
        rounds: state.roundNumber,
        winners: state.matchWinners,
        wins: state.winsBySeat,
      });
    }
  }
  for (const [difficulty, phases] of covered)
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
      expect(phases.has(phase), `${difficulty}/${phase}`).toBe(true);
  await mkdir('artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005', {
    recursive: true,
  });
  await writeFile(
    'artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/fixed-seeds.json',
    JSON.stringify(
      {
        scope:
          '25 fixed-seed simulated matches; baseline is the former default basicAction, not former advanced levels. No claim of statistical superiority.',
        metrics,
      },
      null,
      2,
    ),
  );
}, 600_000);

it('finishes six-seat ability analysis inside an isolated 32 MiB Worker and the two-second budget', async () => {
  const bundle = await build({
    entryPoints: ['games/pokemon-encounters/bot/index.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
  });
  const seats = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  const random = new RandomSource(77);
  let state = rules.initialize({ seats, random }) as State;
  for (const seat of seats)
    state = rules.apply(state, { type: 'initial-flip', slot: 0 }, seat, {
      seats,
      random,
    }).state as State;
  state.turnSeat = 'S1';
  let index = state.deck.findIndex((id) => id.split('#')[0] === 'special-mew');
  if (index < 0) {
    const board = Object.values(state.boards)
      .flat()
      .find((slot) => slot.instanceId.split('#')[0] === 'special-mew')!;
    [state.deck[0], board.instanceId] = [board.instanceId, state.deck[0]!];
    index = 0;
  }
  expect(index).toBeGreaterThanOrEqual(0);
  state.discard = [state.deck.splice(index, 1)[0]!];
  const cases = [state];
  const drawn = rules.apply(state, { type: 'draw', source: 'discard' }, 'S1', {
    seats,
    random,
  }).state as State;
  cases.push(drawn);
  expect(rules.legalActions(drawn, 'S1')).toHaveLength(30);
  const metrics: { phase: string; milliseconds: number; heapMiB: number }[] =
    [];
  for (const current of cases) {
    const input = {
      difficulty: 'juewu',
      view: rules.project(current, { role: 'player', seatId: 'S1' }),
      actions: rules.legalActions(current, 'S1'),
      decision: rules.decisions(current)[0],
      memory: null,
    };
    const result = await new Promise<{
      result: { action: JsonValue; memory: JsonValue };
      milliseconds: number;
      heapMiB: number;
    }>((resolve, reject) => {
      const worker = new Worker(
        `${bundle.outputFiles[0]!.text}\nconst { parentPort, workerData } = require('node:worker_threads'); const started = performance.now(); module.exports.bot.decide({ ...workerData, signal: new AbortController().signal, random: { next() { throw new Error('unexpected RNG'); } } }).then(result => parentPort.postMessage({ result, milliseconds: performance.now() - started, heapMiB: process.memoryUsage().heapUsed / 1048576 })).catch(error => { throw error; });`,
        {
          eval: true,
          workerData: input,
          resourceLimits: { maxOldGenerationSizeMb: 32 },
        },
      );
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error('Worker exceeded two-second budget'));
      }, 2000);
      worker.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.once('message', (message) => {
        clearTimeout(timer);
        void worker.terminate();
        resolve(message);
      });
    });
    expect(rules.legalActions(current, 'S1')).toContainEqual(
      result.result.action,
    );
    expect(bot.validateMemory(result.result.memory)).toEqual(
      result.result.memory,
    );
    expect(result.milliseconds).toBeLessThan(1900);
    metrics.push({
      phase: current.phase,
      milliseconds: Math.round(result.milliseconds),
      heapMiB: Math.round(result.heapMiB * 10) / 10,
    });
  }
  console.info(
    'Authorized six-seat Worker evaluation:',
    JSON.stringify(metrics),
  );
}, 10_000);
