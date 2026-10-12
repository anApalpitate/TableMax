import { expect, it } from 'vitest';
import type { JsonValue } from '@tablemax/game-sdk';
import { pokemonExpansion as rules, createInitialState } from '../index';
import { effectiveCard } from '../events';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import { bot } from './index';
import type { Memory } from './memory';
import type { Action } from '../state';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const diagnosticDirectory = resolve(
  'artifacts/maintenance/v1.0.6/pokemon-events-v3-verification/private-bot-diagnostics',
);

for (const players of [2, 3, 4, 5, 6])
  for (const difficulty of ['default', 'doubao', 'juewu'] as const)
    it(`v3 ${players} players ${difficulty}: completes a three-win match with legal actions and truthful authorized memory`, async () => {
      const seats = Array.from({ length: players }, (_, i) => `s${i}`);
      const context = { seats, random: new RandomSource(121200 + players) };
      const random = Object.fromEntries(
        seats.map((seat, i) => [
          seat,
          new RandomSource(121400 + players * 11 + i),
        ]),
      );
      const memory: Record<string, JsonValue> = Object.fromEntries(
        seats.map((seat) => [seat, null]),
      );
      let state = createInitialState(context, 'events-research-v3'),
        steps = 0,
        stepsInRound = 0;
      while (state.phase !== 'match-result' && steps < 9100) {
        if (state.phase === 'round-result') {
          expect(state.roundResult!.winners.length).toBeGreaterThan(0);
          for (const award of Object.values(state.roundResult!.awardsBySeat!))
            expect([0, 1]).toContain(award);
          state = rules.applyLifecycle(
            state,
            { type: 'next-round' },
            context,
          ).state;
          stepsInRound = 0;
          continue;
        }
        expect(stepsInRound).toBeLessThan(700);
        const decision = rules.decisions(state)[0]!,
          seat = decision.seatId;
        const view = rules.project(state, { role: 'player', seatId: seat });
        const actions = rules.legalActions(state, seat),
          before = structuredClone({ view, actions });
        const inputMemory = structuredClone(memory[seat]!);
        const began = performance.now();
        const result = await bot.decide({
          view,
          actions,
          decision,
          memory: memory[seat]!,
          difficulty,
          random: random[seat]!,
          signal: new AbortController().signal,
        });
        expect(performance.now() - began).toBeLessThan(2000);
        expect(actions).toContainEqual(result.action);
        expect({ view, actions }).toEqual(before);
        memory[seat] = result.memory;
        const known = (result.memory as Memory).known;
        for (const owner of seats)
          for (let slot = 0; slot < 9; slot++) {
            const entry = known[owner]![slot];
            if (!entry) continue;
            const physicalSlot = state.boards[owner]![slot];
            const actual = physicalSlot
              ? effectiveCard(
                  physicalSlot.instanceId,
                  'events-research-v3',
                  state.cardOverrides,
                )
              : null;
            let evidencePath: string | undefined;
            if (!actual || entry.category !== actual.categoryId) {
              mkdirSync(diagnosticDirectory, { recursive: true });
              evidencePath = join(
                diagnosticDirectory,
                `${players}-${difficulty}-round${state.roundNumber}-step${steps}-${randomUUID()}.json`,
              );
              writeFileSync(
                evidencePath,
                JSON.stringify(
                  {
                    classification:
                      'Private local diagnostic: contains undisclosed synthetic card identities. Do not publish.',
                    players,
                    difficulty,
                    steps,
                    seat,
                    owner,
                    slot,
                    ruleRandom: context.random.state,
                    botRandom: random[seat]!.state,
                    state,
                    inputMemory,
                    resultMemory: result.memory,
                    authorizedView: view,
                    resultAction: result.action,
                  },
                  null,
                  2,
                ) + '\n',
              );
            }
            expect(
              physicalSlot,
              evidencePath
                ? `Remembered identity without a physical card. Private failure evidence: ${evidencePath}`
                : undefined,
            ).toBeDefined();
            expect(
              entry.category,
              evidencePath
                ? `Private failure evidence: ${evidencePath}`
                : undefined,
            ).toBe(actual!.categoryId);
          }
        state = rules.apply(
          state,
          result.action as Action,
          seat,
          context,
        ).state;
        expect(rules.validateState(structuredClone(state), seats)).toEqual(
          state,
        );
        steps++;
        stepsInRound++;
      }
      expect(state.phase).toBe('match-result');
      expect(state.matchWinners.length).toBeGreaterThan(0);
      for (const winner of state.matchWinners)
        expect(state.winsBySeat[winner]).toBeGreaterThanOrEqual(3);
      expect(state.roundResult!.winners.length).toBeGreaterThan(0);
      for (const award of Object.values(state.roundResult!.awardsBySeat!))
        expect([0, 1]).toContain(award);
    }, 600000);
