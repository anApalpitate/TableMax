import assert from 'node:assert/strict';
import { pokemonExpansion as rules } from '../games/pokemon-encounters/expansion/index.ts';
import { bot } from '../games/pokemon-encounters/expansion/bot/index.ts';
import { profiles } from '../games/pokemon-encounters/expansion/bot/memory.ts';
import { card } from '../games/pokemon-encounters/expansion/cards.ts';
import { RandomSource } from '../packages/platform-core/src/random.ts';

export async function measureMatch(players, seed, levels, roundCap, onRound) {
  const seats = Array.from({ length: players }, (_, i) => `s${i}`);
  assert.equal(levels.length, players);
  const difficulties = Object.fromEntries(
    seats.map((seat, i) => [seat, levels[i]]),
  );
  const context = { seats, random: new RandomSource(seed) };
  const randoms = Object.fromEntries(
    seats.map((seat, i) => [
      seat,
      new RandomSource((seed ^ ((i + 1) * 7193)) >>> 0 || 1),
    ]),
  );
  const memories = Object.fromEntries(seats.map((seat) => [seat, null]));
  let state = rules.initialize(context),
    roundActions = 0,
    actions = 0,
    maxComputeMs = 0;
  let arceus = 0,
    hoenn = 0,
    maximumPrivateKnowledge = 0,
    lifecycleTransitions = 0;
  const rounds = [],
    phases = new Set(),
    counts = {};
  const observe = () => {
    for (const seat of seats) {
      memories[seat] = bot.validateMemory(
        bot.observe({
          view: rules.project(state, { role: 'player', seatId: seat }),
          memory: memories[seat],
          seatId: seat,
          difficulty: difficulties[seat],
        }),
      );
      const memory = memories[seat];
      assert.equal(memory.round, state.roundNumber);
      const privateCount = Object.values(memory.known)
        .flat()
        .filter((k) => k?.source === 'private').length;
      maximumPrivateKnowledge = Math.max(maximumPrivateKnowledge, privateCount);
      assert.ok(privateCount <= profiles[difficulties[seat]].privateCards);
      assert.ok(memory.history.length <= profiles[difficulties[seat]].history);
      for (const owner of seats)
        for (let slot = 0; slot < 9; slot++) {
          const knowledge = memory.known[owner][slot];
          if (knowledge)
            assert.equal(
              knowledge.category,
              card(state.boards[owner][slot].instanceId).categoryId,
              'Remembered card moved or leaked incorrectly',
            );
        }
      if (state.phase === 'research-vote') {
        assert.ok(
          Object.values(memory.known)
            .flat()
            .every((k) => k === null),
        );
        assert.equal(memory.turn, 0);
      }
    }
  };
  observe();
  const started = performance.now();
  while (!rules.ended(state)) {
    if (state.phase === 'round-result') {
      assert.deepEqual(rules.lifecycleActions(state), [{ type: 'next-round' }]);
      state = rules.validateState(
        rules.applyLifecycle(state, { type: 'next-round' }, context).state,
        seats,
      );
      lifecycleTransitions++;
      roundActions = 0;
      observe();
      continue;
    }
    if (roundActions >= roundCap) break;
    const decision = rules.decisions(state)[0];
    assert.ok(decision);
    const seat = decision.seatId;
    const view = rules.project(state, { role: 'player', seatId: seat }),
      choices = rules.legalActions(state, seat);
    const input = { view, actions: choices, memory: memories[seat], decision };
    const before = JSON.stringify(input),
      ruleRandom = context.random.state;
    const tick = performance.now();
    const result = await bot.decide({
      ...input,
      difficulty: difficulties[seat],
      random: randoms[seat],
      signal: new AbortController().signal,
    });
    maxComputeMs = Math.max(maxComputeMs, performance.now() - tick);
    assert.equal(JSON.stringify(input), before, 'Strategy mutated input');
    assert.equal(
      context.random.state,
      ruleRandom,
      'Strategy consumed rules RNG',
    );
    assert.ok(
      choices.some(
        (choice) => JSON.stringify(choice) === JSON.stringify(result.action),
      ),
      'Illegal strategy action',
    );
    phases.add(state.phase);
    counts[result.action.type] = (counts[result.action.type] ?? 0) + 1;
    if (result.action.type === 'activate-arceus') arceus++;
    const previouslyTriggered = state.hoennTriggered;
    memories[seat] = bot.validateMemory(result.memory);
    state = rules.validateState(
      rules.apply(state, rules.validateAction(result.action), seat, context)
        .state,
      seats,
    );
    actions++;
    roundActions++;
    observe();
    if (!previouslyTriggered && state.hoennTriggered) hoenn++;
    if (['round-result', 'match-result'].includes(state.phase)) {
      const scores = state.roundResult.scores;
      const minimum = Math.min(
        ...Object.values(scores).map((score) => score.total),
      );
      for (const score of Object.values(scores))
        assert.equal(score.total, score.base - score.deduction);
      assert.deepEqual(
        [...state.roundResult.winners].sort(),
        seats.filter((s) => scores[s].total === minimum).sort(),
      );
      rounds.push({
        number: state.roundNumber,
        actions: roundActions,
        winners: state.roundResult.winners,
        scores,
        opening: state.activeResearch[0],
        hoenn: state.hoennTriggered,
        arceus: state.arceusUsed,
        wins: { ...state.winsBySeat },
      });
      onRound({
        players,
        seed,
        roundsCompleted: rounds.length,
        actions,
        elapsedMs: Math.round(performance.now() - started),
      });
    }
  }
  const completed = rules.ended(state);
  assert.ok(
    rounds.length <= players * 2 + 1,
    'Three-win match exceeded possible round count',
  );
  if (completed) {
    assert.deepEqual(
      [...state.matchWinners].sort(),
      seats.filter((s) => state.winsBySeat[s] === 3).sort(),
    );
    assert.ok(state.matchWinners.length > 0);
    assert.equal(lifecycleTransitions, rounds.length - 1);
  }
  return {
    players,
    seed,
    difficulties,
    completed,
    roundCap,
    rounds,
    actions,
    maxComputeMs,
    maximumPrivateKnowledge,
    lifecycleTransitions,
    arceusActivations: arceus,
    hoennEvents: hoenn,
    phases: [...phases],
    actionCounts: counts,
    matchWinners: [...state.matchWinners],
    winsBySeat: { ...state.winsBySeat },
    elapsedMs: performance.now() - started,
    ruleRandomAtEnd: context.random.state,
  };
}
