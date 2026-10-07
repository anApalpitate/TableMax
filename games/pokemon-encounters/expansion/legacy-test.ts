/** Historical tests keep exercising the original saved-round contract. */
import { pokemonExpansion, createInitialState } from './index';
import { instancesForSeats } from './cards';
import { scoreBoard } from './scoring';
import { matchesTask, tasksForProfile } from './research';
export const legacyRules = {
  ...pokemonExpansion,
  initialize: (context: Parameters<typeof createInitialState>[0]) =>
    createInitialState(context, 'legacy'),
};
export const legacyInstances = (seats: number) =>
  instancesForSeats(seats, 'legacy');
export const legacyScore = (
  board: readonly string[],
  tasks: readonly string[] = [],
  pre: readonly boolean[] = Array(9).fill(true),
) => scoreBoard(board, tasks, pre, 'legacy');
export const legacyMatches = (
  id: string,
  board: readonly string[],
  score: ReturnType<typeof scoreBoard>,
  pre: readonly boolean[] = Array(9).fill(true),
) => matchesTask(id, board, score, pre, 'legacy');
export const legacyTasks = tasksForProfile('legacy');
