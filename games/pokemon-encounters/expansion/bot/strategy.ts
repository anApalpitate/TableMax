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
export function previewBoard(
  board: readonly string[],
  up: readonly boolean[],
  action:
    | { type: 'reposition'; a: number; b: number }
    | { type: 'replace'; slot: number; incoming: string },
) {
  const result = { board: [...board], up: [...up] };
  if (action.type === 'replace') {
    result.board[action.slot] = action.incoming;
    result.up[action.slot] = true;
  } else {
    [result.board[action.a], result.board[action.b]] = [
      result.board[action.b]!,
      result.board[action.a]!,
    ];
    [result.up[action.a], result.up[action.b]] = [
      result.up[action.b]!,
      result.up[action.a]!,
    ];
  }
  return result;
}
export function estimateDraw(
  source: 'deck' | 'discard',
  current: number,
  replacement: number,
) {
  return (
    (source === 'deck' ? Math.min(current + 0.35, replacement) : replacement) +
    0.08
  );
}
type Forecast = {
  board: readonly string[];
  up: readonly boolean[];
  pool: readonly string[];
  discards: readonly string[];
};
type Candidate = { action: Action; value: number };

/** Average complete candidate batches so a first lucky hypothesis cannot dominate. */
export function refineForecast(
  candidates: readonly Candidate[],
  hypotheses: readonly Forecast[],
  tasks: readonly string[],
  depth: 1 | 2,
  mayContinue: () => boolean,
): Candidate[] {
  const result = candidates.map((candidate) => ({ ...candidate }));
  const contenders = result.slice(0, 4);
  const sums = contenders.map(() => 0);
  let completed = 0;
  const score = (board: readonly string[], up: readonly boolean[]) =>
    scoreBoard(board, tasks, up).total;
  const forecast = (hypothesis: Forecast, action: Action) => {
    let board = [...hypothesis.board],
      up = [...hypothesis.up];
    if (action.type === 'reposition')
      ({ board, up } = previewBoard(board, up, {
        type: 'reposition',
        a: action.a,
        b: action.b,
      }));
    if (action.type === 'draw') {
      const incoming =
        action.source === 'deck'
          ? hypothesis.pool.at(-1)
          : hypothesis.discards[action.discardIndex];
      let bestPreview: ReturnType<typeof previewBoard> | null = null;
      let best = action.source === 'deck' ? score(board, up) : Infinity;
      if (incoming)
        for (const slot of grid.slots) {
          const trial = previewBoard(board, up, {
            type: 'replace',
            slot,
            incoming,
          });
          const value = score(trial.board, trial.up);
          if (value < best) {
            best = value;
            bestPreview = trial;
          }
        }
      if (bestPreview) ({ board, up } = bestPreview);
    }
    const initial = score(board, up);
    let future = initial;
    for (let turn = 0; turn < depth; turn++) {
      // A completed field has no subsequent ordinary take-card turn.
      if (up.every(Boolean)) break;
      const incoming = hypothesis.pool.at(
        -1 -
          turn -
          (action.type === 'draw' && action.source === 'deck' ? 1 : 0),
      );
      if (!incoming) break;
      let next = board,
        nextUp = up;
      for (const slot of grid.slots) {
        const trial = previewBoard(board, up, {
          type: 'replace',
          slot,
          incoming,
        });
        const value = score(trial.board, trial.up);
        if (value < future) {
          future = value;
          next = trial.board;
          nextUp = trial.up;
        }
      }
      board = next;
      up = nextUp;
    }
    return future - initial;
  };
  for (const hypothesis of hypotheses) {
    if (!mayContinue()) break;
    // All contenders receive this hypothesis, even when a soft budget expires mid-batch.
    const batch = contenders.map((candidate) =>
      forecast(hypothesis, candidate.action),
    );
    batch.forEach((value, index) => {
      sums[index]! += value;
    });
    completed++;
  }
  if (completed)
    contenders.forEach((candidate, index) => {
      candidate.value += (0.12 * sums[index]!) / completed;
    });
  return result.sort((a, b) => a.value - b.value);
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
    // Any fully revealed field closes the round after the whole ability chain.
    if (view.seatOrder.some((id) => model.up[id]!.every(Boolean))) {
      const minimum = Math.min(mine, opponent);
      const winners = view.seatOrder.filter(
        (id) => score(model.boards[id]!, model.up[id]!) === minimum,
      );
      const matchWinners = winners.filter((id) => view.winsBySeat[id]! >= 2);
      if (matchWinners.includes(seat)) value -= 48;
      else if (matchWinners.length) value += Math.max(0, 48 - urgency);
      else
        value += winners.includes(seat)
          ? -6 - 2 * view.winsBySeat[seat]!
          : Math.max(0, 18 - urgency);
    }
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
    if (a.type === 'replace' && view.phase === 'rocket-pikachu') {
      const start = view.seatOrder.indexOf(view.turnSeat);
      for (let offset = 0; offset < view.seatOrder.length; offset++) {
        const target =
          view.seatOrder[(start + offset) % view.seatOrder.length]!;
        const incoming = model.pool.at(-1 - offset);
        if (!incoming)
          throw new Error('Insufficient authorized Rocket hypothesis');
        model.boards[target]![a.slot] = incoming;
        model.up[target]![a.slot] = true;
      }
      // Newly dealt cards do not activate abilities; closure waits for all seats.
      return utility(model);
    }
    if (a.type === 'draw') {
      const incoming =
        a.source === 'deck'
          ? model.pool.at(-1)
          : model.discards[a.discardIndex];
      return incoming
        ? estimateDraw(
            a.source,
            utility(model),
            bestReplace(model, seat, incoming),
          )
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
  const hypotheses: Forecast[] = [];
  for (let n = 0; n < count; n++) {
    if (signal.aborted) throw new Error('Aborted');
    if (n > 0 && performance.now() > deadline) break;
    const model = sample(view, memory, random);
    if (view.phase === 'draw' && difficulty !== 'default')
      hypotheses.push({
        board: model.boards[seat]!,
        up: model.up[seat]!,
        pool: model.pool,
        discards: model.discards,
      });
    actions.forEach((a, i) => {
      sums[i]! += evaluate(a, model);
    });
    samples++;
  }
  const ordered = actions
    .map((action, i) => ({ action, value: sums[i]! / samples }))
    .sort((a, b) => a.value - b.value);
  // Bounded own-turn lookahead averages the same authorized hypotheses as immediate evaluation.
  if (
    difficulty !== 'default' &&
    hypotheses.length &&
    view.phase === 'draw' &&
    performance.now() < deadline
  ) {
    return refineForecast(
      ordered,
      hypotheses,
      tasks,
      difficulty === 'juewu' ? 2 : 1,
      () => performance.now() < deadline && !signal.aborted,
    )[0]!.action;
  }
  return ordered[0]!.action;
}
