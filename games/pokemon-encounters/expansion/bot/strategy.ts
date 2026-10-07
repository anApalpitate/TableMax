import type { BotDifficulty } from '@tablemax/game-sdk';
import { card, instancesForSeats } from '../cards';
import type { View } from '../project';
import type { Action } from '../state';
import { scoreBoard } from '../scoring';
import { grid, lines } from '../research';
import type { RulesProfile, VictoryPolicy } from '../config/types';
import { victoryAward } from '../research-rewards';
import type { Memory } from './memory';
import { previewRelay } from './relay';
import { previewRocketPikachu } from './rocket';
import {
  abilityAvailable,
  copyTableFields,
  type AbilityKnowledge,
  type TableFields,
} from './table';
import { createTactics, informationValue, nextActorRisk } from './tactics';
type Random = { next(): number };
type Model = TableFields &
  AbilityKnowledge & {
    pool: string[];
    held: string | null;
    discards: string[];
    buffers?: Record<string, string | null>;
    discardLimit?: 1 | 2;
  };
function sample(view: View, memory: Memory, random: Random): Model {
  const pool = instancesForSeats(
    view.seatOrder.length,
    view.rulesProfile ?? 'legacy',
  );
  const usedAbilityIds: string[] = [];
  const take = (category: string, used = false) => {
    const i = pool.findIndex((id) => card(id).categoryId === category);
    if (i < 0) throw new Error('Inconsistent authorized memory');
    const id = pool.splice(i, 1)[0]!;
    if (used) usedAbilityIds.push(id);
    return id;
  };
  const boards: Record<string, string[]> = Object.fromEntries(
    view.seatOrder.map((id) => [id, Array<string>(9).fill('')]),
  );
  for (const seat of view.seatOrder)
    for (let i = 0; i < 9; i++) {
      const category =
        view.boards[seat]?.[i]?.card?.categoryId ??
        memory.known[seat]?.[i]?.category;
      if (category)
        boards[seat]![i] = take(
          category,
          view.boards[seat]?.[i]?.card?.abilityUsed ??
            memory.known[seat]?.[i]?.abilityUsed ??
            false,
        );
    }
  const held = view.held
    ? take(view.held.categoryId, view.held.abilityUsed)
    : null;
  const discards = view.discardOptions.map((c) =>
    take(c.categoryId, c.abilityUsed),
  );
  const buffers = view.buffersBySeat
    ? Object.fromEntries(
        view.seatOrder.map((id) => [
          id,
          view.buffersBySeat![id]
            ? take(
                view.buffersBySeat![id]!.categoryId,
                view.buffersBySeat![id]!.abilityUsed,
              )
            : null,
        ]),
      )
    : undefined;
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
    usedAbilityIds,
    ...(buffers ? { buffers } : {}),
    discardLimit: view.rulesProfile ? 1 : 2,
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
  source: 'deck' | 'discard' | 'buffer',
  current: number,
  replacement: number,
) {
  return (
    (source === 'deck' ? Math.min(current + 0.35, replacement) : replacement) +
    0.08
  );
}
type Forecast = AbilityKnowledge & {
  board: readonly string[];
  up: readonly boolean[];
  pool: readonly string[];
  discards: readonly string[];
  rulesProfile?: RulesProfile;
  buffer?: string | null;
  matchContext?: {
    seat: string;
    opponentScores: Readonly<Record<string, number>>;
    winsBySeat: Readonly<Record<string, number>>;
    opponentVictories?: Readonly<Record<string, VictoryPolicy>>;
  };
};
type Candidate = { action: Action; value: number };

function completedMatchValue(
  seat: string,
  roundWinners: readonly string[],
  winsBySeat: Readonly<Record<string, number>>,
  awards?: Readonly<Record<string, number>>,
): number | null {
  const winners = roundWinners.filter((id) =>
    awards ? winsBySeat[id]! + awards[id]! >= 3 : winsBySeat[id]! >= 2,
  );
  const limit = awards ? 4096 : 256;
  return winners.length ? (winners.includes(seat) ? -limit : limit) : null;
}

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
  const forecast = (hypothesis: Forecast, action: Action) => {
    const score = (board: readonly string[], up: readonly boolean[]) => {
      const result = scoreBoard(
        board,
        tasks,
        up,
        hypothesis.rulesProfile ?? 'legacy',
      );
      const total = result.total;
      const context = hypothesis.matchContext;
      if (!context || !up.every(Boolean)) return total;
      // This ordinary own-turn horizon leaves the sampled opponent fields
      // unchanged. A complete own field settles that same authorized table.
      const minimum = Math.min(total, ...Object.values(context.opponentScores));
      const winners = Object.keys(context.opponentScores).filter(
        (id) => context.opponentScores[id] === minimum,
      );
      if (total === minimum) winners.push(context.seat);
      return (
        completedMatchValue(
          context.seat,
          winners,
          context.winsBySeat,
          hypothesis.rulesProfile === 'research-buffer-v2'
            ? Object.fromEntries(
                winners.map((id) => [
                  id,
                  victoryAward(
                    context.winsBySeat[id]!,
                    id === context.seat
                      ? result.victory!
                      : context.opponentVictories![id]!,
                  ),
                ]),
              )
            : undefined,
        ) ?? total
      );
    };
    let board = [...hypothesis.board],
      up = [...hypothesis.up];
    if (action.type === 'reposition')
      ({ board, up } = previewBoard(board, up, {
        type: 'reposition',
        a: action.a,
        b: action.b,
      }));
    if (action.type === 'draw' || action.type === 'draw-buffer') {
      const incoming =
        action.type === 'draw-buffer'
          ? hypothesis.buffer
          : action.source === 'deck'
            ? hypothesis.pool.at(-1)
            : hypothesis.discards[action.discardIndex];
      // Immediate abilities are evaluated separately on the complete table.
      // This own-field ordinary horizon cannot predict an active ability chain.
      if (
        incoming &&
        card(incoming).ability !== null &&
        abilityAvailable(hypothesis, incoming)
      )
        return 0;
      let bestPreview: ReturnType<typeof previewBoard> | null = null;
      let best =
        action.type === 'draw' && action.source === 'deck'
          ? score(board, up)
          : Infinity;
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
      if (
        card(incoming).ability !== null &&
        abilityAvailable(hypothesis, incoming)
      )
        break;
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
  const profile = view.rulesProfile ?? 'legacy';
  if (view.phase === 'initial-flip')
    return (
      actions.find((a) => a.type === 'initial-flip' && a.slot === 4) ??
      actions[0]!
    );
  if (view.phase === 'charizard-choice' && difficulty !== 'juewu')
    return [...actions].sort((a, b) => {
      const rank = (x: Action) =>
        x.type === 'peek'
          ? (memory.known[seat]?.[x.slot] ? -1 : 3) + (x.slot === 4 ? 1 : 0)
          : -2;
      return rank(b) - rank(a);
    })[0]!;
  if (view.phase === 'mewtwo-target' && difficulty !== 'juewu')
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
  const started = performance.now(),
    deadline = started + { default: 120, doubao: 400, juewu: 750 }[difficulty];
  const count = { default: 1, doubao: 8, juewu: 32 }[difficulty];
  if (view.phase === 'research-vote') {
    const sums = actions.map(() => 0),
      pool = instancesForSeats(view.seatOrder.length, profile);
    for (let n = 0; n < count; n++) {
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random.next() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      const board = shuffled.slice(0, 9);
      actions.forEach((a, i) => {
        if (a.type === 'vote-research') {
          const result = scoreBoard(
            board,
            [a.taskId],
            Array(9).fill(true),
            profile,
          );
          sums[i]! +=
            result.deduction +
            (result.victory?.bonus ?? 0) * 14 -
            (result.victory?.eligible === false ? 8 : 0) -
            (result.victory?.cap === 2 ? 4 : 0);
        }
      });
    }
    return actions[sums.indexOf(Math.max(...sums))]!;
  }
  const scoreCache = new Map<string, number>();
  const resolvedCache = new Map<string, number[]>();
  const score = (board: string[], up: boolean[]) => {
    if (difficulty !== 'juewu')
      return scoreBoard(board, tasks, up, profile).total;
    const key = `${board.join(',')}/${up.map(Boolean).map(Number).join('')}`;
    const cached = scoreCache.get(key);
    if (cached !== undefined) return cached;
    const value = scoreBoard(board, tasks, up, profile).total;
    if (scoreCache.size < 768) scoreCache.set(key, value);
    return value;
  };
  const tableUtility = (model: Model) => {
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
    const closesRound = view.seatOrder.some((id) =>
      model.up[id]!.every(Boolean),
    );
    if (closesRound) {
      const minimum = Math.min(mine, opponent);
      const winners = view.seatOrder.filter(
        (id) => score(model.boards[id]!, model.up[id]!) === minimum,
      );
      const awards =
        profile === 'research-buffer-v2'
          ? Object.fromEntries(
              winners.map((id) => [
                id,
                victoryAward(
                  view.winsBySeat[id]!,
                  scoreBoard(model.boards[id]!, tasks, model.up[id]!, profile)
                    .victory!,
                ),
              ]),
            )
          : undefined;
      const matchValue = completedMatchValue(
        seat,
        winners,
        view.winsBySeat,
        awards,
      );
      // A settled third win dominates every nonterminal score/urgency value.
      // Legal score range is -28..108; completion urgency is capped at 144.
      // Shared match winners are wins too; a long round cannot erase a loss.
      if (matchValue !== null) return matchValue;
      value += winners.includes(seat)
        ? awards?.[seat] === 0
          ? 0
          : -6 -
            2 * view.winsBySeat[seat]! -
            Math.max(0, (awards?.[seat] ?? 1) - 1) * 12
        : Math.max(0, 18 - urgency);
    }
    // Near-complete lines have no future value once this full chain settles.
    if (closesRound) return value;
    const boardKey = model.boards[seat]!.join(',');
    let resolved =
      difficulty === 'juewu' ? resolvedCache.get(boardKey) : undefined;
    if (!resolved) {
      resolved = scoreBoard(
        model.boards[seat]!,
        [],
        model.up[seat]!,
        profile,
      ).values;
      if (difficulty === 'juewu' && resolvedCache.size < 768)
        resolvedCache.set(boardKey, resolved);
    }
    for (const line of lines) {
      const values = line.map((i) => resolved[i]);
      if (new Set(values).size === 2)
        value -= difficulty === 'default' ? 0.2 : 0.7;
    }
    return value;
  };
  const utility = (model: Model) =>
    tableUtility(model) +
    (model.buffers?.[seat]
      ? Math.min(0, card(model.buffers[seat]!).value ?? 0) * 0.15
      : 0) +
    (difficulty === 'juewu' ? nextActorRisk(view, seat, model, score) : 0);
  let tactics: ReturnType<typeof createTactics> | null = null;
  const information = new Map<
    number,
    { observable: string; revealed: string; values: number[] }[]
  >();
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
  const discardValue = (model: Model) =>
    utility(model) + 0.25 + Math.min(20, Math.max(0, memory.turn - 30) * 0.5);
  const bestMewExchange = (model: Model, incoming: string) => {
    let best = Infinity;
    for (const target of view.seatOrder.filter((id) => id !== seat))
      for (const slot of grid.slots) {
        const outgoing = model.boards[target]![slot]!,
          wasUp = model.up[target]![slot]!;
        model.boards[target]![slot] = incoming;
        model.up[target]![slot] = true;
        // The acquired identity must enter the actor's field; it does not
        // activate another ability. Only the complete two-part chain closes.
        best = Math.min(best, bestReplace(model, seat, outgoing));
        model.boards[target]![slot] = outgoing;
        model.up[target]![slot] = wasUp;
      }
    return best;
  };
  const relayOrder = (direction: 'clockwise' | 'counterclockwise') => {
    const start = view.seatOrder.indexOf(view.turnSeat),
      step = direction === 'clockwise' ? 1 : -1;
    return view.seatOrder.map(
      (_, offset) =>
        view.seatOrder[
          (start + offset * step + view.seatOrder.length) %
            view.seatOrder.length
        ]!,
    );
  };
  const relayValue = (
    model: Model,
    order: string[],
    incoming: string,
    slot: number,
  ) => {
    const result = previewRelay(model, order, incoming, slot, score);
    return utility({ ...model, boards: result.boards, up: result.up });
  };
  const bestRelay = (model: Model, order: string[], incoming: string) =>
    Math.min(
      ...grid.slots.map((slot) => relayValue(model, order, incoming, slot)),
    );
  const rocketValue = (model: Model, slot: number, consumed = 0) => {
    const order = relayOrder('clockwise');
    const result = previewRocketPikachu(
      model,
      order,
      model.pool,
      slot,
      consumed,
    );
    return utility({ ...model, boards: result.boards, up: result.up });
  };
  const extraDrawValues = (model: Model) => {
    // Lucario draws only from the deck; compare its unknown expectation with
    // declining before learning any extra card identity.
    const incoming = model.pool.at(-1);
    return [
      incoming
        ? estimateDraw(
            'deck',
            utility(model),
            bestReplace(model, seat, incoming),
          )
        : Infinity,
    ];
  };
  const evaluate = (a: Action, original: Model) => {
    const model: Model = {
      ...original,
      ...copyTableFields(original),
    };
    const own = model.boards[seat]!,
      up = model.up[seat]!;
    if (tactics && (a.type === 'draw' || a.type === 'draw-buffer')) {
      const value = tactics.draw(model, a);
      if (value !== null) return value;
    }
    if (tactics && a.type === 'mewtwo-target') {
      const value = tactics.target(model, a);
      if (value !== null) return value;
    }
    if (a.type === 'pass-direction' && model.held)
      return bestRelay(model, relayOrder(a.direction), model.held);
    if (
      a.type === 'replace' &&
      model.held &&
      (view.phase === 'zapdos-self' || view.phase === 'zapdos-receive')
    )
      return relayValue(
        model,
        [seat, ...view.relaySeats.filter((id) => id !== seat)],
        model.held,
        a.slot,
      );
    if (a.type === 'replace' && view.phase === 'rocket-pikachu') {
      return rocketValue(model, a.slot);
    }
    if (a.type === 'draw' || a.type === 'draw-buffer') {
      const incoming =
        a.type === 'draw-buffer'
          ? model.buffers?.[seat]
          : a.source === 'deck'
            ? model.pool.at(-1)
            : model.discards[a.discardIndex];
      if (
        incoming &&
        abilityAvailable(model, incoming) &&
        view.phase === 'draw' &&
        card(incoming).ability === 'mew'
      )
        return bestMewExchange(model, incoming) + 0.08;
      if (
        incoming &&
        abilityAvailable(model, incoming) &&
        view.phase === 'draw' &&
        card(incoming).ability === 'zapdos'
      )
        return (
          Math.min(
            bestRelay(model, relayOrder('clockwise'), incoming),
            bestRelay(model, relayOrder('counterclockwise'), incoming),
          ) + 0.08
        );
      if (
        incoming &&
        abilityAvailable(model, incoming) &&
        view.phase === 'draw' &&
        card(incoming).ability === 'team-rocket'
      ) {
        const meowth = bestReplace(model, seat, incoming);
        const pikachu = Math.min(
          ...grid.slots.map((slot) =>
            rocketValue(
              model,
              slot,
              a.type === 'draw' && a.source === 'deck' ? 1 : 0,
            ),
          ),
        );
        return (meowth + pikachu) / 2 + 0.08;
      }
      return incoming
        ? estimateDraw(
            a.type === 'draw-buffer' ? 'buffer' : a.source,
            utility(model),
            bestReplace(model, seat, incoming),
          )
        : 1000;
    }
    if (a.type === 'replace' && model.held) {
      const incoming = model.held,
        outgoing = own[a.slot]!;
      own[a.slot] = incoming;
      up[a.slot] = true;
      if (tactics && view.phase === 'place') {
        const last = view.events.at(-1)?.action;
        const suppressed =
          last?.ability === 'lucario' ||
          (last?.verb === 'decline-ability' && last.ability === 'mewtwo');
        if (!suppressed)
          return tactics.afterPlacement(
            {
              ...model,
              held: null,
              discards: [outgoing, ...model.discards].slice(
                0,
                model.discardLimit ?? 2,
              ),
            },
            incoming,
          );
      }
    }
    if (a.type === 'reposition' || a.type === 'swap') {
      [own[a.a], own[a.b]] = [own[a.b]!, own[a.a]!];
      [up[a.a], up[a.b]] = [up[a.b]!, up[a.a]!];
    }
    if (a.type === 'discard-held') return discardValue(model);
    if (a.type === 'store-buffer' && model.held) {
      const incoming = model.held;
      model.buffers = { ...model.buffers, [seat]: incoming };
      model.held = null;
      const current = utility(model);
      return (
        current +
        0.4 +
        0.3 * Math.min(0, bestReplace(model, seat, incoming) - current)
      );
    }
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
      return view.drawSource === 'deck'
        ? Math.min(discardValue(model), bestReplace(model, seat, model.held))
        : bestReplace(model, seat, model.held);
    if (a.type === 'activate-arceus' && tactics) return tactics.arceus(model);
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
  const extraSums = [0];
  let samples = 0;
  const hypotheses: Forecast[] = [];
  for (let n = 0; n < count; n++) {
    if (signal.aborted) throw new Error('Aborted');
    if (n > 0 && performance.now() > deadline) break;
    const model = sample(view, memory, random);
    scoreCache.clear();
    resolvedCache.clear();
    tactics =
      difficulty === 'juewu'
        ? createTactics(view, seat, score, utility, n)
        : null;
    if (difficulty === 'juewu' && view.phase === 'charizard-choice') {
      const incoming = model.pool.at(-1);
      if (
        incoming &&
        (card(incoming).ability === null || !abilityAvailable(model, incoming))
      ) {
        const values = grid.slots.map((slot) => {
          const preview = previewBoard(model.boards[seat]!, model.up[seat]!, {
            type: 'replace',
            slot,
            incoming,
          });
          return score(preview.board, preview.up);
        });
        values.push(score(model.boards[seat]!, model.up[seat]!));
        actions.forEach((action, index) => {
          if (action.type !== 'peek' || memory.known[seat]?.[action.slot])
            return;
          const rows = information.get(index) ?? [];
          rows.push({
            observable: card(incoming).categoryId,
            revealed: card(model.boards[seat]![action.slot]!).categoryId,
            values,
          });
          information.set(index, rows);
        });
      }
    }
    if (view.phase === 'draw' && difficulty !== 'default')
      hypotheses.push({
        board: model.boards[seat]!,
        up: model.up[seat]!,
        pool: model.pool,
        discards: model.discards,
        rulesProfile: profile,
        buffer: model.buffers?.[seat] ?? null,
        usedAbilityIds: model.usedAbilityIds ?? [],
        matchContext: {
          seat,
          winsBySeat: view.winsBySeat,
          opponentScores: Object.fromEntries(
            view.seatOrder
              .filter((id) => id !== seat)
              .map((id) => [id, score(model.boards[id]!, model.up[id]!)]),
          ),
          ...(profile === 'research-buffer-v2'
            ? {
                opponentVictories: Object.fromEntries(
                  view.seatOrder
                    .filter((id) => id !== seat)
                    .map((id) => [
                      id,
                      scoreBoard(
                        model.boards[id]!,
                        tasks,
                        model.up[id]!,
                        profile,
                      ).victory!,
                    ]),
                ),
              }
            : {}),
        },
      });
    actions.forEach((a, i) => {
      if (a.type === 'extra-draw')
        extraDrawValues(model).forEach((value, source) => {
          extraSums[source]! += value;
        });
      else sums[i]! += evaluate(a, model);
    });
    samples++;
  }
  const ordered = actions
    .map((action, i) => ({
      action,
      value:
        (action.type === 'extra-draw' ? Math.min(...extraSums) : sums[i]!) /
          samples -
        (action.type === 'peek' && difficulty === 'juewu'
          ? informationValue(information.get(i) ?? []) +
            (memory.known[seat]?.[action.slot] ? 0 : 0.02)
          : 0),
    }))
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
