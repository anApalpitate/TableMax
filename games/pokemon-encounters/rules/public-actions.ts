import { original } from '../variants/original';
import { topology } from '../shared/topology';
const grid = topology(original.layout);
import type { PublicAction } from '@tablemax/game-sdk';
import { card, categories } from './cards';
import type { Action } from './index';
import type { State } from './state';

const verbs: PublicAction['verb'][] = [
  'initial-flip',
  'draw',
  'replace',
  'discard',
  'mew-target',
  'rocket-refill',
  'zapdos-pass',
  'swap',
  'peek',
  'close-peek',
  'decline',
  'deal',
  'round-result',
];
export function validPublicAction(input: unknown, seats: readonly string[]) {
  const action = input as PublicAction;
  if (!action || typeof action !== 'object' || Array.isArray(action))
    return false;
  const keys = Object.keys(action).sort().join(',');
  if (
    keys !== 'ability,actor,cardCategory,targets,verb' &&
    keys !== 'ability,actor,cardCategory,source,targets,verb'
  )
    return false;
  if (
    !verbs.includes(action.verb) ||
    (action.actor !== null && !seats.includes(action.actor)) ||
    ![null, ...categories.map((category) => category.categoryId)].includes(
      action.cardCategory,
    ) ||
    ![
      null,
      ...categories
        .filter((category) => category.categoryId.startsWith('special-'))
        .map((category) => category.categoryId),
    ].includes(action.ability)
  )
    return false;
  if (
    action.source !== undefined &&
    (action.verb !== 'draw' || !['deck', 'discard'].includes(action.source))
  )
    return false;
  if (
    !Array.isArray(action.targets) ||
    action.targets.length > seats.length ||
    new Set(action.targets.map((target) => target?.seat)).size !==
      action.targets.length
  )
    return false;
  if (
    action.targets.some(
      (target) =>
        !target ||
        typeof target !== 'object' ||
        Object.keys(target).sort().join(',') !== 'seat,slots' ||
        !seats.includes(target.seat) ||
        !Array.isArray(target.slots) ||
        target.slots.length > grid.count ||
        new Set(target.slots).size !== target.slots.length ||
        target.slots.some(
          (slot) => !Number.isInteger(slot) || slot < 0 || slot >= grid.count,
        ),
    )
  )
    return false;
  if (action.verb === 'peek' || action.verb === 'close-peek')
    return (
      action.actor !== null &&
      action.cardCategory === 'special-charizard' &&
      action.ability === 'special-charizard' &&
      action.targets.length === 1 &&
      action.targets[0]!.seat === action.actor &&
      action.targets[0]!.slots.length === 0
    );
  return ['deal', 'round-result'].includes(action.verb)
    ? action.actor === null
    : action.actor !== null;
}

export function announceAction(
  before: State,
  after: State,
  action: Action,
  seat: string,
): PublicAction {
  const targets: PublicAction['targets'] = [];
  let verb: PublicAction['verb'];
  let category: string | null = before.held
    ? card(before.held).categoryId
    : null;
  let ability: string | null = null;
  if (['mew-other', 'mew-self'].includes(before.phase)) ability = 'special-mew';
  else if (['rocket-meowth', 'rocket-pikachu'].includes(before.phase))
    ability = 'special-team-rocket';
  else if (['zapdos-self', 'zapdos-receive'].includes(before.phase))
    ability = 'special-zapdos';
  else if (before.phase === 'snorlax-choice') ability = 'special-snorlax';
  else if (['charizard-choice', 'charizard-view'].includes(before.phase))
    ability = 'special-charizard';
  switch (action.type) {
    case 'initial-flip':
      verb = 'initial-flip';
      category = card(after.boards[seat]![action.slot]!.instanceId).categoryId;
      targets.push({ seat, slots: [action.slot] });
      break;
    case 'draw':
      verb = 'draw';
      category = card(after.held!).categoryId;
      ability = [
        'special-mew',
        'special-team-rocket',
        'special-zapdos',
        'special-snorlax',
        'special-charizard',
      ].includes(category)
        ? category
        : null;
      return {
        actor: seat,
        verb,
        cardCategory: category,
        ability,
        source: action.source,
        targets,
      };
    case 'replace':
      verb =
        before.phase === 'rocket-pikachu'
          ? 'rocket-refill'
          : ['zapdos-self', 'zapdos-receive'].includes(before.phase)
            ? 'zapdos-pass'
            : 'replace';
      if (before.phase === 'rocket-pikachu')
        for (const target of before.seatOrder)
          targets.push({ seat: target, slots: [action.slot] });
      else targets.push({ seat, slots: [action.slot] });
      if (
        before.phase === 'place' &&
        ['special-snorlax', 'special-charizard'].includes(category!)
      )
        ability = category;
      break;
    case 'mew-target':
      verb = 'mew-target';
      targets.push({ seat: action.seat, slots: [action.slot] });
      break;
    case 'swap':
      verb = 'swap';
      category = ability;
      targets.push({ seat, slots: [action.a, action.b] });
      break;
    case 'peek':
    case 'close-peek':
      verb = action.type;
      category = ability;
      targets.push({ seat, slots: [] });
      break;
    case 'decline-ability':
      verb = 'decline';
      category = ability;
      break;
    case 'discard-held':
      verb = 'discard';
      break;
    default:
      throw new Error('Unsupported public action');
  }
  return { actor: seat, verb, cardCategory: category, ability, targets };
}
