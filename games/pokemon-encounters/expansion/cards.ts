import {
  cardDefinitions,
  deckProfiles,
  legacyDeckProfiles,
  eventsCardDefinitions,
  eventsDeckProfiles,
} from './config/card-data';
import type {
  Ability,
  CategoryPresentation,
  RulesProfile,
  PokemonType,
} from './config/types';
export type { Ability, CategoryPresentation } from './config/types';

export type Category = {
  categoryId: string;
  name: string;
  value: number | null;
  small: number;
  standard: number;
  ability: Ability | null;
  copy: 'horizontal' | 'vertical' | null;
  types: readonly PokemonType[];
};
export type Card = Category;
const attributes: Record<string, readonly PokemonType[]> = {
  'ordinary--2': ['electric'],
  'ordinary-0': ['normal', 'fairy'],
  'ordinary-1': ['normal'],
  'ordinary-3': ['grass', 'poison'],
  'ordinary-4': ['water'],
  'ordinary-5': ['fire'],
  'ordinary-6': ['water', 'psychic'],
  'ordinary-7': ['ghost', 'poison'],
  'ordinary-8': ['psychic', 'fairy'],
  'ordinary-9': ['rock', 'ground'],
  'ordinary-togepi': ['fairy'],
  'ordinary-magikarp': ['water'],
  'ordinary-piplup': ['water'],
  'ordinary-rowlet': ['grass', 'flying'],
  'ordinary-psyduck': ['water'],
  'ordinary-garchomp': ['dragon', 'ground'],
  'ordinary-gardevoir': ['psychic', 'fairy'],
  'ordinary-dragonite': ['dragon', 'flying'],
  'ordinary-metagross': ['steel', 'psychic'],
  'ordinary-mimikyu': ['ghost', 'fairy'],
  'special-mew': ['psychic'],
  'special-team-rocket': ['normal'],
  'special-zapdos': ['electric', 'flying'],
  'special-charizard': ['fire', 'flying'],
  'special-snorlax': ['normal'],
  'special-ditto': ['normal'],
  'special-mewtwo': ['psychic'],
  'special-arceus': ['normal'],
  'special-greninja': ['water', 'dark'],
  'special-lucario': ['fighting', 'steel'],
  'special-groudon': ['ground'],
  'special-kyogre': ['water'],
  'special-rayquaza': ['dragon', 'flying'],
  'special-zorua': ['dark'],
};
const small = deckProfiles.find((p) => p.id === 'small')!;
const standard = deckProfiles.find((p) => p.id === 'standard')!;

/** Stable category order and the compatibility shape are retained. */
export const categories: Category[] = cardDefinitions.map((c) => ({
  categoryId: c.categoryId,
  name: c.name,
  value: c.value,
  small: small.counts[c.categoryId]!,
  standard: standard.counts[c.categoryId]!,
  ability: c.ability,
  copy: c.copy,
  types: attributes[c.categoryId]!,
}));
export const eventsCategories: Category[] = eventsCardDefinitions.map((c) => ({
  categoryId: c.categoryId,
  name: c.name,
  value: c.value,
  small: eventsDeckProfiles[0]!.counts[c.categoryId]!,
  standard: eventsDeckProfiles[1]!.counts[c.categoryId]!,
  ability: c.ability,
  copy: c.copy,
  types: attributes[c.categoryId]!,
}));
const eventsDefinitions = new Map(
  eventsCategories.map((c) => [c.categoryId, c]),
);
export const categoriesForProfile = (
  profile: RulesProfile = 'research-buffer-v2',
) =>
  profile === 'events-research-v3'
    ? eventsCategories
    : profile === 'legacy'
      ? legacyCategories
      : categories;
const definitions = new Map(categories.map((c) => [c.categoryId, c]));
const presentations = new Map(
  cardDefinitions.map((c) => [c.categoryId, c.presentation]),
);

/** Browser-independent metadata; no asset paths or hidden state are involved. */
export function categoryPresentation(
  categoryId: string,
  profile: RulesProfile = 'research-buffer-v2',
): CategoryPresentation {
  const found =
    profile === 'events-research-v3'
      ? eventsCardDefinitions.find((c) => c.categoryId === categoryId)
          ?.presentation
      : presentations.get(categoryId);
  if (!found) throw new Error('Invalid expansion category');
  return { ...found };
}

export const instancesForSeats = (
  seats: number,
  rulesProfile: RulesProfile = 'research-buffer-v2',
) => {
  if (!Number.isInteger(seats) || seats < 2 || seats > 6)
    throw new Error('Invalid expansion seats');
  const profile = (
    rulesProfile === 'events-research-v3'
      ? eventsDeckProfiles
      : rulesProfile === 'legacy'
        ? legacyDeckProfiles
        : deckProfiles
  ).find((p) => seats >= p.minSeats && seats <= p.maxSeats)!;
  return categories.flatMap((c) =>
    Array.from(
      { length: profile.counts[c.categoryId]! },
      (_, i) => `${c.categoryId}#${String(i + 1).padStart(2, '0')}`,
    ),
  );
};
const instances = new Set([
  ...instancesForSeats(2),
  ...instancesForSeats(6),
  ...instancesForSeats(2, 'legacy'),
  ...instancesForSeats(6, 'legacy'),
  ...instancesForSeats(6, 'events-research-v3'),
]);
const profileInstances: Record<RulesProfile, Set<string>> = {
  legacy: new Set(instancesForSeats(6, 'legacy')),
  'research-buffer-v2': new Set(instancesForSeats(6)),
  'events-research-v3': new Set(instancesForSeats(6, 'events-research-v3')),
};
export const validProfileInstance = (instance: string, profile: RulesProfile) =>
  profileInstances[profile].has(instance);
export const legacyCategories: Category[] = categories.map((c) => ({
  ...c,
  small: legacyDeckProfiles[0]!.counts[c.categoryId]!,
  standard: legacyDeckProfiles[1]!.counts[c.categoryId]!,
}));
export function category(
  categoryId: string,
  profile: RulesProfile = 'research-buffer-v2',
): Category {
  const found = (
    profile === 'events-research-v3' ? eventsDefinitions : definitions
  ).get(categoryId);
  if (!found) throw new Error('Invalid expansion category');
  return found;
}
export function card(
  instance: string,
  profile: RulesProfile = 'research-buffer-v2',
): Category {
  if (!instances.has(instance)) throw new Error('Invalid expansion card');
  return category(instance.split('#')[0]!, profile);
}
export const numeric = (instance: string) => card(instance).value;
export const abilityText: Record<Ability, string> = Object.fromEntries(
  cardDefinitions
    .filter((c) => c.ability !== null)
    .map((c) => [c.ability, c.abilityText]),
) as Record<Ability, string>;
export const abilityTextForProfile = (profile: RulesProfile) =>
  profile === 'events-research-v3'
    ? (Object.fromEntries(
        eventsCardDefinitions
          .filter((c) => c.ability !== null)
          .map((c) => [c.ability, c.abilityText]),
      ) as Record<Ability, string>)
    : abilityText;
