import { describe, it, expect } from 'vitest';
import { pokemonExpansion as rules } from '../index';
import { card } from '../cards';
import type { Action } from '../state';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import { observeMemory } from './memory';
import { choose } from './strategy';
import { createTactics, type TacticalModel } from './tactics';
import { scoreBoard } from '../scoring';
const difficulties = ['default', 'doubao', 'juewu'] as const;
function playing(players: number) {
  const context = {
    seats: Array.from({ length: players }, (_, i) => `s${i}`),
    random: new RandomSource(108081),
  };
  let state = rules.initialize(context);
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
  return { context, state };
}
describe('new profile authorized buffer and research decisions', () => {
  it('never forecasts a covered second discard as available after deck disposal', () => {
    const { context, state } = playing(2),
      seat = state.turnSeat;
    const incoming = state.deck.find(
      (id) => card(id).categoryId === 'ordinary-garchomp',
    )!;
    const pool = state.deck.filter((id) => id !== incoming);
    pool.push(incoming);
    const view = rules.project(state, { role: 'player', seatId: seat });
    const model: TacticalModel = {
      boards: Object.fromEntries(
        context.seats.map((id) => [
          id,
          state.boards[id]!.map((c) => c.instanceId),
        ]),
      ),
      up: Object.fromEntries(
        context.seats.map((id) => [id, state.boards[id]!.map((c) => c.faceUp)]),
      ),
      pool,
      held: null,
      discards: [state.discard.at(-1)!],
      discardLimit: 1,
      buffers: { ...state.buffersBySeat },
      usedAbilityIds: [],
    };
    const captured: string[][] = [];
    const score = (board: string[], up: boolean[]) =>
      scoreBoard(board, state.activeResearch, up, 'research-buffer-v2').total;
    const tactics = createTactics(
      view,
      seat,
      score,
      (trial) => {
        captured.push([...trial.discards]);
        return score(trial.boards[seat]!, trial.up[seat]!);
      },
      0,
    );
    expect(
      tactics.draw(model, { type: 'draw', source: 'deck' }),
    ).not.toBeNull();
    expect(captured.length).toBeGreaterThan(0);
    expect(captured.every((discard) => discard.length <= 1)).toBe(true);
    const disposed = captured.find((discard) => discard[0] === incoming)!;
    expect(disposed).toEqual([incoming]);
    expect(model.discards).toEqual([state.discard.at(-1)!]);
  });
  for (const players of [2, 6])
    for (const difficulty of difficulties) {
      it(`${players} players ${difficulty}: public own/foreign buffers remain conserved in hypotheses`, () => {
        const { context, state } = playing(players),
          seat = state.turnSeat;
        const id = state.deck.find(
          (id) => card(id).categoryId === 'ordinary--2',
        )!;
        state.deck.splice(state.deck.indexOf(id), 1);
        state.buffersBySeat![seat] = id;
        const foreign = context.seats.find((id) => id !== seat)!;
        state.buffersBySeat![foreign] = state.deck.pop()!;
        const saved = rules.validateState(state, context.seats);
        const view = rules.project(saved, { role: 'player', seatId: seat });
        const memory = observeMemory(null, view, seat, difficulty);
        const actions = rules.legalActions(saved, seat),
          before = structuredClone({ view, memory, actions });
        const drawActions = actions.filter(
          (a) =>
            a.type === 'draw-buffer' ||
            (a.type === 'draw' && a.source === 'discard'),
        );
        expect(drawActions.some((a) => a.type === 'draw-buffer')).toBe(true);
        const action = choose(
          view,
          drawActions,
          memory,
          difficulty,
          new RandomSource(771),
          new AbortController().signal,
        );
        expect(drawActions).toContainEqual(action);
        expect({ view, memory, actions }).toEqual(before);
        const taken = rules.apply(
          saved,
          { type: 'draw-buffer' },
          seat,
          context,
        ).state;
        const nextView = rules.project(taken, { role: 'player', seatId: seat }),
          nextMemory = observeMemory(memory, nextView, seat, difficulty),
          placements = rules.legalActions(taken, seat);
        expect(placements.every((a) => a.type === 'replace')).toBe(true);
        const place = choose(
          nextView,
          placements,
          nextMemory,
          difficulty,
          new RandomSource(772),
          new AbortController().signal,
        );
        expect(placements).toContainEqual(place);
        const placed = rules.apply(taken, place, seat, context).state;
        expect(rules.validateState(placed, context.seats)).toEqual(placed);
        expect(placed.buffersBySeat![foreign]).toBe(
          state.buffersBySeat![foreign],
        );
      }, 15000);
      it(`${players} players ${difficulty}: votes evaluate the new risks using only authorized data`, () => {
        const context = {
          seats: Array.from({ length: players }, (_, i) => `s${i}`),
          random: new RandomSource(108082),
        };
        const state = rules.initialize(context),
          seat = context.seats[0]!;
        state.researchCandidates = ['R03', 'R18', 'R19'];
        const view = rules.project(state, { role: 'player', seatId: seat }),
          memory = observeMemory(null, view, seat, difficulty),
          actions = rules.legalActions(state, seat);
        const before = structuredClone({ view, memory, actions });
        const action = choose(
          view,
          actions,
          memory,
          difficulty,
          new RandomSource(773),
          new AbortController().signal,
        );
        expect(actions).toContainEqual(action);
        expect({ view, memory, actions }).toEqual(before);
        expect(action.type).toBe('vote-research');
      }, 15000);
    }
  it('default new-profile play reaches real settlement and replays immutable saved decisions', () => {
    const { context, state: initial } = playing(2);
    let state = initial,
      steps = 0;
    const memory: Record<string, ReturnType<typeof observeMemory>> = {};
    const random = new RandomSource(108083);
    while (
      !['round-result', 'match-result'].includes(state.phase) &&
      steps < 600
    ) {
      const decision = rules.decisions(state)[0]!,
        seat = decision.seatId,
        view = rules.project(state, { role: 'player', seatId: seat });
      memory[seat] = observeMemory(memory[seat] ?? null, view, seat, 'default');
      const actions = rules.legalActions(state, seat);
      const action = choose(
        view,
        actions,
        memory[seat]!,
        'default',
        random,
        new AbortController().signal,
      ) as Action;
      expect(actions).toContainEqual(action);
      const input = JSON.stringify(state),
        saved = rules.validateState(JSON.parse(input), context.seats);
      const next = rules.apply(saved, action, seat, context).state;
      expect(JSON.stringify(state)).toBe(input);
      state = rules.validateState(next, context.seats);
      steps++;
    }
    expect(steps).toBeLessThan(600);
    expect(state.roundResult).not.toBeNull();
    expect(state.roundResult!.awardsBySeat).toBeDefined();
    expect(state.roundResult!.winners.length).toBeGreaterThan(0);
  }, 30000);
});
