const files = import.meta.glob<string>(
  '../../../../assets/games/pokemon-encounters/expansion/audio/cries/*.ogg',
  { eager: true, query: '?url', import: 'default' },
);
const roles: Record<string, string> = {
  'special-charizard': 'charizard',
  'ordinary-5': 'vulpix',
  'ordinary-psyduck': 'psyduck',
  'ordinary-6': 'slowpoke',
  'ordinary-9': 'onix',
  'ordinary-8': 'mr-mime',
  'ordinary-magikarp': 'magikarp',
  'special-ditto': 'ditto',
  'special-snorlax': 'snorlax',
  'special-zapdos': 'zapdos',
  'ordinary-dragonite': 'dragonite',
  'special-mewtwo': 'mewtwo',
  'special-mew': 'mew',
  'ordinary-togepi': 'togepi',
  'ordinary-gardevoir': 'gardevoir',
  'ordinary-metagross': 'metagross',
  'special-kyogre': 'kyogre',
  'special-groudon': 'groudon',
  'special-rayquaza': 'rayquaza',
  'ordinary-piplup': 'piplup',
  'ordinary-garchomp': 'garchomp',
  'special-lucario': 'lucario',
  'special-arceus': 'arceus',
  'special-zorua': 'zorua',
  'special-greninja': 'greninja',
  'ordinary-rowlet': 'rowlet',
  'ordinary-mimikyu': 'mimikyu',
};
export const expansionVoices: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(roles).map(([category, id]) => {
      const source =
        files[
          `../../../../assets/games/pokemon-encounters/expansion/audio/cries/${id}-encyclopedia-cry-v1.ogg`
        ];
      if (!source) throw new Error(`Missing expansion cry: ${id}`);
      return [category, source];
    }),
  );
