import { card } from '../cards';
import type { View } from '../project';
import type { Action } from '../state';
import { grid } from '../research';
import { copyTableFields, type TableFields } from './table';
import { previewRelay } from './relay';
import { previewRocketPikachu } from './rocket';

export type TacticalModel = TableFields & {
  pool: string[];
  held: string | null;
  discards: string[];
};
type Value = (model: TacticalModel) => number;
type Score = (board: string[], up: boolean[]) => number;

const copy = (model: TacticalModel): TacticalModel => ({
  ...model,
  ...copyTableFields(model),
  pool: [...model.pool],
  discards: [...model.discards],
});
function place(
  model: TacticalModel,
  seat: string,
  slot: number,
  incoming: string,
) {
  const result = copy(model);
  const outgoing = result.boards[seat]![slot]!;
  result.boards[seat]![slot] = incoming;
  result.up[seat]![slot] = true;
  result.held = null;
  result.discards = [outgoing, ...result.discards].slice(0, 2);
  return result;
}
const closed = (model: TacticalModel) =>
  Object.values(model.up).some((up) => up.every(Boolean));

/** Only the sampled table and public choices enter this bounded tactical layer. */
export function createTactics(
  view: View,
  seat: string,
  score: Score,
  value: Value,
  scenario: number,
) {
  const order = (direction = 1) => {
    const start = view.seatOrder.indexOf(view.turnSeat);
    return view.seatOrder.map(
      (_, i) =>
        view.seatOrder[
          (start + i * direction + view.seatOrder.length) %
            view.seatOrder.length
        ]!,
    );
  };
  const ordinary = (
    model: TacticalModel,
    incoming: string,
    allowDiscard: boolean,
  ) => {
    const outcomes = grid.slots.map((slot) =>
      place(model, seat, slot, incoming),
    );
    if (allowDiscard)
      outcomes.push({
        ...copy(model),
        held: null,
        discards: [incoming, ...model.discards].slice(0, 2),
      });
    return Math.min(...outcomes.map(value));
  };
  const arceus = (model: TacticalModel) => {
    const trial = copy(model);
    // Candidates share one legal chance scenario and never consume rule RNG.
    view.seatOrder.forEach((id, i) => {
      trial.up[id] = Array<boolean>(9).fill(false);
      trial.up[id]![(scenario + i * 4) % 9] = true;
    });
    return value(trial);
  };
  const afterPlacement = (model: TacticalModel, incoming: string): number => {
    const ability = card(incoming).ability;
    let best = value(model); // Declining a post-placement ability completes the turn.
    if (ability === 'snorlax') {
      for (let a = 0; a < 9; a++)
        for (let b = a + 1; b < 9; b++) {
          const trial = copy(model);
          [trial.boards[seat]![a], trial.boards[seat]![b]] = [
            trial.boards[seat]![b]!,
            trial.boards[seat]![a]!,
          ];
          [trial.up[seat]![a], trial.up[seat]![b]] = [
            trial.up[seat]![b]!,
            trial.up[seat]![a]!,
          ];
          best = Math.min(best, value(trial));
        }
    }
    if (
      ability === 'groudon' ||
      ability === 'kyogre' ||
      ability === 'rayquaza'
    ) {
      const row =
        grid.rows[ability === 'groudon' ? 2 : ability === 'kyogre' ? 1 : 0]!;
      for (const target of view.seatOrder.filter((id) => id !== seat)) {
        const trial = copy(model);
        for (const i of row) {
          [trial.boards[seat]![i], trial.boards[target]![i]] = [
            trial.boards[target]![i]!,
            trial.boards[seat]![i]!,
          ];
          [trial.up[seat]![i], trial.up[target]![i]] = [
            trial.up[target]![i]!,
            trial.up[seat]![i]!,
          ];
        }
        best = Math.min(best, value(trial));
      }
    }
    if (ability === 'arceus' && !view.arceusUsed) {
      best = Math.min(best, arceus(model));
    }
    if (ability === 'greninja') {
      // A bounded beam keeps the full cover/swap effect without enumerating a
      // second game tree. Rank board changes by the actor's authorized score.
      const contenders: TacticalModel[] = [];
      for (const target of view.seatOrder) {
        const pairs: { a: number; b: number }[] = [];
        for (let a = 0; a < 9; a++)
          for (let b = a + 1; b < 9; b++) pairs.push({ a, b });
        const ranked = pairs
          .map(({ a, b }) => {
            const trial = copy(model);
            trial.up[target]![a] = false;
            trial.up[target]![b] = false;
            return { a, b, trial, value: value(trial) };
          })
          .sort((a, b) => a.value - b.value);
        for (const item of ranked.slice(0, 2)) {
          contenders.push(item.trial);
          const swapped = copy(item.trial);
          [swapped.boards[target]![item.a], swapped.boards[target]![item.b]] = [
            swapped.boards[target]![item.b]!,
            swapped.boards[target]![item.a]!,
          ];
          contenders.push(swapped);
        }
        // Score-improving swaps need not share the best cover-only positions.
        const swaps = pairs
          .map(({ a, b }) => {
            const trial = copy(model);
            trial.up[target]![a] = false;
            trial.up[target]![b] = false;
            [trial.boards[target]![a], trial.boards[target]![b]] = [
              trial.boards[target]![b]!,
              trial.boards[target]![a]!,
            ];
            return {
              trial,
              score: score(trial.boards[target]!, trial.up[target]!),
            };
          })
          .sort((a, b) =>
            target === seat ? a.score - b.score : b.score - a.score,
          );
        contenders.push(...swaps.slice(0, 2).map((item) => item.trial));
      }
      best = Math.min(best, ...contenders.map(value));
    }
    if (ability === 'lucario') {
      // Choose the source before learning the extra deck identity. Average a
      // shared, symmetric four-card chance batch before comparing sources;
      // never pick deck/discard based on one lucky hypothetical top card.
      const last = model.pool.length - 1;
      const third = Math.floor(last / 3);
      const chanceSlots = [...new Set([0, last, third, last - third])].filter(
        (index) => index >= 0 && index < model.pool.length,
      );
      if (chanceSlots.length) {
        const expectedDeck =
          chanceSlots.reduce(
            (sum, index) =>
              sum +
              ordinary(
                {
                  ...copy(model),
                  pool: model.pool.filter((_, i) => i !== index),
                },
                model.pool[index]!,
                true,
              ),
            0,
          ) / chanceSlots.length;
        best = Math.min(best, expectedDeck);
      }
      model.discards.forEach((incoming, index) => {
        best = Math.min(
          best,
          ordinary(
            {
              ...copy(model),
              discards: model.discards.filter((_, i) => i !== index),
            },
            incoming,
            false,
          ),
        );
      });
    }
    // Charizard finishes without another board change; information is valued
    // at its real choice point, after the player can legally select the peek.
    return best;
  };
  const replacement = (
    model: TacticalModel,
    incoming: string,
    allowDiscard: boolean,
    active: boolean,
  ) => {
    const placements = grid.slots.map((slot) => ({
      model: place(model, seat, slot, incoming),
      slot,
    }));
    // All cheap optional chains are expanded for every placement. Greninja's
    // multiplayer pair choices use a bounded placement beam instead.
    const ranked = placements
      .map((item) => ({ ...item, value: value(item.model) }))
      .sort((a, b) => a.value - b.value);
    const expanded =
      card(incoming).ability === 'greninja' ? ranked.slice(0, 2) : ranked;
    let best = active
      ? Math.min(
          ...expanded.map((item) => afterPlacement(item.model, incoming)),
        )
      : ranked[0]!.value;
    if (allowDiscard)
      best = Math.min(
        best,
        value({
          ...copy(model),
          held: null,
          discards: [incoming, ...model.discards].slice(0, 2),
        }) + 0.25,
      );
    return best;
  };
  const mew = (
    model: TacticalModel,
    incoming: string,
    target?: { seat: string; slots: readonly number[] },
  ) => {
    let best = Infinity;
    for (const owner of target
      ? [target.seat]
      : view.seatOrder.filter((id) => id !== seat))
      for (const slot of target ? target.slots : grid.slots) {
        const exchanged = place(model, owner, slot, incoming);
        const acquired = model.boards[owner]![slot]!;
        // The exchanged card is temporarily held, never also in a discard pile.
        exchanged.discards = [...model.discards];
        best = Math.min(best, replacement(exchanged, acquired, false, false));
      }
    return best;
  };
  const draw = (
    original: TacticalModel,
    action: Extract<Action, { type: 'draw' }>,
  ) => {
    const incoming =
      action.source === 'deck'
        ? original.pool.at(-1)
        : original.discards[action.discardIndex];
    if (!incoming) return null;
    const model = copy(original);
    if (action.source === 'deck') model.pool.pop();
    else model.discards.splice(action.discardIndex, 1);
    const ability = card(incoming).ability;
    if (view.phase === 'lucario-draw')
      return (
        replacement(model, incoming, action.source === 'deck', false) + 0.08
      );
    if (ability === 'mew') return mew(model, incoming) + 0.08;
    if (ability === 'mewtwo') {
      // Choose a public target before the private result. Only the subsequent
      // exchange/decline is optimized within this hypothesis after the peek.
      const targets = view.seatOrder.filter((id) => id !== seat);
      const target =
        targets.find((id) => view.winsBySeat[id]! >= 2) ?? targets[0]!;
      const slots = grid.slots
        .filter((i) => !view.boards[target]![i]!.faceUp)
        .slice(0, 2);
      for (const i of grid.slots)
        if (slots.length < 2 && !slots.includes(i)) slots.push(i);
      return (
        Math.min(
          mew(model, incoming, { seat: target, slots }),
          replacement(model, incoming, action.source === 'deck', false),
        ) + 0.08
      );
    }
    if (ability === 'zapdos') {
      let best = Infinity;
      for (const direction of [1, -1])
        for (const slot of grid.slots) {
          const result = previewRelay(
            model,
            order(direction),
            incoming,
            slot,
            score,
          );
          const remainingDiscardCount =
            view.discardCount - (action.source === 'discard' ? 1 : 0);
          const discards =
            remainingDiscardCount <= model.discards.length
              ? [...model.discards, result.discarded].slice(0, 2)
              : model.discards;
          best = Math.min(
            best,
            value({ ...model, ...result, discards, held: null }),
          );
        }
      return best + 0.08;
    }
    if (ability === 'team-rocket') {
      const meowth = replacement(model, incoming, false, false);
      let pikachu = Infinity;
      for (const slot of grid.slots) {
        const result = previewRocketPikachu(model, order(), model.pool, slot);
        const remainingDiscardCount =
          view.discardCount - (action.source === 'discard' ? 1 : 0);
        const discards =
          remainingDiscardCount <= model.discards.length
            ? [
                ...model.discards,
                result.removed[0]!,
                incoming,
                ...result.removed.slice(1),
              ].slice(0, 2)
            : model.discards;
        pikachu = Math.min(
          pikachu,
          value({
            ...model,
            ...result,
            discards,
            pool: model.pool.slice(0, -view.seatOrder.length),
            held: null,
          }),
        );
      }
      return (meowth + pikachu) / 2 + 0.08;
    }
    return replacement(model, incoming, action.source === 'deck', true) + 0.08;
  };
  return {
    draw,
    afterPlacement,
    arceus,
    target: (
      model: TacticalModel,
      target: Extract<Action, { type: 'mewtwo-target' }>,
    ) =>
      model.held
        ? Math.min(
            mew(model, model.held, {
              seat: target.seat,
              slots: [target.a, target.b],
            }),
            replacement(model, model.held, view.drawSource === 'deck', false),
          )
        : null,
  };
}

/** Public one-turn closure threat, using the same sampled identities as the actor. */
export function nextActorRisk(
  view: View,
  seat: string,
  model: TacticalModel,
  score: Score,
) {
  if (closed(model)) return 0;
  const next =
    view.seatOrder[
      (view.seatOrder.indexOf(view.turnSeat) + 1) % view.seatOrder.length
    ]!;
  if (next === seat || model.up[next]!.filter(Boolean).length !== 8) return 0;
  const dark = model.up[next]!.indexOf(false);
  const incoming = [...model.discards, model.pool.at(-1)].filter(
    (id): id is string => id !== undefined,
  );
  let risk = 0;
  for (const id of incoming) {
    // These ordinary/suppressed endings are exact. Active abilities have a
    // separate full-chain model and are not falsely treated as forced closure.
    if (card(id).ability !== null) continue;
    const trial = place(model, next, dark, id);
    const own = score(trial.boards[seat]!, trial.up[seat]!);
    const opponent = score(trial.boards[next]!, trial.up[next]!);
    const minimum = Math.min(
      ...view.seatOrder.map((owner) =>
        score(trial.boards[owner]!, trial.up[owner]!),
      ),
    );
    if (opponent !== minimum) continue;
    if (
      view.winsBySeat[next]! >= 2 &&
      !(own === minimum && view.winsBySeat[seat]! >= 2)
    )
      risk = Math.max(risk, 96);
    else if (own !== minimum) risk = Math.max(risk, 12);
  }
  return risk;
}

/** Value of a private observation before selecting one later legal replacement. */
export function informationValue(
  rows: readonly {
    observable: string;
    revealed: string;
    values: readonly number[];
  }[],
) {
  const policyValue = (withReveal: boolean) => {
    const groups = new Map<string, { sum: number[]; count: number }>();
    for (const row of rows) {
      const key = withReveal
        ? `${row.observable}/${row.revealed}`
        : row.observable;
      const group = groups.get(key) ?? {
        sum: Array<number>(row.values.length).fill(0),
        count: 0,
      };
      row.values.forEach((v, i) => {
        group.sum[i]! += v;
      });
      group.count++;
      groups.set(key, group);
    }
    return (
      [...groups.values()].reduce(
        (sum, group) => sum + Math.min(...group.sum),
        0,
      ) / rows.length
    );
  };
  return rows.length ? Math.max(0, policyValue(false) - policyValue(true)) : 0;
}
