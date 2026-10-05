/** Creature identity is independent from an original gameplay category. */
export const creatureResources = {
  pikachu: {
    category: 'ordinary--2',
    frame: '#f5ce42',
    cry: 'pikachu',
    motif: 'electric',
  },
  jigglypuff: {
    category: 'ordinary-0',
    frame: '#ec87ae',
    cry: 'jigglypuff',
    motif: 'song',
  },
  eevee: {
    category: 'ordinary-1',
    frame: '#d39c58',
    cry: 'eevee',
    motif: 'star',
  },
  bulbasaur: {
    category: 'ordinary-3',
    frame: '#74b969',
    cry: 'bulbasaur',
    motif: 'leaf',
  },
  squirtle: {
    category: 'ordinary-4',
    frame: '#6facdc',
    cry: 'squirtle',
    motif: 'water',
  },
  vulpix: { category: 'ordinary-5', frame: '#ee9461' },
  slowpoke: { category: 'ordinary-6', frame: '#eb9fa6' },
  gengar: {
    category: 'ordinary-7',
    frame: '#9a84c7',
    cry: 'gengar',
    motif: 'mist',
  },
  mrMime: { category: 'ordinary-8', frame: '#d79bba' },
  onix: { category: 'ordinary-9', frame: '#aeb5b4' },
  mew: { category: 'special-mew', frame: '#f2ceda', theme: 'mew' },
  rocket: {
    category: 'special-team-rocket',
    frame: '#eee6ce',
    theme: 'rocket',
  },
  zapdos: { category: 'special-zapdos', frame: '#f3cf48', theme: 'zapdos' },
  charizard: {
    category: 'special-charizard',
    frame: '#ec9159',
    theme: 'charizard',
  },
  snorlax: { category: 'special-snorlax', frame: '#74a9ab', theme: 'snorlax' },
  ditto: { category: 'special-ditto', frame: '#b793d3' },
} as const;
export type CreatureResourceId = keyof typeof creatureResources;
export const originalCreatureIds: Readonly<Record<string, CreatureResourceId>> =
  Object.fromEntries(
    Object.entries(creatureResources).map(([id, definition]) => [
      definition.category,
      id as CreatureResourceId,
    ]),
  );
export const creatureCries: Record<string, string> = Object.fromEntries(
  Object.values(creatureResources)
    .filter((r) => 'cry' in r)
    .map((r) => [r.category, 'cry' in r ? r.cry : '']),
);
export const creatureMotifs: Record<string, string> = Object.fromEntries(
  Object.values(creatureResources)
    .filter((r) => 'motif' in r)
    .map((r) => [r.category, 'motif' in r ? r.motif : '']),
);
export const creatureThemes: Record<
  string,
  'mew' | 'rocket' | 'zapdos' | 'charizard' | 'snorlax'
> = Object.fromEntries(
  Object.values(creatureResources)
    .filter((r) => 'theme' in r)
    .map((r) => [r.category, 'theme' in r ? r.theme : 'mew']),
);
