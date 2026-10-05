/** Stable creature identity and browser-independent resource metadata. */
export const creatureResources = {
  pikachu: {
    imageStem: 'ordinary--2',
    frame: '#f5ce42',
    cry: 'pikachu',
    motif: 'electric',
  },
  jigglypuff: {
    imageStem: 'ordinary-0',
    frame: '#ec87ae',
    cry: 'jigglypuff',
    motif: 'song',
  },
  eevee: {
    imageStem: 'ordinary-1',
    frame: '#d39c58',
    cry: 'eevee',
    motif: 'star',
  },
  bulbasaur: {
    imageStem: 'ordinary-3',
    frame: '#74b969',
    cry: 'bulbasaur',
    motif: 'leaf',
  },
  squirtle: {
    imageStem: 'ordinary-4',
    frame: '#6facdc',
    cry: 'squirtle',
    motif: 'water',
  },
  vulpix: { imageStem: 'ordinary-5', frame: '#ee9461' },
  slowpoke: { imageStem: 'ordinary-6', frame: '#eb9fa6' },
  gengar: {
    imageStem: 'ordinary-7',
    frame: '#9a84c7',
    cry: 'gengar',
    motif: 'mist',
  },
  mrMime: { imageStem: 'ordinary-8', frame: '#d79bba' },
  onix: { imageStem: 'ordinary-9', frame: '#aeb5b4' },
  mew: { imageStem: 'special-mew', frame: '#f2ceda', theme: 'mew' },
  rocket: {
    imageStem: 'special-team-rocket',
    frame: '#eee6ce',
    theme: 'rocket',
  },
  zapdos: { imageStem: 'special-zapdos', frame: '#f3cf48', theme: 'zapdos' },
  charizard: {
    imageStem: 'special-charizard',
    frame: '#ec9159',
    theme: 'charizard',
  },
  snorlax: { imageStem: 'special-snorlax', frame: '#74a9ab', theme: 'snorlax' },
  ditto: { imageStem: 'special-ditto', frame: '#b793d3' },
} as const;
export type CreatureResourceId = keyof typeof creatureResources;
