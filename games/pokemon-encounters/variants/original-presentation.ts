import {
  creatureResources,
  type CreatureResourceId,
} from '../shared/creature-resources';

export const originalCreatureIds: Readonly<Record<string, CreatureResourceId>> =
  {
    'ordinary--2': 'pikachu',
    'ordinary-0': 'jigglypuff',
    'ordinary-1': 'eevee',
    'ordinary-3': 'bulbasaur',
    'ordinary-4': 'squirtle',
    'ordinary-5': 'vulpix',
    'ordinary-6': 'slowpoke',
    'ordinary-7': 'gengar',
    'ordinary-8': 'mrMime',
    'ordinary-9': 'onix',
    'special-mew': 'mew',
    'special-team-rocket': 'rocket',
    'special-zapdos': 'zapdos',
    'special-charizard': 'charizard',
    'special-snorlax': 'snorlax',
    'special-ditto': 'ditto',
  };
const entries = Object.entries(originalCreatureIds).map(
  ([category, id]) => [category, creatureResources[id]] as const,
);
export const creatureCries: Record<string, string> = Object.fromEntries(
  entries
    .filter(([, resource]) => 'cry' in resource)
    .map(([category, resource]) => [
      category,
      'cry' in resource ? resource.cry : '',
    ]),
);
export const creatureMotifs: Record<string, string> = Object.fromEntries(
  entries
    .filter(([, resource]) => 'motif' in resource)
    .map(([category, resource]) => [
      category,
      'motif' in resource ? resource.motif : '',
    ]),
);
export const creatureThemes: Record<
  string,
  'mew' | 'rocket' | 'zapdos' | 'charizard' | 'snorlax'
> = Object.fromEntries(
  entries
    .filter(([, resource]) => 'theme' in resource)
    .map(([category, resource]) => [
      category,
      'theme' in resource ? resource.theme : 'mew',
    ]),
);

export const abilityEntrances = {
  mew: {
    id: 'mew',
    motif: 'psychic',
    side: 'right',
    duration: 1650,
    resource: 'mew',
    title: '梦幻',
    subtitle: '念力交换',
  },
  zapdos: {
    id: 'zapdos',
    motif: 'electric',
    side: 'left',
    duration: 1500,
    resource: 'zapdos',
    title: '闪电鸟',
    subtitle: '接力传牌',
  },
  rocket: {
    id: 'rocket',
    motif: 'comic',
    side: 'right',
    duration: 1800,
    resource: 'rocket',
    title: '火箭队',
    subtitle: '突袭',
  },
} as const;
