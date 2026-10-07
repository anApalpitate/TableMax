import {
  cardDefinitions,
  deckProfiles,
  legacyDeckProfiles,
} from './config/card-data';
import type {
  Ability,
  CategoryPresentation,
  RulesProfile,
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
}));
const definitions = new Map(categories.map((c) => [c.categoryId, c]));
const presentations = new Map(
  cardDefinitions.map((c) => [c.categoryId, c.presentation]),
);

/** Browser-independent metadata; no asset paths or hidden state are involved. */
export function categoryPresentation(categoryId: string): CategoryPresentation {
  const found = presentations.get(categoryId);
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
    rulesProfile === 'legacy' ? legacyDeckProfiles : deckProfiles
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
]);
const profileInstances: Record<RulesProfile, Set<string>> = {
  legacy: new Set(instancesForSeats(6, 'legacy')),
  'research-buffer-v2': new Set(instancesForSeats(6)),
};
export const validProfileInstance = (instance: string, profile: RulesProfile) =>
  profileInstances[profile].has(instance);
export const legacyCategories: Category[] = categories.map((c) => ({
  ...c,
  small: legacyDeckProfiles[0]!.counts[c.categoryId]!,
  standard: legacyDeckProfiles[1]!.counts[c.categoryId]!,
}));
export function card(instance: string): Category {
  if (!instances.has(instance)) throw new Error('Invalid expansion card');
  return definitions.get(instance.split('#')[0]!)!;
}
export const numeric = (instance: string) => card(instance).value;
export const abilityText: Record<Ability, string> = Object.fromEntries(
  cardDefinitions
    .filter((c) => c.ability !== null)
    .map((c) => [c.ability, c.abilityText]),
) as Record<Ability, string>;
