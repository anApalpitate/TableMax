import { legacyRules as rules } from '../legacy-test';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import { RandomSource } from '../../../../packages/platform-core/src/random';

import type { Action } from '../state';
import { bot } from './index';
import { observeMemory } from './memory';

const directory = resolve(
  'artifacts/maintenance/v1.0.3/pokemon-final-revision/strategy',
  `mixed-${Date.now()}`,
);
const evidence: unknown[] = [];
const sourcePaths = [
  'index.ts',
  'state.ts',
  'project.ts',
  'cards.ts',
  'research.ts',
  'scoring.ts',
  'bot/index.ts',
  'bot/memory.ts',
  'bot/strategy.ts',
  'bot/tactics.ts',
  'bot/table.ts',
  'bot/relay.ts',
  'bot/rocket.ts',
];
const hashes = () =>
  Object.fromEntries(
    sourcePaths.map((path) => [
      path,
      createHash('sha256')
        .update(
          readFileSync(resolve('games/pokemon-encounters/expansion', path)),
        )
        .digest('hex'),
    ]),
  );
let before: Record<string, string>;
beforeAll(() => {
  before = hashes();
});
afterAll(() => {
  const after = hashes();
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, 'mixed-matches.json'),
    JSON.stringify(
      {
        sourceHashesBefore: before,
        sourceHashesAfter: after,
        sourceStable: JSON.stringify(before) === JSON.stringify(after),
        scope:
          'Authoritative legal mixed-difficulty matches, no win-rate comparison; strategy never sees hidden state.',
        evidence,
      },
      null,
      2,
    ),
  );
  expect(after).toEqual(before);
});

it.each([2, 3, 4, 5, 6])(
  'completes a fixed-seed mixed match for %i players',
  async (players) => {
    const seats = Array.from({ length: players }, (_, i) => `s${i}`);
    const seed = 610700 + players;
    const context = { seats, random: new RandomSource(seed) };
    const levels: BotDifficulty[] = ['default', 'doubao', 'juewu'];
    const difficulties = Object.fromEntries(
      seats.map((seat, i) => [seat, levels[i % 3]!]),
    );
    const memory: Record<string, JsonValue> = Object.fromEntries(
      seats.map((seat) => [seat, null]),
    );
    const random = Object.fromEntries(
      seats.map((seat, i) => [seat, new RandomSource(seed + i * 101)]),
    );
    let state = rules.initialize(context),
      actions = 0,
      maxCallMs = 0;
    const phases = new Set<string>();
    for (; actions < 10000 && !rules.ended(state); actions++) {
      phases.add(state.phase);
      if (state.phase === 'round-result') {
        state = rules.applyLifecycle(
          state,
          { type: 'next-round' },
          context,
        ).state;
      } else {
        const decision = rules.decisions(state)[0]!;
        expect(decision).toBeDefined();
        const actor = decision.seatId;
        const view = rules.project(state, { role: 'player', seatId: actor });
        const legal = rules.legalActions(state, actor);
        const before = JSON.stringify(view),
          randomBefore = context.random.state;
        const started = performance.now();
        const result = await bot.decide({
          view,
          actions: legal,
          decision,
          memory: memory[actor]!,
          difficulty: difficulties[actor]!,
          random: random[actor]!,
          signal: new AbortController().signal,
        });
        const ms = performance.now() - started;
        maxCallMs = Math.max(maxCallMs, ms);
        expect(ms).toBeLessThan(2000);
        expect(context.random.state).toBe(randomBefore);
        expect(JSON.stringify(view)).toBe(before);
        expect(legal).toContainEqual(result.action);
        state = rules.apply(
          state,
          result.action as Action,
          actor,
          context,
        ).state;
      }
      rules.validateState(state, seats);
      for (const seat of seats)
        memory[seat] = observeMemory(
          memory[seat]!,
          rules.project(state, { role: 'player', seatId: seat }),
          seat,
          difficulties[seat]!,
        );
    }
    evidence.push({
      players,
      seed,
      difficulties,
      actions,
      rounds: state.roundNumber,
      maxCallMs,
      phases: [...phases],
      winners: state.matchWinners,
    });
    expect(rules.ended(state)).toBe(true);
    expect(state.matchWinners.length).toBeGreaterThan(0);
  },
  300000,
);
