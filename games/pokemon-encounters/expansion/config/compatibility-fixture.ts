import { createHash } from 'node:crypto';
import { pokemonExpansion as rules } from '../index';
import { categories, instancesForSeats } from '../cards';
import { tasks } from '../research';
import type { State, Action } from '../state';

/** Test-only fixed-seed compatibility probe; not imported by runtime modules. */
export function compatibilityFixture(seats: number, seed: number) {
  const ids = Array.from({ length: seats }, (_, i) => `s${i}`);
  let randomState = seed >>> 0;
  let actionState = (seed ^ 0x9e3779b9) >>> 0;
  const random = {
    next: () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296;
    },
  };
  const context = { seats: ids, random };
  const digest = createHash('sha256');
  const record = (value: unknown) =>
    digest.update(JSON.stringify(value) + '\n');
  record({
    deck: instancesForSeats(seats),
    categories: categories.map(
      ({ categoryId, name, value, small, standard, ability, copy }) => ({
        categoryId,
        name,
        value,
        small,
        standard,
        ability,
        copy,
      }),
    ),
    tasks,
  });
  let state = rules.initialize(context);
  let actions = 0;
  let restored = 0;
  const phases = new Set<string>();
  while (!['round-result', 'match-result'].includes(state.phase)) {
    if (actions >= 3000)
      throw new Error('Compatibility fixture failed to finish');
    phases.add(state.phase);
    const seat = rules.decisions(state)[0]!.seatId;
    const legal = rules.legalActions(state, seat);
    record({
      state,
      randomState,
      decisions: rules.decisions(state),
      legal,
      public: rules.project(state, { role: 'public' }),
      private: ids.map((seatId) =>
        rules.project(state, { role: 'player', seatId }),
      ),
    });
    actionState = (Math.imul(actionState, 1664525) + 1013904223) >>> 0;
    const preferred = legal.filter((a) =>
      a.type === 'replace'
        ? !state.boards[seat]![a.slot]!.faceUp
        : a.type === 'draw'
          ? a.source === 'deck'
          : false,
    );
    const choices = preferred.length ? preferred : legal;
    const action =
      choices[Math.floor((actionState / 4294967296) * choices.length)]!;
    const beforeRandom = randomState;
    const serialized = JSON.stringify(state);
    const next = rules.apply(state, action, seat, context);
    if (JSON.stringify(state) !== serialized)
      throw new Error('Input state mutated');
    const afterRandom = randomState;
    // Restoring and replaying a saved decision also models returning to its branch.
    if (actions % 11 === 0) {
      const recovered = rules.validateState(
        JSON.parse(serialized),
        ids,
      ) as State;
      randomState = beforeRandom;
      const replay = rules.apply(recovered, action as Action, seat, context);
      if (
        JSON.stringify(replay) !== JSON.stringify(next) ||
        randomState !== afterRandom
      )
        throw new Error('Saved-state replay changed the result or RNG');
      restored++;
    }
    state = next.state;
    actions++;
  }
  record({
    state,
    randomState,
    final: rules.project(state, { role: 'public' }),
  });
  return {
    seats,
    seed,
    actions,
    restored,
    phases: [...phases].sort(),
    sha256: digest.digest('hex'),
  };
}
