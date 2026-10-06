import research from './research.json';
import { cardDefinitions, deckProfiles } from './card-data';
import { validateResearch } from './validation';

export const researchDefinitions = validateResearch(
  research,
  cardDefinitions,
  deckProfiles.find((p) => p.id === 'small')!,
);
