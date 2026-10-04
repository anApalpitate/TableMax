import type {
  GameRules,
  JsonValue,
  PendingDecision,
  RuleContext,
} from '../../../packages/game-sdk/src';
import { accepts, PLANT_IDS, RESOURCES, RULES_VERSION } from '../data/catalog';
import { price, settingsFor } from '../data/economy';
import { CITIES, isConnectedRegions, REGIONS } from '../data/germany';
import type { Action, Resource } from '../types';
import { applyAction, buildOptions, canStore, initialize } from './engine';
import type { State } from './model';
import { runChoices } from './production';
import { project } from './project';
import { validateState } from './state';
export type { State } from './model';
export type { Action } from '../types';
export { validateState, initialize };

const integer = (v: unknown, min = 0): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min;
export function validateAction(input: unknown): Action {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('电力公司动作无效。');
  const a = input as Record<string, unknown>,
    keys = Object.keys(a).sort().join(',');
  const plant = (id: unknown): id is number =>
    integer(id, 3) && PLANT_IDS.includes(id);
  const resource = (id: unknown): id is Resource =>
    RESOURCES.includes(id as Resource);
  if (
    a.type === 'select-regions' &&
    keys === 'regions,type' &&
    Array.isArray(a.regions) &&
    a.regions.every(
      (r) => typeof r === 'string' && REGIONS.some((entry) => entry.id === r),
    ) &&
    new Set(a.regions).size === a.regions.length
  ) {
    const selected = a.regions as string[];
    return {
      type: 'select-regions',
      regions: REGIONS.map((r) => r.id).filter((r) => selected.includes(r)),
    };
  }
  if (
    a.type === 'offer' &&
    keys === 'amount,plantId,type' &&
    plant(a.plantId) &&
    integer(a.amount, a.plantId)
  )
    return { type: 'offer', plantId: a.plantId, amount: a.amount };
  if (a.type === 'bid' && keys === 'amount,type' && integer(a.amount, 1))
    return { type: 'bid', amount: a.amount };
  if (a.type === 'discard-plant' && keys === 'plantId,type' && plant(a.plantId))
    return { type: 'discard-plant', plantId: a.plantId };
  if (
    ['salvage', 'buy-resource'].includes(a.type as string) &&
    keys === 'plantId,resource,type' &&
    plant(a.plantId) &&
    resource(a.resource)
  )
    return {
      type: a.type as 'salvage' | 'buy-resource',
      plantId: a.plantId,
      resource: a.resource,
    };
  if (
    a.type === 'discard-salvage' &&
    keys === 'resource,type' &&
    resource(a.resource)
  )
    return { type: 'discard-salvage', resource: a.resource };
  if (
    a.type === 'transfer' &&
    keys === 'fromPlantId,resource,toPlantId,type' &&
    plant(a.fromPlantId) &&
    plant(a.toPlantId) &&
    a.fromPlantId !== a.toPlantId &&
    resource(a.resource)
  )
    return {
      type: 'transfer',
      resource: a.resource,
      fromPlantId: a.fromPlantId,
      toPlantId: a.toPlantId,
    };
  if (
    a.type === 'swap-resources' &&
    keys === 'fromPlantId,otherResource,resource,toPlantId,type' &&
    plant(a.fromPlantId) &&
    plant(a.toPlantId) &&
    a.fromPlantId !== a.toPlantId &&
    resource(a.resource) &&
    resource(a.otherResource) &&
    a.resource !== a.otherResource
  )
    return {
      type: 'swap-resources',
      resource: a.resource,
      otherResource: a.otherResource,
      fromPlantId: a.fromPlantId,
      toPlantId: a.toPlantId,
    };
  if (
    a.type === 'build' &&
    keys === 'cityId,type' &&
    typeof a.cityId === 'string' &&
    CITIES.some((city) => city.id === a.cityId)
  )
    return { type: 'build', cityId: a.cityId };
  if (
    a.type === 'run' &&
    keys === 'coal,plantId,type' &&
    plant(a.plantId) &&
    integer(a.coal) &&
    a.coal <= 3
  )
    return { type: 'run', plantId: a.plantId, coal: a.coal };
  if (
    a.type === 'finish' &&
    keys === 'cities,type' &&
    integer(a.cities) &&
    a.cities <= 42
  )
    return { type: 'finish', cities: a.cities };
  if (keys === 'type' && (a.type === 'pass' || a.type === 'finish'))
    return { type: a.type };
  throw new Error('电力公司动作无效。');
}
export function regionChoices(count: number): string[][] {
  const ids = REGIONS.map((r) => r.id),
    choices: string[][] = [];
  function choose(index: number, current: string[]) {
    if (current.length === count) {
      if (isConnectedRegions(current)) choices.push([...current]);
      return;
    }
    for (let i = index; i < ids.length; i++)
      choose(i + 1, [...current, ids[i]!]);
  }
  choose(0, []);
  return choices;
}
export function decisions(s: State): PendingDecision[] {
  return s.actor
    ? [
        {
          id: `pg:${s.round}:${s.actionSerial}:${s.phase}:${s.actor}`,
          seatId: s.actor,
        },
      ]
    : [];
}
function rawLegalActions(s: State, seat: string): Action[] {
  if (s.actor !== seat || s.phase === 'ended') return [];
  const p = s.players[seat]!,
    cash = p.cash;
  if (s.phase === 'regions')
    return regionChoices(settingsFor(s.seatOrder.length).regions).map(
      (regions) => ({ type: 'select-regions', regions }),
    );
  const transfers: Action[] = [];
  for (const from of p.plants)
    for (const resource of RESOURCES) {
      if (from.resources[resource] === 0) continue;
      for (const to of p.plants) {
        if (from.id === to.id) continue;
        if (canStore(s, seat, to.id, resource))
          transfers.push({
            type: 'transfer',
            resource,
            fromPlantId: from.id,
            toPlantId: to.id,
          });
        if (from.id < to.id && accepts(to.id, resource))
          for (const otherResource of RESOURCES) {
            if (
              otherResource !== resource &&
              to.resources[otherResource] > 0 &&
              accepts(from.id, otherResource)
            )
              transfers.push({
                type: 'swap-resources',
                resource,
                otherResource,
                fromPlantId: from.id,
                toPlantId: to.id,
              });
          }
      }
    }
  if (s.phase === 'offer')
    return [
      ...(s.round === 1 ? [] : [{ type: 'pass' as const }]),
      ...(s.step === 3 ? s.market : s.market.slice(0, 4))
        .filter((id) => id !== 0 && id <= cash)
        .flatMap((plantId) =>
          Array.from({ length: cash - plantId + 1 }, (_, i) => ({
            type: 'offer' as const,
            plantId,
            amount: plantId + i,
          })),
        ),
      ...transfers,
    ];
  if (s.phase === 'auction')
    return [
      { type: 'pass' },
      ...Array.from(
        { length: Math.max(0, cash - s.auction!.amount) },
        (_, i) => ({ type: 'bid' as const, amount: s.auction!.amount + i + 1 }),
      ),
      ...transfers,
    ];
  if (s.phase === 'replace') {
    const r = s.replacement!;
    if (r.removedPlantId === null)
      return [
        ...r.oldPlantIds.map((plantId): Action => ({
          type: 'discard-plant',
          plantId,
        })),
        ...transfers,
      ];
    return [
      ...RESOURCES.filter((resource) => r.salvage[resource] > 0).flatMap(
        (resource): Action[] => [
          { type: 'discard-salvage', resource },
          ...p.plants
            .filter((plant) => canStore(s, seat, plant.id, resource))
            .map((plant) => ({
              type: 'salvage' as const,
              resource,
              plantId: plant.id,
            })),
        ],
      ),
      ...transfers,
    ];
  }
  const actions: Action[] = [...transfers];
  // Rearranging has a decision boundary and never changes another player's turn.
  if (s.phase === 'resources') {
    for (const resource of RESOURCES) {
      const cost = price(resource, s.resources[resource]);
      if (cost === null || cost > cash) continue;
      for (const plant of p.plants)
        if (canStore(s, seat, plant.id, resource))
          actions.push({ type: 'buy-resource', resource, plantId: plant.id });
    }
    actions.push({ type: 'finish' });
  } else if (s.phase === 'building') {
    actions.push(
      ...buildOptions(s, seat)
        .filter((option) => option.cost <= cash)
        .map((option) => ({ type: 'build' as const, cityId: option.cityId })),
      { type: 'finish' },
    );
  } else if (s.phase === 'powering') {
    for (const plant of p.plants)
      if (!p.ran.includes(plant.id))
        for (const coal of runChoices(plant))
          actions.push({ type: 'run', plantId: plant.id, coal });
    for (
      let cities = 0;
      cities <= Math.min(p.cities.length, p.produced);
      cities++
    )
      actions.push({ type: 'finish', cities });
  }
  return actions;
}
export function legalActions(s: State, seat: string): Action[] {
  return rawLegalActions(s, seat).map(validateAction);
}
function verifyContext(s: State, context: RuleContext) {
  if (JSON.stringify(s.seatOrder) !== JSON.stringify(context.seats))
    throw new Error('电力公司座位不一致。');
}
export const rules: GameRules = {
  manifest: {
    id: 'power-grid',
    name: '电力公司',
    gameVersion: '1.0.1',
    rulesVersion: RULES_VERSION,
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 6 },
    assetNamespace: 'power-grid',
  },
  initialize: initialize as GameRules['initialize'],
  validateState: validateState as GameRules['validateState'],
  decisions: (s) => decisions(s as State),
  ended: (s) => (s as State).phase === 'ended',
  validateAction,
  legalActions: (s, seat) => legalActions(s as State, seat),
  lifecycleActions: () => [],
  applyLifecycle() {
    throw new Error('电力公司当前没有下一小局动作。');
  },
  apply(input, inputAction, seat, context) {
    const before = input as State;
    verifyContext(before, context);
    const action = validateAction(inputAction);
    if (
      !legalActions(before, seat).some(
        (legal) =>
          JSON.stringify(validateAction(legal)) === JSON.stringify(action),
      )
    )
      throw new Error('当前不能执行此电力公司动作。');
    const state = structuredClone(before);
    state.actionSerial++;
    applyAction(state, action, context);
    return {
      state: state as JsonValue,
      decision: {
        label: `座位 ${before.seatOrder.indexOf(seat) + 1} ${action.type}之前`,
        revealedInformation: [
          'select-regions',
          'offer',
          'bid',
          'build',
          'discard-plant',
        ].includes(action.type),
        roundNumber: before.round,
      },
      events: state.history
        .filter((entry) => Number(entry.id.slice(3)) > before.logSerial)
        .map((entry) => ({
          kind: entry.verb === 'end' ? 'game-ended' : 'effect-complete',
          text: entry.text,
          action: {
            actor: entry.actor,
            verb: entry.verb,
            cardCategory:
              entry.plantId === null ? null : `${entry.plantId}号电厂`,
            ability: null,
            targets: [],
          },
        })),
    };
  },
  project: (s, viewer) => project(s as State, viewer) as JsonValue,
};
