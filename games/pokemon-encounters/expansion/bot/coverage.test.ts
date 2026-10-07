import { legacyRules as rules } from '../legacy-test';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import { RandomSource } from '../../../../packages/platform-core/src/random';

import { card } from '../cards';
import type { Action, State } from '../state';
import { bot } from './index';
import { observeMemory, validateMemory, type Memory } from './memory';

const difficulties = ['default', 'doubao', 'juewu'] as const;
const directory = resolve(
  'artifacts/maintenance/v1.0.3/pokemon-final-revision/strategy',
  `run-${Date.now()}-${randomUUID().slice(0, 8)}`,
);
const sourceFiles = [
  'games/pokemon-encounters/expansion/index.ts',
  'games/pokemon-encounters/expansion/state.ts',
  'games/pokemon-encounters/expansion/project.ts',
  'games/pokemon-encounters/expansion/cards.ts',
  'games/pokemon-encounters/expansion/research.ts',
  'games/pokemon-encounters/expansion/scoring.ts',
  'games/pokemon-encounters/expansion/bot/index.ts',
  'games/pokemon-encounters/expansion/bot/memory.ts',
  'games/pokemon-encounters/expansion/bot/strategy.ts',
  'games/pokemon-encounters/expansion/bot/relay.ts',
  'games/pokemon-encounters/expansion/bot/rocket.ts',
  'games/pokemon-encounters/expansion/bot/table.ts',
  'games/pokemon-encounters/expansion/bot/tactics.ts',
];
const hashes = () =>
  Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(path)))
        .digest('hex'),
    ]),
  );
let before: Record<string, string>;
const measurements: {
  players: number;
  difficulty: BotDifficulty;
  seed: number;
  actions: number;
  maxCallMs: number;
  computeMs: number;
  phases: string[];
}[] = [];
beforeAll(() => {
  mkdirSync(directory, { recursive: true });
  before = hashes();
});
afterAll(() => {
  const after = hashes();
  writeFileSync(
    resolve(directory, 'seeded-rounds.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceHashesBefore: before,
        sourceHashesAfter: after,
        sourceStable: JSON.stringify(before) === JSON.stringify(after),
        scope:
          'Seeded authoritative rules, independent strategy RNG and authorized projections; one completed round per seed. CPU timing is not human play time or a win-rate comparison.',
        measurements,
      },
      null,
      2,
    ) + '\n',
  );
  expect(after).toEqual(before);
});

function verifyMemory(memory: JsonValue, state: State, seat: string) {
  expect(() => validateMemory(memory)).not.toThrow();
  if (memory === null) return;
  const m = memory as Memory;
  expect(m.seat).toBe(seat);
  // Hidden truth is used only by the independent test oracle, never passed to the bot.
  for (const [owner, board] of Object.entries(m.known))
    for (const [slot, known] of board.entries()) {
      if (known === null) continue;
      expect(
        known.category,
        `${seat} remembers stale ${owner}:${slot} in ${state.phase}`,
      ).toBe(card(state.boards[owner]![slot]!.instanceId).categoryId);
      expect(known.abilityUsed ?? false).toBe(
        state.usedAbilityIds?.includes(
          state.boards[owner]![slot]!.instanceId,
        ) ?? false,
      );
    }
}

async function playRound(
  players: number,
  difficulty: BotDifficulty,
  seed: number,
) {
  const seats = Array.from({ length: players }, (_, i) => `s${i}`);
  const context = { seats, random: new RandomSource(seed) };
  const randomBySeat = Object.fromEntries(
    seats.map((seat, i) => [seat, new RandomSource(seed ^ ((i + 1) * 7193))]),
  );
  const memory: Record<string, JsonValue> = Object.fromEntries(
    seats.map((seat) => [seat, null]),
  );
  let state = rules.initialize(context),
    actions = 0,
    maxCallMs = 0,
    computeMs = 0;
  const phases = new Set<string>();
  for (
    ;
    actions < 700 && !['round-result', 'match-result'].includes(state.phase);
    actions++
  ) {
    phases.add(state.phase);
    const decision = rules.decisions(state)[0];
    expect(decision, `no decision at ${state.phase}`).toBeDefined();
    const actor = decision!.seatId,
      view = rules.project(state, { role: 'player', seatId: actor });
    const serialized = JSON.stringify(view),
      ruleRandom = context.random.state;
    const legal = rules.legalActions(state, actor),
      started = performance.now();
    const result = await bot.decide({
      view,
      actions: legal,
      decision: decision!,
      memory: memory[actor]!,
      difficulty,
      random: randomBySeat[actor]!,
      signal: new AbortController().signal,
    });
    const duration = performance.now() - started;
    maxCallMs = Math.max(maxCallMs, duration);
    computeMs += duration;
    expect(
      duration,
      `${players}p ${difficulty} seed ${seed} ${state.phase}`,
    ).toBeLessThan(2000);
    expect(result.action).toSatisfy((action) =>
      legal.some(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(action),
      ),
    );
    expect(context.random.state).toBe(ruleRandom);
    expect(JSON.stringify(view)).toBe(serialized);
    memory[actor] = result.memory;
    state = rules.apply(state, result.action as Action, actor, context).state;
    expect(() => rules.validateState(state, seats)).not.toThrow();
    for (const seat of seats) {
      memory[seat] = observeMemory(
        memory[seat]!,
        rules.project(state, { role: 'player', seatId: seat }),
        seat,
        difficulty,
      );
      verifyMemory(memory[seat]!, state, seat);
    }
  }
  measurements.push({
    players,
    difficulty,
    seed,
    actions,
    maxCallMs,
    computeMs,
    phases: [...phases],
  });
  expect(
    ['round-result', 'match-result'],
    `${players}p ${difficulty} seed ${seed} exhausted 700 legal actions`,
  ).toContain(state.phase);
  expect(state.roundResult?.winners.length).toBeGreaterThan(0);
  expect(Object.values(state.roundResult!.scores)).toHaveLength(players);
}

for (const players of [2, 3, 4, 5, 6])
  for (const difficulty of difficulties)
    for (let seed = 1; seed <= 10; seed++)
      it(
        `${players} players ${difficulty} seed ${seed}: finishes a legal round with truthful authorized memory`,
        async () => {
          await playRound(players, difficulty, 510500 + seed * 177 + players);
          const progress = {
            completedRounds: measurements.length,
            players,
            difficulty,
            seed,
            latest: measurements.at(-1),
            evidence: directory,
          };
          writeFileSync(
            resolve(directory, 'progress.json'),
            JSON.stringify(progress, null, 2) + '\n',
          );
          if (measurements.length % 10 === 0)
            console.log(JSON.stringify(progress));
          // Six-seat Juewu may legally approach the 700-action cap. This is an
          // entire-round ceiling; every decision still has the strict 2s assertion.
        },
        players === 6 && difficulty === 'juewu' ? 120000 : 60000,
      );

it('never initializes hidden knowledge, preserves its input, and aborts before choosing', async () => {
  const seats = ['a', 'b'],
    context = { seats, random: new RandomSource(7301) };
  const state = rules.initialize(context),
    view = rules.project(state, { role: 'player', seatId: 'a' });
  for (const difficulty of difficulties) {
    const memory = observeMemory(null, view, 'a', difficulty);
    expect(
      Object.values(memory.known)
        .flat()
        .every((entry) => entry === null),
    ).toBe(true);
  }
  const controller = new AbortController();
  controller.abort();
  await expect(
    bot.decide({
      view,
      actions: rules.legalActions(state, 'a'),
      decision: rules.decisions(state)[0]!,
      memory: null,
      random: new RandomSource(2),
      signal: controller.signal,
    }),
  ).rejects.toThrow('Aborted');
});
