import { original } from '../variants/original';
import { topology } from '../shared/topology';
const grid = topology(original.layout);
import type { Action } from '../rules';
import { scoreBoard } from '../rules/scoring';
import type { PokemonView } from '../rules/project';
import type { StrategyMemory } from './memory';
import type { BotDifficulty } from '@tablemax/game-sdk';
import {
  bestPreliminaryPlacement,
  knownBoards,
  numericDistribution,
  preliminaryScore,
  unseenCounts,
  type BeliefBoard,
} from './strategy';

type World = {
  boards: Record<string, string[]>;
  faceUp: Record<string, boolean[]>;
  future: string[];
  cursor: number;
  discard: string[];
  privateCards: (string | null)[];
  privateSeat: string;
  weight: number;
};
const slots = grid.slots;
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
    discard: [...world.discard],
    privateCards: [...world.privateCards],
    privateSeat: world.privateSeat,
    weight: world.weight,
  };
}
function replace(world: World, seat: string, slot: number, incoming: string) {
  const next = clone(world);
  const outgoing = next.boards[seat]![slot]!;
  next.boards[seat]![slot] = incoming;
  next.faceUp[seat]![slot] = true;
  next.discard.push(outgoing);
  return { next, outgoing };
}
function swap(world: World, seat: string, a: number, b: number) {
  const next = clone(world);
  if (seat === next.privateSeat)
    [next.privateCards[a], next.privateCards[b]] = [
      next.privateCards[b]!,
      next.privateCards[a]!,
    ];
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
  private nodes = 0;
  private depth = 0;
  private budget: number;
  private nodeLimit: number;
  private memory: StrategyMemory;
  get statistics() {
    return {
      worlds: this.worlds.length,
      expandedNodes: this.nodes,
      cachedScores: this.scores.size,
    };
  }

  constructor(
    private view: PokemonView,
    private seatId: string,
    memory: StrategyMemory,
    private signal: AbortSignal,
    private difficulty: BotDifficulty = 'juewu',
  ) {
    this.memory = memory;
    this.budget = difficulty === 'doubao' ? 4096 : 8192;
    this.nodeLimit = this.budget;
    this.known = knownBoards(view, seatId, memory);
    const unseen = unseenCounts(view, this.known);
    this.distribution = numericDistribution(unseen);
    const samples = difficulty === 'doubao' ? 8 : EVALUATION_WORLDS;
    this.worlds = Array.from({ length: samples }, (_, sample) => {
      const pool = new Map(unseen);
      let dimension = 0;
      const pick = () => {
        const total = [...pool.values()].reduce((sum, count) => sum + count, 0);
        if (total < 1) throw new Error('Insufficient unseen-card belief');
        // Each dimension covers every equal-width probability interval once.
        // Independent fixed permutations avoid coupling corresponding slots.
        const point = integrationPoint(
          sample * (EVALUATION_WORLDS / samples),
          dimension,
        );
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
      const remaining = [...pool.values()].reduce((a, b) => a + b, 0);
      const shuffled = Array.from({ length: remaining }, pick);
      const discard = shuffled.slice(view.deckCount);
      if (view.discardTop) discard.push(view.discardTop.categoryId);
      return {
        boards,
        faceUp: Object.fromEntries(
          view.seatOrder.map((seat) => [
            seat,
            view.boards[seat]!.map((slot) => slot.faceUp),
          ]),
        ),
        future: shuffled.slice(0, view.deckCount),
        cursor: 0,
        discard,
        privateCards: [...memory.cards],
        privateSeat: seatId,
        weight: 1,
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
    if (ended) {
      const ownMatch = !losing && this.view.winsBySeat[this.seatId] === 2;
      const rivalMatch = critical && !ownMatch;
      return (
        own * 0.1 + (ownMatch ? -180 : rivalMatch ? 180 : losing ? 90 : -90)
      );
    }
    const summaries = this.memory.version === 2 ? this.memory.summaries : [];
    const endingSpeed = summaries.length
      ? summaries.reduce(
          (sum, s, i) =>
            sum +
            Math.max(0.5, Math.min(1.5, 8 / Math.max(1, s.turns))) *
              (this.difficulty === 'doubao' && i === 0 && summaries.length > 1
                ? 0.5
                : 1),
          0,
        ) / summaries.length
      : 1;
    const threat = Math.min(
      1,
      endingSpeed *
        Math.max(
          ...opponents.map((seat) => {
            const hidden = world.faceUp[seat]!.filter((up) => !up).length;
            return hidden === 1 ? 0.65 : hidden === 2 ? 0.3 : 0.08;
          }),
        ),
    );
    const allScores = [own, ...otherScores];
    const allSeats = [this.seatId, ...opponents];
    const minimum = Math.min(...allScores);
    const hazards = allScores.map((score, i) => {
      const past = summaries.length
        ? summaries.reduce(
            (sum, s, index) =>
              sum +
              (s.winners.includes(allSeats[i]!) ? 1 : 0) *
                (this.difficulty === 'doubao' &&
                index === 0 &&
                summaries.length > 1
                  ? 0.5
                  : 1),
            0,
          ) / summaries.length
        : 0;
      return (
        (Math.exp(-(score - minimum) / 6) + past * 0.12) /
        (3 - this.view.winsBySeat[allSeats[i]!]!)
      );
    });
    const matchChance = hazards[0]! / hazards.reduce((a, b) => a + b, 0);
    return (
      -60 * matchChance +
      own * 0.35 -
      0.12 * lowest +
      0.35 +
      threat * (losing ? 10 + (critical ? 6 : 0) : -3)
    );
  }
  private mean(worlds: readonly World[]) {
    this.check();
    return this.depth && this.nodes < this.nodeLimit
      ? this.rollout(worlds, this.depth)
      : worlds.reduce((total, world) => total + this.utility(world), 0) /
          worlds.length;
  }

  private draw(world: World) {
    const next = clone(world);
    if (next.cursor >= next.future.length) {
      // Unknown discard order remains exchangeable. A fixed rotation avoids
      // favoring its known top without consuming the game's random source.
      const half = Math.floor(next.discard.length / 2);
      next.future = [
        ...next.discard.slice(half),
        ...next.discard.slice(0, half),
      ];
      next.cursor = 0;
      next.discard = [];
    }
    const card = next.future[next.cursor++];
    if (!card) throw new Error('Empty belief draw');
    return { next, card };
  }

  private ended(world: World) {
    return Object.values(world.faceUp).some((board) => board.every(Boolean));
  }

  private observation(world: World, seat: string) {
    return JSON.stringify([
      this.view.seatOrder.map((s) =>
        world.boards[s]!.map((id, i) =>
          world.faceUp[s]![i]
            ? id
            : s === seat && s === this.seatId
              ? world.privateCards[i]
              : null,
        ),
      ),
      world.discard.at(-1) ?? null,
    ]);
  }

  /** One common decision per information set; no policy sees sampled dark cards. */
  private policy(
    worlds: readonly World[],
    seat: string,
    changes: readonly ((w: World) => World)[],
  ) {
    const rated = changes
      .map((change) => {
        if (this.nodes + worlds.length > this.nodeLimit)
          return { change, score: Infinity };
        this.nodes += worlds.length;
        const next = worlds.map(change);
        const score =
          next.reduce((sum, w) => {
            if (seat === this.seatId) return sum + this.utility(w);
            const visible = w.boards[seat]!.map((id, i) =>
              w.faceUp[seat]![i] ? id : null,
            );
            // Opponents use their public information, not their sampled hidden board.
            const own = preliminaryScore(visible, this.distribution);
            const others = this.view.seatOrder
              .filter((s) => s !== seat)
              .map((s) =>
                preliminaryScore(
                  w.boards[s]!.map((id, i) => (w.faceUp[s]![i] ? id : null)),
                  this.distribution,
                ),
              );
            return (
              sum +
              own +
              (this.ended(w) ? (own > Math.min(...others) ? 90 : -90) : 0)
            );
          }, 0) / worlds.length;
        return { change, score };
      })
      .sort((a, b) => a.score - b.score);
    return Number.isFinite(rated[0]!.score)
      ? worlds.map(rated[0]!.change)
      : [...worlds];
  }

  private futureIncoming(
    worlds: readonly World[],
    seat: string,
    card: string,
    mayDiscard: boolean,
    trigger = true,
  ): World[] {
    if (this.nodes >= this.nodeLimit) return [...worlds];
    if (trigger && card === 'special-team-rocket') {
      const meowth = this.policy(
        worlds,
        seat,
        slots.map((slot) => (w) => replace(w, seat, slot, card).next),
      );
      const pikachu = this.policy(
        worlds,
        seat,
        slots.map((slot) => (w) => this.rocketWorld(w, seat, slot)),
      );
      return [...meowth, ...pikachu].map((w) => ({
        ...w,
        weight: w.weight / 2,
      }));
    }
    if (trigger && card === 'special-mew') {
      const other = this.view.seatOrder.filter((s) => s !== seat);
      const targets = other.flatMap((s) =>
        slots.map((slot) => (w: World) => {
          const result = replace(w, s, slot, card);
          result.next.discard.pop();
          return result.next;
        }),
      );
      const chosen = this.policy(worlds, seat, targets);
      // Acquired card is a newly observable fact. Keep future histories separate.
      const groups = new Map<string, World[]>();
      chosen.forEach((w, i) => {
        const prior = worlds[i]!;
        const target = other
          .flatMap((s) => slots.map((slot) => ({ s, slot })))
          .find((t) => w.boards[t.s]![t.slot] !== prior.boards[t.s]![t.slot]);
        if (!target) {
          const group = groups.get('') ?? [];
          group.push(w);
          groups.set('', group);
          return;
        }
        const revealed = prior.boards[target.s]![target.slot]!;
        const group = groups.get(revealed) ?? [];
        group.push(w);
        groups.set(revealed, group);
      });
      return [...groups].flatMap(([revealed, group]) =>
        revealed
          ? this.futureIncoming(group, seat, revealed, false, false)
          : group,
      );
    }
    const changes = slots.map((slot) => (w: World) => {
      const placed = replace(w, seat, slot, card);
      if (trigger && card === 'special-zapdos') {
        placed.next.discard.pop();
        let next = placed.next,
          held = placed.outgoing;
        const start = this.view.seatOrder.indexOf(seat);
        for (let i = 1; i < this.view.seatOrder.length; i++) {
          const receiver =
            this.view.seatOrder[(start + i) % this.view.seatOrder.length]!;
          const visible = next.boards[receiver]!.map((id, index) =>
            next.faceUp[receiver]![index] ? id : null,
          );
          const choice = bestPreliminaryPlacement(
            visible,
            held,
            this.distribution,
            next.faceUp[receiver]!,
          );
          const r = replace(next, receiver, choice.slot, held);
          next = r.next;
          next.discard.pop();
          held = r.outgoing;
        }
        next.discard.push(held);
        return next;
      }
      return placed.next;
    });
    if (mayDiscard && (!trigger || card !== 'special-zapdos'))
      changes.push((w) => {
        const next = clone(w);
        next.discard.push(card);
        return next;
      });
    let selected = this.policy(worlds, seat, changes);
    if (trigger && card === 'special-snorlax')
      selected = this.policy(selected, seat, [
        (w) => w,
        ...swaps.map(
          ({ a, b }) =>
            (w: World) =>
              swap(w, seat, a, b),
        ),
      ]);
    if (trigger && card === 'special-charizard' && seat === this.seatId) {
      // Legal private information becomes available only after choosing a peek.
      const visible = selected[0]!.faceUp[seat]!;
      const slot = slots.find(
        (i) => !visible[i] && selected[0]!.privateCards[i] === null,
      );
      if (slot !== undefined)
        selected = selected.map((w) => {
          const next = clone(w);
          next.privateCards[slot] = next.boards[seat]![slot]!;
          return next;
        });
    }
    return selected;
  }

  private rollout(input: readonly World[], turns: number) {
    let worlds = input.map(clone);
    const start = this.view.seatOrder.indexOf(this.seatId);
    for (
      let step = 1;
      step <= turns * this.view.seatOrder.length && this.nodes < this.nodeLimit;
      step++
    ) {
      this.check();
      const seat =
        this.view.seatOrder[(start + step) % this.view.seatOrder.length]!;
      const groups = new Map<string, World[]>();
      const finished: World[] = [];
      for (const world of worlds) {
        if (this.ended(world)) {
          finished.push(world);
          continue;
        }
        const key = this.observation(world, seat);
        const group = groups.get(key) ?? [];
        group.push(world);
        groups.set(key, group);
      }
      worlds = finished;
      for (const group of groups.values()) {
        const top = group[0]!.discard.at(-1);
        const visible = group[0]!.boards[seat]!.map((id, i) =>
          group[0]!.faceUp[seat]![i]
            ? id
            : seat === this.seatId
              ? group[0]!.privateCards[i]!
              : null,
        );
        const baseline = preliminaryScore(visible, this.distribution);
        const history =
          this.memory.version === 2
            ? this.memory.history.filter((h) => h.actor === seat)
            : [];
        const discardHabit = history.length
          ? history.filter((h) => h.verb === 'discard').length / history.length
          : 0;
        const preferDiscard =
          top &&
          bestPreliminaryPlacement(
            visible,
            top,
            this.distribution,
            group[0]!.faceUp[seat]!,
          ).score <
            baseline - (1 + discardHabit);
        const draws = new Map<string, World[]>();
        for (const world of group) {
          const drawn = preferDiscard
            ? { next: clone(world), card: top }
            : this.draw(world);
          if (preferDiscard) drawn.next.discard.pop();
          const key = drawn.card!;
          const peers = draws.get(key) ?? [];
          peers.push(drawn.next);
          draws.set(key, peers);
        }
        for (const [card, peers] of draws)
          worlds.push(
            ...this.futureIncoming(peers, seat, card, !preferDiscard),
          );
      }
    }
    return (
      worlds.reduce((sum, w) => sum + this.utility(w) * w.weight, 0) /
      worlds.reduce((sum, w) => sum + w.weight, 0)
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
    let next = clone(world);
    next.discard.pop();
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
      next.discard.pop();
      held = result.outgoing;
    }
    next.discard.unshift(held);
    return next;
  }

  private rocket(worlds: readonly World[], slot: number) {
    return this.mean(
      worlds.map((world) => this.rocketWorld(world, this.view.turnSeat, slot)),
    );
  }

  private rocketWorld(world: World, actor: string, slot: number) {
    const start = this.view.seatOrder.indexOf(actor);
    const order = Array.from(
      { length: this.view.seatOrder.length },
      (_, index) =>
        this.view.seatOrder[(start + index) % this.view.seatOrder.length]!,
    );
    let next = clone(world);
    next.discard.unshift(next.boards[actor]![slot]!, 'special-team-rocket');
    for (const seat of order.slice(1))
      next.discard.unshift(next.boards[seat]![slot]!);
    for (const seat of order) {
      const drawn = this.draw(next);
      next = drawn.next;
      next.boards[seat]![slot] = drawn.card;
      next.faceUp[seat]![slot] = true;
    }
    return next;
  }

  private mew(worlds: readonly World[], target: string, slot: number) {
    const groups = new Map<string, World[]>();
    for (const world of worlds) {
      const { next, outgoing } = replace(world, target, slot, 'special-mew');
      next.discard.pop();
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
      const drawn = this.draw(world);
      const next = drawn.next;
      const incoming = drawn.card;
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
      altered[slot] = this.draw(world).card;
      return before - this.score(altered);
    });
    const mean =
      contributions.reduce((sum, value) => sum + value, 0) /
      contributions.length;
    const variance =
      contributions.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      contributions.length;
    const adjacentDitto = grid
      .horizontalNeighbors(slot)
      .some(
        (neighbor) => this.known[this.seatId]![neighbor] === 'special-ditto',
      );
    return (
      this.mean(this.worlds) -
      0.5 -
      Math.sqrt(variance) * 0.08 -
      (adjacentDitto ? 0.2 : 0)
    );
  }

  choose(
    actions: readonly Action[],
    futureTurns = this.difficulty === 'doubao' ? 1 : 2,
  ) {
    if (this.view.phase === 'initial-flip')
      return (
        actions.find(
          (action) => action.type === 'initial-flip' && action.slot === 1,
        ) ?? actions[0]!
      );
    if (this.view.phase === 'charizard-view') return actions[0]!;
    const evaluate = (action: Action) => {
      this.check();
      let value: number;
      if (action.type === 'draw')
        value =
          action.source === 'deck'
            ? this.drawDeck()
            : this.incoming(
                this.worlds.map((world) => {
                  const next = clone(world);
                  next.discard.pop();
                  return next;
                }),
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
      return value;
    };
    const roots = actions
      .map((action) => ({ action, value: evaluate(action) }))
      .sort((a, b) => a.value - b.value);
    const discard = roots.find((r) => r.action.type === 'discard-held');
    // Replacing an unknown card with a plainly worse ordinary card does not
    // create a usable future advantage. Keep optional/mandatory abilities and
    // winning endings; do not let a noisy short horizon reward blind revelation.
    const ranked = roots.filter(
      (r) =>
        !(
          discard &&
          this.view.held?.categoryId.startsWith('ordinary-') &&
          r.action.type === 'replace' &&
          r.value > discard.value + 1
        ),
    );
    // Every root has a complete baseline. Only the three best receive a bounded
    // horizon; an exhausted search retains its completed baseline evaluations.
    this.depth = futureTurns;
    if (!futureTurns) return ranked[0]!.action;
    for (const candidate of ranked.slice(0, 3)) {
      if (this.nodes >= this.budget) break;
      this.nodeLimit = Math.min(
        this.budget,
        this.nodes + Math.floor(this.budget / 3),
      );
      candidate.value = evaluate(candidate.action);
    }
    return ranked.slice(0, 3).sort((a, b) => a.value - b.value)[0]!.action;
  }
}
