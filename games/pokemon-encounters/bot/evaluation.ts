import type { Action } from '../rules';
import { scoreBoard } from '../rules/scoring';
import type { PokemonView } from '../rules/project';
import type { StrategyMemory } from './memory';
import {
  bestPreliminaryPlacement,
  knownBoards,
  numericDistribution,
  unseenCounts,
  type BeliefBoard,
} from './strategy';

type World = {
  boards: Record<string, string[]>;
  faceUp: Record<string, boolean[]>;
  future: string[];
  cursor: number;
};
const slots = [0, 1, 2, 3, 4, 5];
const swaps = slots.flatMap((a) =>
  slots.filter((b) => b > a).map((b) => ({ a, b })),
);
export const EVALUATION_WORLDS = 32;

// Fixed stratified integration points approximate expectations without
// making random moves, consuming the game's RNG, or depending on a clock.
const integrationRanks = new Map<number, number[]>();
export function integrationPoint(sample: number, dimension: number) {
  let ranks = integrationRanks.get(dimension);
  if (!ranks) {
    const hash = (rank: number) => {
      let value = Math.imul(dimension + 1, 0x9e3779b9) ^ rank;
      value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
      value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
      return (value ^ (value >>> 16)) >>> 0;
    };
    ranks = Array.from({ length: EVALUATION_WORLDS }, (_, index) => index).sort(
      (a, b) => hash(a) - hash(b) || a - b,
    );
    integrationRanks.set(dimension, ranks);
  }
  return (ranks[sample]! + 0.5) / EVALUATION_WORLDS;
}
function clone(world: World): World {
  return {
    boards: Object.fromEntries(
      Object.entries(world.boards).map(([seat, board]) => [seat, [...board]]),
    ),
    faceUp: Object.fromEntries(
      Object.entries(world.faceUp).map(([seat, board]) => [seat, [...board]]),
    ),
    future: world.future,
    cursor: world.cursor,
  };
}
function replace(world: World, seat: string, slot: number, incoming: string) {
  const next = clone(world);
  const outgoing = next.boards[seat]![slot]!;
  next.boards[seat]![slot] = incoming;
  next.faceUp[seat]![slot] = true;
  return { next, outgoing };
}
function swap(world: World, seat: string, a: number, b: number) {
  const next = clone(world);
  [next.boards[seat]![a], next.boards[seat]![b]] = [
    next.boards[seat]![b]!,
    next.boards[seat]![a]!,
  ];
  [next.faceUp[seat]![a], next.faceUp[seat]![b]] = [
    next.faceUp[seat]![b]!,
    next.faceUp[seat]![a]!,
  ];
  return next;
}

export class PositionEvaluator {
  private known: Record<string, BeliefBoard>;
  private distribution: ReturnType<typeof numericDistribution>;
  private worlds: World[];
  private scores = new Map<string, number>();

  constructor(
    private view: PokemonView,
    private seatId: string,
    memory: StrategyMemory,
    private signal: AbortSignal,
  ) {
    this.known = knownBoards(view, seatId, memory);
    const unseen = unseenCounts(view, this.known);
    this.distribution = numericDistribution(unseen);
    this.worlds = Array.from({ length: EVALUATION_WORLDS }, (_, sample) => {
      const pool = new Map(unseen);
      let dimension = 0;
      const pick = () => {
        const total = [...pool.values()].reduce((sum, count) => sum + count, 0);
        if (total < 1) throw new Error('Insufficient unseen-card belief');
        // Each dimension covers every equal-width probability interval once.
        // Independent fixed permutations avoid coupling corresponding slots.
        const point = integrationPoint(sample, dimension);
        dimension++;
        let target = Math.floor(point * total);
        for (const [id, count] of pool) {
          target -= count;
          if (target < 0) {
            pool.set(id, count - 1);
            return id;
          }
        }
        throw new Error('Invalid unseen-card belief');
      };
      const boards = Object.fromEntries(
        view.seatOrder.map((seat) => [
          seat,
          this.known[seat]!.map((id) => id ?? pick()),
        ]),
      );
      // A known discard top becomes eligible when an empty deck is reshuffled.
      if (!view.deckCount && view.discardTop)
        pool.set(
          view.discardTop.categoryId,
          (pool.get(view.discardTop.categoryId) ?? 0) + 1,
        );
      return {
        boards,
        faceUp: Object.fromEntries(
          view.seatOrder.map((seat) => [
            seat,
            view.boards[seat]!.map((slot) => slot.faceUp),
          ]),
        ),
        future: Array.from({ length: 7 }, pick),
        cursor: 0,
      };
    });
  }

  private check() {
    if (this.signal.aborted) throw new Error('Aborted');
  }
  private score(board: readonly string[]) {
    const key = board.join('|');
    const cached = this.scores.get(key);
    if (cached !== undefined) return cached;
    const counts = new Map<string, number>();
    const instances = board.map((id) => {
      const count = (counts.get(id) ?? 0) + 1;
      counts.set(id, count);
      return `${id}#${String(count).padStart(2, '0')}`;
    });
    const score = scoreBoard(instances).total;
    if (this.scores.size >= 20_000) this.scores.clear();
    this.scores.set(key, score);
    return score;
  }

  private utility(world: World) {
    const own = this.score(world.boards[this.seatId]!);
    const opponents = this.view.seatOrder.filter(
      (seat) => seat !== this.seatId,
    );
    const otherScores = opponents.map((seat) =>
      this.score(world.boards[seat]!),
    );
    const lowest = Math.min(...otherScores);
    const losing = own > lowest;
    const critical = opponents.some(
      (seat, index) =>
        otherScores[index] === lowest && this.view.winsBySeat[seat] === 2,
    );
    const ended = this.view.seatOrder.some((seat) =>
      world.faceUp[seat]!.every(Boolean),
    );
    // Complete-round probability dominates minor point improvements; a rival's
    // third victory carries extra risk. Ties remain wins under adopted rules.
    if (ended)
      return own - 0.12 * lowest + (losing ? 22 + (critical ? 12 : 0) : -10);
    const threat = Math.max(
      ...opponents.map((seat) => {
        const hidden = world.faceUp[seat]!.filter((up) => !up).length;
        return hidden === 1 ? 0.65 : hidden === 2 ? 0.3 : 0.08;
      }),
    );
    return (
      own -
      0.12 * lowest +
      0.35 -
      0.12 * world.faceUp[this.seatId]!.filter(Boolean).length +
      threat * (losing ? 10 + (critical ? 6 : 0) : -3)
    );
  }
  private mean(worlds: readonly World[]) {
    this.check();
    return (
      worlds.reduce((total, world) => total + this.utility(world), 0) /
      worlds.length
    );
  }
  private best(
    worlds: readonly World[],
    changes: readonly ((world: World) => World)[],
  ) {
    let value = Infinity;
    for (const change of changes)
      value = Math.min(value, this.mean(worlds.map(change)));
    return value;
  }

  private snorlax(worlds: readonly World[]) {
    return this.best(worlds, [
      (world) => world,
      ...swaps.map(
        ({ a, b }) =>
          (world: World) =>
            swap(world, this.seatId, a, b),
      ),
    ]);
  }

  private placement(
    worlds: readonly World[],
    slot: number,
    incoming: string,
    trigger: boolean,
    allowPass = false,
  ) {
    const next = worlds.map((world) => {
      const result = replace(world, this.seatId, slot, incoming);
      if (allowPass) return this.pass(result.next, result.outgoing);
      return result.next;
    });
    if (trigger && incoming === 'special-snorlax') return this.snorlax(next);
    const information =
      trigger &&
      incoming === 'special-charizard' &&
      this.known[this.seatId]!.some(
        (id, index) => id === null && index !== slot,
      )
        ? 0.6
        : 0;
    return this.mean(next) - information;
  }

  private pass(world: World, held: string) {
    let next = world;
    const origin = this.view.seatOrder.indexOf(this.view.turnSeat);
    const clockwise = Array.from(
      { length: this.view.seatOrder.length - 1 },
      (_, index) =>
        this.view.seatOrder[(origin + index + 1) % this.view.seatOrder.length]!,
    );
    const remaining =
      this.view.phase === 'zapdos-receive'
        ? clockwise.slice(clockwise.indexOf(this.seatId) + 1)
        : clockwise;
    for (const other of remaining) {
      // Model the next recipient's legal information. Its sampled hidden cards
      // are excluded from target selection; the outgoing card is revealed only
      // after the recipient has chosen, just as in the actual pass sequence.
      const visible = next.boards[other]!.map((id, index) =>
        next.faceUp[other]![index] ? id : null,
      );
      const choice = bestPreliminaryPlacement(
        visible,
        held,
        this.distribution,
        next.faceUp[other]!,
      );
      const result = replace(next, other, choice.slot, held);
      next = result.next;
      held = result.outgoing;
    }
    return next;
  }

  private rocket(worlds: readonly World[], slot: number) {
    const start = this.view.seatOrder.indexOf(this.view.turnSeat);
    const order = Array.from(
      { length: this.view.seatOrder.length },
      (_, index) =>
        this.view.seatOrder[(start + index) % this.view.seatOrder.length]!,
    );
    return this.mean(
      worlds.map((world) => {
        let next = clone(world);
        for (const seat of order) {
          next = replace(next, seat, slot, next.future[next.cursor++]!).next;
        }
        return next;
      }),
    );
  }

  private mew(worlds: readonly World[], target: string, slot: number) {
    const groups = new Map<string, World[]>();
    for (const world of worlds) {
      const { next, outgoing } = replace(world, target, slot, 'special-mew');
      const group = groups.get(outgoing) ?? [];
      group.push(next);
      groups.set(outgoing, group);
    }
    let value = 0;
    for (const [revealed, group] of groups) {
      // The acquired card is revealed before the subsequent owner placement.
      // Choose a common placement for each observed category, never separately
      // for each unobserved completion of the rest of the boards.
      const best = Math.min(
        ...slots.map((ownSlot) =>
          this.placement(group, ownSlot, revealed, false),
        ),
      );
      value += (best * group.length) / worlds.length;
    }
    return value;
  }

  private incoming(
    worlds: readonly World[],
    incoming: string,
    mayDiscard: boolean,
  ) {
    if (incoming === 'special-mew')
      return Math.min(
        ...this.view.seatOrder
          .filter((seat) => seat !== this.seatId)
          .flatMap((seat) => slots.map((slot) => this.mew(worlds, seat, slot))),
      );
    if (incoming === 'special-team-rocket') {
      const meowth = Math.min(
        ...slots.map((slot) => this.placement(worlds, slot, incoming, false)),
      );
      const pikachu = Math.min(
        ...slots.map((slot) => this.rocket(worlds, slot)),
      );
      return (meowth + pikachu) / 2;
    }
    const values = slots.map((slot) =>
      this.placement(
        worlds,
        slot,
        incoming,
        true,
        incoming === 'special-zapdos',
      ),
    );
    if (mayDiscard && incoming !== 'special-zapdos')
      values.push(this.mean(worlds));
    return Math.min(...values);
  }

  private drawDeck() {
    const groups = new Map<string, World[]>();
    for (const world of this.worlds) {
      const next = clone(world);
      const incoming = next.future[next.cursor++]!;
      const group = groups.get(incoming) ?? [];
      group.push(next);
      groups.set(incoming, group);
    }
    let value = 0;
    for (const [incoming, worlds] of groups)
      value +=
        (this.incoming(worlds, incoming, true) * worlds.length) /
        this.worlds.length;
    return value;
  }

  private peek(slot: number) {
    if (this.known[this.seatId]![slot] !== null)
      return this.mean(this.worlds) + 0.05;
    const contributions = this.worlds.map((world) => {
      const before = this.score(world.boards[this.seatId]!);
      const altered = [...world.boards[this.seatId]!];
      altered[slot] = world.future[world.cursor]!;
      return before - this.score(altered);
    });
    const mean =
      contributions.reduce((sum, value) => sum + value, 0) /
      contributions.length;
    const variance =
      contributions.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      contributions.length;
    const adjacentDitto = [slot - 1, slot + 1].some(
      (neighbor) =>
        neighbor >= 0 &&
        neighbor < 6 &&
        Math.floor(neighbor / 3) === Math.floor(slot / 3) &&
        this.known[this.seatId]![neighbor] === 'special-ditto',
    );
    return (
      this.mean(this.worlds) -
      0.5 -
      Math.sqrt(variance) * 0.08 -
      (adjacentDitto ? 0.2 : 0)
    );
  }

  choose(actions: readonly Action[]) {
    if (this.view.phase === 'initial-flip')
      return (
        actions.find(
          (action) => action.type === 'initial-flip' && action.slot === 1,
        ) ?? actions[0]!
      );
    if (this.view.phase === 'charizard-view') return actions[0]!;
    let best = actions[0]!,
      bestValue = Infinity;
    for (const action of actions) {
      this.check();
      let value: number;
      if (action.type === 'draw')
        value =
          action.source === 'deck'
            ? this.drawDeck()
            : this.incoming(
                this.worlds,
                this.view.discardTop!.categoryId,
                false,
              );
      else if (action.type === 'replace')
        value =
          this.view.phase === 'rocket-pikachu'
            ? this.rocket(this.worlds, action.slot)
            : this.placement(
                this.worlds,
                action.slot,
                this.view.held!.categoryId,
                this.view.phase === 'place',
                ['zapdos-self', 'zapdos-receive'].includes(this.view.phase),
              );
      else if (action.type === 'mew-target')
        value = this.mew(this.worlds, action.seat, action.slot);
      else if (action.type === 'swap')
        value =
          this.mean(
            this.worlds.map((world) =>
              swap(world, this.seatId, action.a, action.b),
            ),
          ) + 0.025;
      else if (action.type === 'peek') value = this.peek(action.slot);
      else value = this.mean(this.worlds);
      // A strict tie keeps the earliest legal candidate. Evaluation never
      // invents a target or submits trial actions to the rule engine.
      if (value < bestValue - 1e-9) {
        best = action;
        bestValue = value;
      }
    }
    return best;
  }
}
