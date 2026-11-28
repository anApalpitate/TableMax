import type {
  BotStrategy,
  JsonValue,
} from '../../../packages/game-sdk/src/index';
import type {
  Action as AvalonAction,
  AvalonView,
} from '../../../games/avalon/types';
import type {
  Action as ManilaAction,
  ManilaView,
} from '../../../games/manila/rules/view';
import { evaluateJuewu } from '../../../games/manila/bot/juewu';
import type { Action as OriginalAction } from '../../../games/pokemon-encounters/rules';
import type { PokemonView } from '../../../games/pokemon-encounters/rules/project';
import type { Action as ExpansionAction } from '../../../games/pokemon-encounters/expansion/state';
import type { View as ExpansionView } from '../../../games/pokemon-encounters/expansion/project';
import type {
  Action as GridAction,
  PowerGridView,
} from '../../../games/power-grid/types';
import { forecast } from '../../../games/power-grid/bot/planner';
import { maximumProduction } from '../../../games/power-grid/rules/production';
import type {
  Action as RackAction,
  RummikubView,
} from '../../../games/rummikub/types';
import { planTurn } from '../../../games/rummikub/bot/planner';
import {
  decisionLearningPilots,
  type DecisionLearningPilot,
} from './decision-learning-pilots';

export type LearningInput = Pick<
  Parameters<BotStrategy['decide']>[0],
  'view' | 'actions' | 'decision' | 'signal'
>;

function kind(action: JsonValue) {
  return action && typeof action === 'object' && !Array.isArray(action)
    ? String(action.type)
    : '';
}

function pilot<View, Action>(
  base: DecisionLearningPilot,
  feature: (
    view: View,
    action: Action,
    seat: string,
    previous: readonly number[] | null,
  ) => readonly number[] | null,
  rank?: (view: View, action: Action, features: readonly number[]) => number,
  shortlist?: (
    view: View,
    baseline: Action,
    actions: Action[],
    signal: AbortSignal,
  ) => Action[],
  stratum?: (view: View) => string,
) {
  const features = (input: LearningInput, action: JsonValue) =>
    feature(
      input.view as View,
      action as Action,
      input.decision.seatId,
      base.features(input.view, action, input.decision.seatId),
    );
  return {
    ...base,
    encoder: base.encoder.replace(/-v1$/, '-v2'),
    hasPrior: rank !== undefined,
    features,
    stratum: (input: LearningInput) => stratum?.(input.view as View) ?? 'all',
    rank: (input: LearningInput, action: JsonValue, row: readonly number[]) =>
      rank?.(input.view as View, action as Action, row) ?? 0,
    shortlist(input: LearningInput, baseline: JsonValue): JsonValue[] {
      return (shortlist?.(
        input.view as View,
        baseline as Action,
        [...input.actions] as Action[],
        input.signal,
      ) ?? input.actions) as JsonValue[];
    },
  };
}

const lead = (scores: Record<string, number>, seat: string) =>
  Math.max(
    ...Object.entries(scores)
      .filter(([id]) => id !== seat)
      .map(([, score]) => score),
  ) - scores[seat]!;

export const decisionLearningV2Pilots = {
  manila: pilot<ManilaView, ManilaAction>(
    decisionLearningPilots.manila,
    (view, action, seat, previous) => {
      if (
        view.self?.seatId !== seat ||
        view.turnSeat !== seat ||
        view.phase !== 'place'
      )
        return null;
      if (!previous && action.type !== 'pass') return null;
      const place = Number(action.type === 'place');
      return [
        ...(previous ?? Array<number>(11).fill(0)),
        1 - place,
        (place * view.placementRound) / 4,
        (place * Math.min(view.self.cash, 40)) / 40,
        (place * view.players[seat]!.availableWorkers) / 4,
        (place * Math.min(view.voyage, 12)) / 12,
      ];
    },
    (view, action) => evaluateJuewu(view, action),
    undefined,
    (view) => (view.placementRound < 2 ? 'early' : 'late'),
  ),
  avalon: pilot<AvalonView, AvalonAction>(
    decisionLearningPilots.avalon,
    (view, action, seat, previous) => {
      if (!previous || action.type !== 'vote-team') return null;
      const approve = Number(action.vote === 'approve');
      const evil = Number(view.self?.alignment === 'evil');
      return [
        ...previous,
        (approve * evil * view.failCount) / 3,
        (approve * (1 - evil) * view.successCount) / 3,
        approve * Number(view.rejectedTeams >= 3),
        approve * evil * Number(view.team.includes(seat)),
      ];
    },
    undefined,
    undefined,
    (view) =>
      `${view.self?.alignment}/${view.rejectedTeams >= 3 ? 'pressure' : 'normal'}`,
  ),
  'pokemon-original': pilot<PokemonView, OriginalAction>(
    decisionLearningPilots['pokemon-original'],
    (view, action, seat, previous) => {
      if (!previous || action.type !== 'draw') return null;
      const take = Number(action.source === 'discard');
      const target = view.discardTop;
      const board = view.boards[seat]!;
      const visible = board.flatMap(({ card }) =>
        card?.value == null ? [] : [card.value],
      );
      return [
        ...previous,
        (take * lead(view.winsBySeat, seat)) / 3,
        take * Number(Boolean(target?.ability)),
        (take *
          (visible.length ? Math.max(...visible) - (target?.value ?? 0) : 0)) /
          20,
      ];
    },
    (view, action) =>
      action.type === 'draw' && action.source === 'discard'
        ? 2 - (view.discardTop?.value ?? 6)
        : 0,
    undefined,
    (view) => (view.deckCount > 24 ? 'early' : 'late'),
  ),
  'pokemon-expansion': pilot<ExpansionView, ExpansionAction>(
    decisionLearningPilots['pokemon-expansion'],
    (view, action, seat, previous) => {
      if (!previous || action.type !== 'draw') return null;
      const card =
        action.source === 'discard'
          ? view.discardOptions[action.discardIndex]
          : undefined;
      if (action.source === 'discard' && !card) return null;
      const take = Number(Boolean(card));
      const matches = card
        ? view.boards[seat]!.filter(
            ({ card: member }) => member && member.value === card.value,
          ).length
        : 0;
      return [
        ...previous,
        (take * lead(view.winsBySeat, seat)) / 3,
        (take * view.activeResearch.length) / 2,
        Number(Boolean(card?.ability) && !card?.abilityUsed),
        Number(Boolean(card?.copy)),
        (card?.scoreEffect?.delta ?? 0) / 10,
        matches / 9,
        Number(action.source === 'discard' && action.discardIndex === 1),
      ];
    },
    (view, action) =>
      action.type === 'draw' && action.source === 'discard'
        ? 2 - (view.discardOptions[action.discardIndex]?.value ?? 6)
        : 0,
    (view, baseline, actions) =>
      actions.filter((action) => {
        if (action.type !== 'draw' || baseline.type !== 'draw') return false;
        const pairs = [action, baseline].flatMap((draw) =>
          draw.source === 'discard'
            ? [view.discardOptions[draw.discardIndex]]
            : [],
        );
        return (
          pairs.some(
            (card) =>
              card &&
              (card.ability ||
                card.copy ||
                (card.value !== null && card.value <= 2)),
          ) || view.activeResearch.length > 1
        );
      }),
  ),
  'power-grid': pilot<PowerGridView, GridAction>(
    decisionLearningPilots['power-grid'],
    (view, action, seat, previous) => {
      if (!previous || action.type !== 'build') return null;
      const position = view.players[seat]!;
      const cost = view.buildOptions.find(
        (option) => option.cityId === action.cityId,
      )!.cost;
      const supply = maximumProduction(position.plants);
      const rival = Math.max(
        ...Object.entries(view.players)
          .filter(([id]) => id !== seat)
          .map(([, player]) => player.cities.length),
      );
      return [
        ...previous,
        (view.self!.cash - cost) / 100,
        (Math.min(supply, position.cities.length + 1) / 20) *
          (1 - cost / Math.max(view.self!.cash, 1)),
        ((rival / view.endThreshold) * cost) / 30,
      ];
    },
    undefined,
    (view, baseline, actions, signal) => {
      if (baseline.type !== 'build' || !view.self) return [];
      let cities: readonly string[] = [];
      forecast(
        view,
        view.players[view.self.seatId]!.plants,
        view.self.cash,
        1,
        signal,
        1000,
        (plans) => {
          cities = plans;
        },
      );
      return cities.flatMap((city) =>
        actions.filter(
          (action) => action.type === 'build' && action.cityId === city,
        ),
      );
    },
  ),
  rummikub: pilot<RummikubView, RackAction>(
    decisionLearningPilots.rummikub,
    (view, action, _seat, previous) => {
      if (!previous || action.type !== 'submit-turn') return null;
      const own = view.self!;
      const placed = new Set(
        action.table.flatMap(({ tiles }) => tiles.map(({ tileId }) => tileId)),
      );
      const remaining = own.rack.filter(({ id }) => !placed.has(id));
      const pairs = remaining.reduce(
        (sum, tile, index) =>
          sum +
          remaining
            .slice(index + 1)
            .filter(
              (other) =>
                tile.value === other.value && !tile.joker && !other.joker,
            ).length,
        0,
      );
      return [
        ...previous,
        remaining.length / 24,
        pairs / 12,
        remaining.filter(({ joker }) => joker).length / 2,
      ];
    },
    (_view, _action, row) => row[1]! - row[3]! / 4,
    (view, baseline, actions, signal) => {
      if (baseline.type !== 'submit-turn') return actions;
      const alternate = planTurn(view, 'doubao', signal).action;
      return alternate ? [...actions, alternate] : actions;
    },
  ),
};

export type LearningV2Pilot =
  (typeof decisionLearningV2Pilots)[keyof typeof decisionLearningV2Pilots];

export function learningV2Candidates(
  pilot: LearningV2Pilot,
  input: LearningInput,
  baseline: JsonValue,
) {
  const reference = pilot.features(input, baseline);
  if (!reference) return null;
  const referenceRank = pilot.rank(input, baseline, reference);
  const unique = new Set<string>([JSON.stringify(baseline)]);
  const available = pilot.shortlist(input, baseline).flatMap((action) => {
    const key = JSON.stringify(action);
    if (unique.has(key)) return [];
    unique.add(key);
    const row = pilot.features(input, action);
    if (!row) return [];
    const features = reference.map((value, index) => row[index]! - value);
    if (!features.every(Number.isFinite))
      throw new Error('Invalid candidate features');
    const distance = features.reduce((sum, value) => sum + Math.abs(value), 0);
    if (distance === 0) return [];
    return [
      {
        action,
        features,
        prior: pilot.rank(input, action, row) - referenceRank,
        distance,
        kind: kind(action),
      },
    ];
  });
  const byPrior = (
    a: (typeof available)[number],
    b: (typeof available)[number],
  ) => b.prior - a.prior || a.distance - b.distance;
  const prioritized = available.sort(byPrior);
  const distinct = prioritized.find(
    (candidate) => candidate.kind !== kind(baseline),
  );
  if (!distinct) return prioritized.slice(0, 3);
  return [
    distinct,
    ...prioritized.filter((candidate) => candidate !== distinct).slice(0, 2),
  ];
}
