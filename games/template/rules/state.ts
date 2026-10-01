import { score } from './scoring';
export type State = {
  seats: string[];
  secrets: Record<string, number>;
  choices: Record<string, number>;
  turn: number;
  winners: string[];
};
export function validateState(input: unknown, seats: readonly string[]): State {
  const state = input as State;
  if (
    !state ||
    !Array.isArray(state.seats) ||
    state.seats.length < 2 ||
    state.seats.length > 5 ||
    new Set(state.seats).size !== state.seats.length ||
    JSON.stringify(state.seats) !== JSON.stringify(seats) ||
    !state.seats.every((s) => typeof s === 'string') ||
    !Number.isInteger(state.turn) ||
    state.turn < 0 ||
    state.turn > state.seats.length ||
    !state.secrets ||
    !state.choices ||
    !Array.isArray(state.winners) ||
    Object.keys(state.secrets).length !== state.seats.length ||
    !state.seats.every(
      (s) =>
        Number.isInteger(state.secrets[s]) &&
        state.secrets[s]! >= 1 &&
        state.secrets[s]! <= 6,
    ) ||
    Object.keys(state.choices).some(
      (s) => !state.seats.includes(s) || ![1, 2, 3].includes(state.choices[s]!),
    ) ||
    Object.keys(state.choices).length !== state.turn ||
    state.seats.some((s, i) => i < state.turn !== s in state.choices) ||
    state.winners.some((s) => !state.seats.includes(s))
  )
    throw new Error('Invalid template state');
  const winners =
    state.turn === state.seats.length
      ? score(
          Object.fromEntries(
            state.seats.map((s) => [s, state.secrets[s]! + state.choices[s]!]),
          ),
        )
      : [];
  if (JSON.stringify(state.winners) !== JSON.stringify(winners))
    throw new Error('Invalid template result');
  return structuredClone(state);
}
