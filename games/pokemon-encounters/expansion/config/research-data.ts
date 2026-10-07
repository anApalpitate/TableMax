import research from './research.json';
import legacyResearch from './legacy-research.json';
import { cardDefinitions, deckProfiles, legacyDeckProfiles } from './card-data';
import { validateResearch } from './validation';

export const researchDefinitions = validateResearch(
  research,
  cardDefinitions,
  deckProfiles.find((p) => p.id === 'small')!,
);
/** Only the old predicates, metadata and genuine sample are retained. Art is shared. */
export const legacyResearchDefinitions = validateResearch(
  {
    schemaVersion: 1,
    tasks: legacyResearch.tasks.map((old) => {
      const current = researchDefinitions.find((t) => t.id === old.id)!;
      return {
        id: old.id,
        name: old.name,
        description: old.description,
        reward: old.reward,
        pool: old.pool,
        condition: old.condition,
        illustrationId: old.id,
        presentation: current.presentation,
        diagram: {
          kind: current.diagram.kind,
          sample: old.sample,
          highlightSlots: [],
          highlightLines: [],
          arrows: [],
          annotations: [],
          caption: old.description,
        },
      };
    }),
  },
  cardDefinitions,
  legacyDeckProfiles.find((p) => p.id === 'small')!,
);
