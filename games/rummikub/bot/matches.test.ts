import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { BotDifficulty } from '@tablemax/game-sdk';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { initialize, project, rules, validateState } from '../rules';
import type { State } from '../rules/state';
import type { RummikubView } from '../types';
import { bot } from './index';

const difficulties = ['default', 'doubao', 'juewu'] as const;
const timings: Record<
  string,
  {
    matches: number;
    decisions: number;
    longestMs: number;
    maxTableTiles: number;
    maxRackTiles: number;
    emptyPoolDecisions: number;
    draws: number;
    passes: number;
    blockedGames: number;
    overReserve1500ms: number;
    peakPath: string;
  }
> = {};
const fixtureRunId = randomUUID();
const peakDirectory = resolve('artifacts/rummikub/validation/bot-peaks');
const replayPath = process.env.TABLEMAX_RUMMIKUB_PEAK_REPLAY;
function projectFor(state: State, seatId: string): RummikubView {
  return project(state, { role: 'player', seatId });
}
async function decide(
  state: State,
  difficulty: BotDifficulty,
  random: RandomSource,
) {
  const decision = rules.decisions(state)[0]!;
  const actions = rules.legalActions(state, decision.seatId);
  const view = projectFor(state, decision.seatId);
  const randomSnapshot = random.state;
  const start = performance.now();
  const choice = await bot.decide({
    view,
    actions,
    decision,
    difficulty,
    memory: null,
    random,
    signal: new AbortController().signal,
  });
  const elapsed = performance.now() - start;
  const timing = (timings[difficulty] ??= {
    matches: 0,
    decisions: 0,
    longestMs: 0,
    maxTableTiles: 0,
    maxRackTiles: 0,
    emptyPoolDecisions: 0,
    draws: 0,
    passes: 0,
    blockedGames: 0,
    overReserve1500ms: 0,
    peakPath: resolve(peakDirectory, `${difficulty}-${fixtureRunId}.json`),
  });
  timing.decisions++;
  if (elapsed >= 1500) timing.overReserve1500ms++;
  if (state.pool.length === 0) timing.emptyPoolDecisions++;
  if ((choice.action as { type: string }).type === 'draw') timing.draws++;
  if ((choice.action as { type: string }).type === 'pass') timing.passes++;
  const tableTileCount = view.table.reduce(
    (sum, meld) => sum + meld.tiles.length,
    0,
  );
  timing.maxTableTiles = Math.max(timing.maxTableTiles, tableTileCount);
  timing.maxRackTiles = Math.max(timing.maxRackTiles, view.self!.rack.length);
  if (elapsed > timing.longestMs) {
    timing.longestMs = elapsed;
    mkdirSync(peakDirectory, { recursive: true });
    writeFileSync(
      timing.peakPath,
      JSON.stringify(
        {
          dataClass: 'generated-private-strategy-test-fixture',
          containsPrivateTestData: true,
          productionData: false,
          source: 'games/rummikub/bot/matches.test.ts',
          fixtureRunId,
          gameId: bot.gameId,
          rulesVersion: bot.rulesVersion,
          strategyId: bot.id,
          strategyVersion: bot.version,
          difficulty,
          elapsedMs: elapsed,
          randomSnapshot,
          randomAfter: random.state,
          view,
          decision,
          actions,
          memory: null,
          choice,
          tableTileCount,
          tableMeldCount: view.table.length,
          rackTileCount: view.self!.rack.length,
          heapAfterDecision: process.memoryUsage().heapUsed,
          state,
        },
        null,
        2,
      ) + '\n',
    );
  }
  expect(choice.memory).toBeNull();
  expect(rules.isLegalAction!(state, choice.action, decision.seatId)).toBe(
    true,
  );
  expect(
    rules.validateAction(JSON.parse(JSON.stringify(choice.action))),
  ).toEqual(choice.action);
  return { choice, decision, elapsed };
}

describe('Rummikub complete seeded local strategy matches', () => {
  it.skipIf(!replayPath)(
    'replays a generated peak decision within the strategy budget',
    async () => {
      const fixture = JSON.parse(readFileSync(replayPath!, 'utf8'));
      expect(fixture.dataClass).toBe('generated-private-strategy-test-fixture');
      expect(fixture.productionData).toBe(false);
      expect(fixture.strategyId).toBe(bot.id);
      let random = new RandomSource(fixture.randomSnapshot);
      const repeatCount = Number(
        process.env.TABLEMAX_RUMMIKUB_PEAK_REPEATS ?? 1,
      );
      expect(
        Number.isInteger(repeatCount) && repeatCount >= 1 && repeatCount <= 32,
      ).toBe(true);
      const profiler =
        process.env.TABLEMAX_RUMMIKUB_CPU_PROFILE === '1'
          ? new Session()
          : null;
      if (profiler) {
        profiler.connect();
        await profiler.post('Profiler.enable');
        await profiler.post('Profiler.start');
      }
      const samples: {
        elapsedMs: number;
        heapBefore: number;
        heapAfter: number;
      }[] = [];
      let choice = fixture.choice;
      let firstChoice = null;
      for (let repeat = 0; repeat < repeatCount; repeat++) {
        // Later replays include the rule-suggestion allocation that precedes
        // normal decisions, without charging rule search to strategy timing.
        if (repeat > 0)
          rules.legalActions(fixture.state, fixture.decision.seatId);
        random = new RandomSource(fixture.randomSnapshot);
        const heapBefore = process.memoryUsage().heapUsed;
        const started = performance.now();
        choice = await bot.decide({
          view: fixture.view,
          actions: fixture.actions,
          decision: fixture.decision,
          difficulty: fixture.difficulty,
          memory: fixture.memory,
          random,
          signal: new AbortController().signal,
        });
        samples.push({
          elapsedMs: performance.now() - started,
          heapBefore,
          heapAfter: process.memoryUsage().heapUsed,
        });
        if (repeat === 0) firstChoice = choice;
        else expect(choice).toEqual(firstChoice);
      }
      const elapsedMs = Math.max(...samples.map((sample) => sample.elapsedMs));
      if (profiler) {
        const result = await profiler.post('Profiler.stop');
        const path = resolve(
          peakDirectory,
          'profiles',
          `${fixture.difficulty}-${fixtureRunId}-replay.cpuprofile`,
        );
        mkdirSync(resolve(peakDirectory, 'profiles'), { recursive: true });
        writeFileSync(path, JSON.stringify(result.profile) + '\n');
        profiler.disconnect();
      }
      const path = resolve(
        peakDirectory,
        `${fixture.difficulty}-${fixtureRunId}-replay.json`,
      );
      writeFileSync(
        path,
        JSON.stringify(
          {
            dataClass: 'generated-private-strategy-test-replay',
            productionData: false,
            fixture: replayPath,
            elapsedMs,
            repeatCount,
            samples,
            choice,
            randomAfter: random.state,
          },
          null,
          2,
        ) + '\n',
      );
      expect(
        rules.isLegalAction!(
          fixture.state,
          choice.action,
          fixture.decision.seatId,
        ),
      ).toBe(true);
      expect(elapsedMs).toBeLessThan(1500);
    },
    120000,
  );
  it('does not change any difficulty decision when hidden racks and pool ordering change', async () => {
    const seats = ['S1', 'S2', 'S3'];
    const state = initialize({ seats, random: new RandomSource(173) });
    const actor = state.turnSeat!;
    const others = seats.filter((seat) => seat !== actor);
    const hidden = structuredClone(state);
    const first = hidden.racks[others[0]!]!,
      second = hidden.racks[others[1]!]!;
    [first[0], second[0]] = [second[0]!, first[0]!];
    first.reverse();
    second.reverse();
    hidden.pool.reverse();
    rules.validateState(hidden, seats);
    expect(projectFor(state, actor)).toEqual(projectFor(hidden, actor));
    expect(rules.legalActions(state, actor)).toEqual(
      rules.legalActions(hidden, actor),
    );
    for (const difficulty of difficulties) {
      const original = await decide(state, difficulty, new RandomSource(99));
      const modified = await decide(hidden, difficulty, new RandomSource(99));
      expect(original.choice).toEqual(modified.choice);
    }
  });

  for (const count of [2, 3, 4])
    for (const difficulty of difficulties)
      for (const seed of [11, 57, 173])
        it(
          `completes ${count} seats ${difficulty} seed ${seed} with every game saved and restored`,
          async () => {
            const seats = Array.from({ length: count }, (_, i) => `S${i + 1}`);
            const random = new RandomSource(seed),
              botRandom = new RandomSource(seed + 700);
            let state = validateState(initialize({ seats, random }), seats);
            let steps = 0,
              submits = 0;
            while (!rules.ended(state) && steps++ < 1800) {
              const previous = state,
                before = structuredClone(state);
              if (state.phase === 'game-result') {
                const action = { type: 'next-game' } as const;
                expect(rules.lifecycleActions(state)).toContainEqual(action);
                state = rules.applyLifecycle(state, action, {
                  seats,
                  random,
                }).state as State;
              } else {
                const { choice, decision, elapsed } = await decide(
                  state,
                  difficulty,
                  botRandom,
                );
                expect(elapsed).toBeLessThan(2000);
                if ((choice.action as { type: string }).type === 'submit-turn')
                  submits++;
                state = rules.apply(state, choice.action, decision.seatId, {
                  seats,
                  random,
                }).state as State;
              }
              deepStrictEqual(
                previous,
                before,
                `${count}/${difficulty}/${seed}/step ${steps}: mutated input`,
              );
              const restored = validateState(
                JSON.parse(JSON.stringify(state)),
                seats,
              );
              deepStrictEqual(
                restored,
                state,
                `${count}/${difficulty}/${seed}/step ${steps}: changed restored state`,
              );
              state = restored;
              const publicView = rules.project(state, {
                role: 'public',
              }) as RummikubView;
              expect(publicView.self).toBeNull();
              expect(publicView).not.toHaveProperty('pool');
              expect(publicView).not.toHaveProperty('racks');
              for (const player of Object.values(publicView.players)) {
                expect(player).not.toHaveProperty('rack');
                expect(player).not.toHaveProperty('tiles');
              }
              const allIds = [
                ...state.pool,
                ...Object.values(state.racks).flat(),
                ...state.table.flatMap((meld) =>
                  meld.tiles.map((tile) => tile.tileId),
                ),
              ];
              expect(allIds).toHaveLength(106);
              expect(new Set(allIds).size).toBe(106);
            }
            expect(steps).toBeLessThan(1800);
            expect(state.phase).toBe('ended');
            expect(submits).toBeGreaterThan(0);
            expect(state.gameCount).toBe(count);
            expect(state.results).toHaveLength(count);
            expect(state.winners.length).toBeGreaterThan(0);
            expect(rules.decisions(state)).toEqual([]);
            expect(rules.lifecycleActions(state)).toEqual([]);
            for (const result of state.results)
              expect(
                Math.abs(
                  Object.values(result.scores).reduce(
                    (sum, value) => sum + value,
                    0,
                  ),
                ),
              ).toBeLessThan(1e-8);
            timings[difficulty]!.matches++;
            timings[difficulty]!.blockedGames += state.results.filter(
              (result) => result.reason === 'blocked',
            ).length;
          },
          count * 60000,
        );

  afterAll(() =>
    console.info('Rummikub seeded strategy timings:', JSON.stringify(timings)),
  );
});
