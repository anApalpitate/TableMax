export type TableFields = {
  boards: Record<string, string[]>;
  up: Record<string, boolean[]>;
};

/** Synthetic identities only, derived from authorized faces and memory. */
export type AbilityKnowledge = {
  usedAbilityIds?: readonly string[];
  cardDefinitions?: ResolvedCardDefinitions;
  weather?: Weather | null;
  rulesProfile?: RulesProfile;
};
/** Final-score estimates resolve only synthetic authorized hypotheses, never server state. */
export function modelCardDefinitions(
  board: readonly string[],
  profile: RulesProfile,
  definitions?: ResolvedCardDefinitions,
  weather: Weather | null = null,
): ResolvedCardDefinitions {
  return Object.fromEntries(
    board.map((id) => {
      const printed: Card = definitions?.[id] ?? card(id, profile);
      return [
        id,
        {
          ...printed,
          value:
            printed.value === null
              ? null
              : printed.value + weatherDelta(printed, weather),
        },
      ];
    }),
  );
}
export const abilityAvailable = (model: AbilityKnowledge, id: string) =>
  !model.usedAbilityIds?.includes(id);

/** Copies hypothetical fields without changing identities, orientations or inputs. */
export function copyTableFields(fields: TableFields): TableFields {
  return {
    boards: Object.fromEntries(
      Object.entries(fields.boards).map(([id, board]) => [id, [...board]]),
    ),
    up: Object.fromEntries(
      Object.entries(fields.up).map(([id, faces]) => [id, [...faces]]),
    ),
  };
}
import { card, type Card } from '../cards';
import type { RulesProfile } from '../config/types';
import { weatherDelta, type Weather } from '../events';
import type { ResolvedCardDefinitions } from '../scoring';
