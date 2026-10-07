import cards from './cards.json';
import decks from './decks.json';
import legacyDecks from './legacy-decks.json';
import { validateCards, validateDecks } from './validation';

export const cardDefinitions = validateCards(cards);
export const deckProfiles = validateDecks(decks, cardDefinitions);
export const legacyDeckProfiles = validateDecks(legacyDecks, cardDefinitions);
