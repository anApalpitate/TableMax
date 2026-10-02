import type { Action } from '../rules';
import { categories } from '../rules/cards';
import type { PokemonView } from '../rules/project';
import type { StrategyMemory } from './memory';

export type CardId = string;
export type BeliefBoard = (CardId | null)[];

export const valueOf = (id: CardId) => {
  const card = categories.find((c) => c.categoryId === id)!;
  return card.value.kind === 'fixed' ? card.value.number! : null;
};

export function basicAction(
  view: PokemonView,
  actions: readonly Action[],
  seatId: string,
) {
  const own = view.boards[seatId]!;
  const priority = (slot: number) =>
    own[slot]!.faceUp ? 100 - (own[slot]!.card?.value ?? -100) : slot;
  let action: Action | undefined;
  if (view.phase === 'initial-flip')
    action = actions.find((a) => a.type === 'initial-flip');
  else if (view.phase === 'draw')
    action = actions.find((a) => a.type === 'draw' && a.source === 'deck');
  else if (view.phase === 'mew-other') {
    const start = view.seatOrder.indexOf(seatId);
    const other = view.seatOrder[(start + 1) % view.seatOrder.length]!;
    const candidates = actions.filter(
      (a): a is Extract<Action, { type: 'mew-target' }> =>
        a.type === 'mew-target' && a.seat === other,
    );
    candidates.sort(
      (a, b) =>
        (view.boards[other]![a.slot]!.faceUp ? 10 + a.slot : a.slot) -
        (view.boards[other]![b.slot]!.faceUp ? 10 + b.slot : b.slot),
    );
    action = candidates[0];
  } else if (view.phase === 'snorlax-choice')
    action = actions.find((a) => a.type === 'decline-ability');
  else if (view.phase === 'charizard-choice')
    action = actions.find((a) => a.type === 'peek');
  else if (view.phase === 'charizard-view')
    action = actions.find((a) => a.type === 'close-peek');
  else {
    const candidates = actions.filter(
      (
        a,
      ): a is Extract<Action, { type: 'replace' | 'initial-flip' | 'peek' }> =>
        a.type === 'replace',
    );
    candidates.sort(
      (a, b) =>
        (view.phase === 'rocket-pikachu'
          ? (own[a.slot]!.faceUp ? 10 + a.slot : a.slot) -
            (own[b.slot]!.faceUp ? 10 + b.slot : b.slot)
          : priority(a.slot) - priority(b.slot)) || a.slot - b.slot,
    );
    action = candidates[0];
  }
  return action ?? actions[0]!;
}

export function knownBoards(
  view: PokemonView,
  seatId: string,
  memory: StrategyMemory,
) {
  return Object.fromEntries(
    view.seatOrder.map((seat) => [
      seat,
      view.boards[seat]!.map(
        (slot, index) =>
          slot.card?.categoryId ??
          (seat === seatId ? memory.cards[index]! : null),
      ),
    ]),
  );
}

// Unseen cards are exchangeable: no assumptions about actual deck order,
// face-down boards or unknown cards below the discard top enter the strategy.
export function unseenCounts(
  view: PokemonView,
  known: Record<string, BeliefBoard>,
) {
  const counts = new Map(categories.map((c) => [c.categoryId, c.quantity]));
  for (const id of [
    ...Object.values(known).flat(),
    view.held?.categoryId ?? null,
    view.discardTop?.categoryId ?? null,
  ])
    if (id) counts.set(id, Math.max(0, (counts.get(id) ?? 0) - 1));
  return counts;
}

export function numericDistribution(counts: ReadonlyMap<string, number>) {
  const values = new Map<number, number>();
  for (const [id, count] of counts) {
    // An unknown Ditto has no fixed value; use the ordinary-card expectation
    // in this deliberately short-horizon level, rather than inventing a value.
    const value = valueOf(id);
    if (value !== null) values.set(value, (values.get(value) ?? 0) + count);
  }
  const total = [...values.values()].reduce((sum, count) => sum + count, 0);
  return [...values].map(([value, count]) => ({
    value,
    probability: count / total,
  }));
}

export function preliminaryScore(
  board: readonly (CardId | null)[],
  distribution: ReturnType<typeof numericDistribution>,
) {
  const mean = distribution.reduce(
    (sum, c) => sum + c.value * c.probability,
    0,
  );
  const value = (slot: number): number | null => {
    const id = board[slot];
    if (!id) return null;
    const fixed = valueOf(id);
    if (fixed !== null) return fixed;
    const adjacent = [slot - 1, slot + 1]
      .filter(
        (next) =>
          next >= 0 &&
          next < 6 &&
          Math.floor(next / 3) === Math.floor(slot / 3),
      )
      .flatMap((next) => {
        const neighbor = board[next];
        const fixed = neighbor ? valueOf(neighbor) : null;
        return fixed === null ? [] : [fixed];
      });
    return adjacent.length ? Math.min(...adjacent) : mean;
  };
  const pair = (a: number, b: number) => (a === b ? 0 : a + b);
  let total = 0;
  for (let column = 0; column < 3; column++) {
    const a = value(column),
      b = value(column + 3);
    if (a !== null && b !== null) total += pair(a, b);
    else if (a !== null || b !== null) {
      const known = a ?? b!;
      total += distribution.reduce(
        (sum, c) => sum + c.probability * pair(known, c.value),
        0,
      );
    } else
      for (const left of distribution)
        for (const right of distribution)
          total +=
            left.probability *
            right.probability *
            pair(left.value, right.value);
  }
  return total;
}

export function bestPreliminaryPlacement(
  board: BeliefBoard,
  incoming: CardId | null,
  distribution: ReturnType<typeof numericDistribution>,
  faceUp: readonly boolean[],
) {
  let best = { slot: 0, score: Infinity };
  for (let slot = 0; slot < 6; slot++) {
    const next = [...board];
    next[slot] = incoming;
    const score =
      preliminaryScore(next, distribution) - (faceUp[slot] ? 0 : 0.35);
    if (score < best.score - 1e-9) best = { slot, score };
  }
  return best;
}

export function preliminaryAction(
  view: PokemonView,
  actions: readonly Action[],
  seatId: string,
  memory: StrategyMemory,
) {
  const boards = knownBoards(view, seatId, memory);
  const own = boards[seatId]!;
  const distribution = numericDistribution(unseenCounts(view, boards));
  const baseline = preliminaryScore(own, distribution);
  const faceUp = view.boards[seatId]!.map((slot) => slot.faceUp);
  const otherBaseline = (seat: string) =>
    preliminaryScore(boards[seat]!, distribution);
  const scorePlacement = (slot: number, incoming: CardId | null) => {
    const next = [...own];
    next[slot] = incoming;
    const ownScore = preliminaryScore(next, distribution);
    const closes = faceUp.filter(Boolean).length === 5 && !faceUp[slot];
    const opponent = Math.min(
      ...view.seatOrder.filter((seat) => seat !== seatId).map(otherBaseline),
    );
    return (
      ownScore -
      (faceUp[slot] ? 0 : 0.35) +
      (closes && ownScore > opponent ? 4 : 0)
    );
  };
  const score = (action: Action): number => {
    if (action.type === 'replace') {
      if (view.phase !== 'rocket-pikachu')
        return scorePlacement(action.slot, view.held!.categoryId);
      let result = scorePlacement(action.slot, null);
      for (const other of view.seatOrder.filter((seat) => seat !== seatId)) {
        const board = [...boards[other]!];
        board[action.slot] = null;
        result -=
          0.12 * (preliminaryScore(board, distribution) - otherBaseline(other));
      }
      return result;
    }
    if (action.type === 'discard-held' || action.type === 'decline-ability')
      return baseline;
    if (action.type === 'swap') {
      const next = [...own];
      [next[action.a], next[action.b]] = [next[action.b]!, next[action.a]!];
      return preliminaryScore(next, distribution) + 0.05;
    }
    if (action.type === 'mew-target') {
      const next = [...boards[action.seat]!];
      const incoming = next[action.slot]!;
      next[action.slot] = 'special-mew';
      return (
        bestPreliminaryPlacement(own, incoming, distribution, faceUp).score -
        0.12 *
          (preliminaryScore(next, distribution) - otherBaseline(action.seat))
      );
    }
    if (action.type === 'draw') {
      if (action.source === 'deck') return baseline - 0.9;
      const incoming = view.discardTop!.categoryId;
      // Mandatory-effect cards need the deeper level's multi-step model.
      if (
        ['special-mew', 'special-team-rocket', 'special-zapdos'].includes(
          incoming,
        )
      )
        return baseline;
      return Math.min(
        ...Array.from({ length: 6 }, (_, slot) =>
          scorePlacement(slot, incoming),
        ),
      );
    }
    if (action.type === 'peek') {
      if (memory.cards[action.slot]) return baseline + 0.1;
      const counterpart = own[(action.slot + 3) % 6];
      return (
        baseline -
        0.5 -
        (counterpart ? Math.abs(valueOf(counterpart) ?? 0) * 0.03 : 0)
      );
    }
    return baseline;
  };
  if (view.phase === 'initial-flip' || view.phase === 'charizard-view')
    return actions[0]!;
  let best = actions[0]!;
  let bestScore = score(best);
  for (const candidate of actions.slice(1)) {
    const candidateScore = score(candidate);
    if (candidateScore < bestScore - 1e-9) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}
