import definitions from '../../../docs/games/pokemon-encounters/cards.json';
import { createCardCatalog } from '../shared/card-catalog';

export const originalCards = createCardCatalog(definitions.cards);
