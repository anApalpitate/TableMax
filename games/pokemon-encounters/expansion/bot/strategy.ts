import type { BotDifficulty } from '@tablemax/game-sdk';
import { card, instancesForSeats } from '../cards';
import type { View } from '../project';
import type { Action } from '../state';
import { scoreBoard } from '../scoring';
import { grid, lines } from '../research';
import type { Memory } from './memory';
type Random = { next(): number };
type Model = {
  boards: Record<string, string[]>;
  up: Record<string, boolean[]>;
  pool: string[];
  held: string | null;
  discards: string[];
};
function sample(view: View, memory: Memory, random: Random): Model {
  const pool = instancesForSeats(view.seatOrder.length);
  const take = (category: string) => {
    const i = pool.findIndex((id) => card(id).categoryId === category);
    if (i < 0) throw new Error('Inconsistent authorized memory');
    return pool.splice(i, 1)[0]!;
  };
  const boards: Record<string, string[]> = Object.fromEntries(
    view.seatOrder.map((id) => [id, Array<string>(9).fill('')]),
  );
  for (const seat of view.seatOrder)
    for (let i = 0; i < 9; i++) {
      const category =
        view.boards[seat]?.[i]?.card?.categoryId ??
        memory.known[seat]?.[i]?.category;
      if (category) boards[seat]![i] = take(category);
    }
  const held = view.held ? take(view.held.categoryId) : null;
  const discards = view.discardOptions.map((c) => take(c.categoryId));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  for (const seat of view.seatOrder)
    for (let i = 0; i < 9; i++)
      if (!boards[seat]![i]) boards[seat]![i] = pool.pop()!;
  return {
    boards,
    up: Object.fromEntries(
      view.seatOrder.map((id) => [
        id,
        grid.slots.map((i) => view.boards[id]?.[i]?.faceUp ?? false),
      ]),
    ),
    pool,
    held,
    discards,
  };
}
export function choose(
  view: View,
  actions: readonly Action[],
  memory: Memory,
  difficulty: BotDifficulty,
  random: Random,
  signal: AbortSignal,
): Action {
  if (!actions.length) throw new Error('No legal expansion action');
  if (actions.length === 1) return actions[0]!;
  const seat = memory.seat,
    tasks = view.activeResearch.map((t) => t.id);
  if (view.phase === 'initial-flip')
    return (
      actions.find((a) => a.type === 'initial-flip' && a.slot === 4) ??
      actions[0]!
    );
  if (view.phase === 'charizard-choice')
    return [...actions].sort((a, b) => {
      const rank = (x: Action) =>
        x.type === 'peek'
          ? (memory.known[seat]?.[x.slot] ? -1 : 3) + (x.slot === 4 ? 1 : 0)
          : -2;
      return rank(b) - rank(a);
    })[0]!;
  if (view.phase === 'mewtwo-target')
    return [...actions].sort((a, b) => {
      const rank = (x: Action) =>
        x.type === 'mewtwo-target'
          ? [x.a, x.b].reduce(
              (n, i) => n + (memory.known[x.seat]?.[i] ? 0 : 1),
              0,
            )
          : -1;
      return rank(b) - rank(a);
    })[0]!;
  if (view.phase === 'lucario-choice')
    return actions.find((a) => a.type === 'extra-draw') ?? actions[0]!;
  const started = performance.now(),
    deadline = started + { default: 120, doubao: 400, juewu: 750 }[difficulty];
  const count = { default: 1, doubao: 8, juewu: 32 }[difficulty];
  if (view.phase === 'research-vote') {
    const sums = actions.map(() => 0),
      pool = instancesForSeats(view.seatOrder.length);
    for (let n = 0; n < count; n++) {
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random.next() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      const board = shuffled.slice(0, 9);
      actions.forEach((a, i) => {
        if (a.type === 'vote-research')
          sums[i]! += scoreBoard(board, [a.taskId]).deduction;
      });
    }
    return actions[sums.indexOf(Math.max(...sums))]!;
  }
  const score = (board: string[], up: boolean[]) =>
    scoreBoard(board, tasks, up).total;
  const utility = (model: Model) => {
    const mine = score(model.boards[seat]!, model.up[seat]!);
    const opponent = Math.min(
      ...view.seatOrder
        .filter((id) => id !== seat)
        .map((id) => score(model.boards[id]!, model.up[id]!)),
    );
    const completion = model.up[seat]!.filter(Boolean).length;
    let value =
      mine - { default: 0.03, doubao: 0.2, juewu: 0.35 }[difficulty] * opponent;
    const urgency = Math.max(0, memory.turn - 25) * 0.45;
    value -= completion * Math.min(16, urgency);
    if (completion === 9)
      value += mine <= opponent ? -6 : Math.max(0, 18 - urgency);
    const resolved = scoreBoard(model.boards[seat]!).values;
    for (const line of lines) {
      const values = line.map((i) => resolved[i]);
      if (new Set(values).size === 2)
        value -= difficulty === 'default' ? 0.2 : 0.7;
    }
    return value;
  };
  const bestReplace = (model: Model, target: string, incoming: string) => {
    let best = Infinity;
    for (const i of grid.slots) {
      const original = model.boards[target]![i]!,
        up = model.up[target]![i]!;
      model.boards[target]![i] = incoming;
      model.up[target]![i] = true;
      best = Math.min(best, utility(model));
      model.boards[target]![i] = original;
      model.up[target]![i] = up;
    }
    return best;
  };
  const evaluate = (a: Action, original: Model) => {
    const model: Model = {
      ...original,
      boards: Object.fromEntries(
        Object.entries(original.boards).map(([id, b]) => [id, [...b]]),
      ),
      up: Object.fromEntries(
        Object.entries(original.up).map(([id, u]) => [id, [...u]]),
      ),
    };
    const own = model.boards[seat]!,
      up = model.up[seat]!;
    if (a.type === 'draw') {
      const incoming =
        a.source === 'deck'
          ? model.pool.at(-1)
          : model.discards[a.discardIndex];
      return incoming
        ? Math.min(utility(model) + 0.35, bestReplace(model, seat, incoming)) +
            0.08
        : 1000;
    }
    if (a.type === 'replace' && model.held) {
      own[a.slot] = model.held;
      up[a.slot] = true;
    }
    if (a.type === 'reposition' || a.type === 'swap') {
      [own[a.a], own[a.b]] = [own[a.b]!, own[a.a]!];
      [up[a.a], up[a.b]] = [up[a.b]!, up[a.a]!];
    }
    if (a.type === 'discard-held')
      return (
        utility(model) +
        0.25 +
        Math.min(20, Math.max(0, memory.turn - 30) * 0.5)
      );
    if (a.type === 'mew-target') {
      const outgoing = model.boards[a.seat]![a.slot]!;
      model.boards[a.seat]![a.slot] = model.held!;
      model.up[a.seat]![a.slot] = true;
      return bestReplace(model, seat, outgoing);
    }
    if (a.type === 'mewtwo-exchange' && view.peek) {
      const target = view.peek.seat,
        outgoing = model.boards[target]![a.slot]!;
      model.boards[target]![a.slot] = model.held!;
      model.up[target]![a.slot] = true;
      return bestReplace(model, seat, outgoing);
    }
    if (
      a.type === 'decline-ability' &&
      view.phase === 'mewtwo-choice' &&
      model.held
    )
      return Math.min(utility(model), bestReplace(model, seat, model.held));
    if (a.type === 'activate-arceus')
      for (const id of view.seatOrder) {
        model.up[id] = Array<boolean>(9).fill(false);
        model.up[id]![Math.floor(random.next() * 9)] = true;
      }
    if (a.type === 'ninja-target') {
      model.up[a.seat]![a.a] = false;
      model.up[a.seat]![a.b] = false;
      if (a.swap)
        [model.boards[a.seat]![a.a], model.boards[a.seat]![a.b]] = [
          model.boards[a.seat]![a.b]!,
          model.boards[a.seat]![a.a]!,
        ];
    }
    if (a.type === 'row-target') {
      const row =
        grid.rows[
          view.rowAbility === 'groudon'
            ? 2
            : view.rowAbility === 'kyogre'
              ? 1
              : 0
        ]!;
      for (const i of row) {
        [own[i], model.boards[a.seat]![i]] = [
          model.boards[a.seat]![i]!,
          own[i]!,
        ];
        [up[i], model.up[a.seat]![i]] = [model.up[a.seat]![i]!, up[i]!];
      }
    }
    return utility(model) + (a.type === 'reposition' ? 0.6 : 0);
  };
  const sums = actions.map(() => 0);
  let samples = 0;
  let first: Model | null = null;
  for (let n = 0; n < count; n++) {
    if (signal.aborted) throw new Error('Aborted');
    if (n > 0 && performance.now() > deadline) break;
    const model = sample(view, memory, random);
    first ??= model;
    actions.forEach((a, i) => {
      sums[i]! += evaluate(a, model);
    });
    samples++;
  }
  const ordered = actions
    .map((action, i) => ({ action, value: sums[i]! / samples }))
    .sort((a, b) => a.value - b.value);
  // Bounded optimistic own-turn lookahead uses sampled unknown cards, never hidden state.
  if (
    difficulty !== 'default' &&
    first &&
    view.phase === 'draw' &&
    performance.now() < deadline
  ) {
    const depth = difficulty === 'juewu' ? 2 : 1;
    for (const option of ordered.slice(0, 4)) {
      if (performance.now() > deadline || signal.aborted) break;
      let board = [...first.boards[seat]!];
      const action = option.action;
      if (action.type === 'reposition')
        [board[action.a], board[action.b]] = [
          board[action.b]!,
          board[action.a]!,
        ];
      if (action.type === 'draw') {
        const incoming =
          action.source === 'deck'
            ? first.pool.at(-1)
            : first.discards[action.discardIndex];
        let best = score(board, first.up[seat]!);
        if (incoming)
          for (const i of grid.slots) {
            const trial = [...first.boards[seat]!];
            trial[i] = incoming;
            const value = score(trial, first.up[seat]!);
            if (value < best) {
              best = value;
              board = trial;
            }
          }
      }
      const initial = score(board, first.up[seat]!);
      let future = initial;
      for (let d = 0; d < depth; d++) {
        const incoming = first.pool.at(
          -1 - d - (action.type === 'draw' && action.source === 'deck' ? 1 : 0),
        );
        if (!incoming) break;
        let next = board;
        for (const i of grid.slots) {
          const trial = [...board];
          trial[i] = incoming;
          const value = score(trial, first.up[seat]!);
          if (value < future) {
            future = value;
            next = trial;
          }
        }
        board = next;
      }
      option.value += 0.12 * (future - initial);
    }
    ordered.sort((a, b) => a.value - b.value);
  }
  return ordered[0]!.action;
}
