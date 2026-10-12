import type { PublicAction } from '@tablemax/web-host';
import type { PokemonView } from '../rules/project';
import type { EffectTheme } from './presentation-state';
import { creatureMotifs } from '../shared/presentation';
import { abilityEntrances } from '../variants/original-presentation';
import type { EntranceDefinition } from './AbilityEntrance';

export const additionalEntrances = {
  charizard: {
    id: 'charizard',
    motif: 'flame',
    side: 'left',
    duration: 1650,
    title: '喷火龙',
    subtitle: '火焰窥探',
    resource: 'charizard',
  },
  snorlax: {
    id: 'snorlax',
    motif: 'impact',
    side: 'right',
    duration: 1550,
    title: '卡比兽',
    subtitle: '两牌交换',
    resource: 'snorlax',
  },
} as const satisfies Record<string, EntranceDefinition & { resource: string }>;

/** Only decisive, committed public actions get a screen-wide entrance. */
export function effectScene(
  action: PublicAction | undefined,
  game: PokemonView,
  result: boolean,
): { theme: EffectTheme | 'result'; duration: number } | null {
  if (result)
    return { theme: 'result', duration: game.matchWinners.length ? 1000 : 900 };
  if (!action) return null;
  if (action.verb === 'peek' && action.ability === 'special-charizard')
    return {
      theme: 'charizard',
      duration: additionalEntrances.charizard.duration,
    };
  if (action.verb === 'swap' && action.ability === 'special-snorlax')
    return { theme: 'snorlax', duration: additionalEntrances.snorlax.duration };
  if (action.verb === 'draw') {
    if (action.ability === 'special-mew')
      return { theme: 'mew', duration: abilityEntrances.mew.duration };
    if (action.ability === 'special-zapdos')
      return { theme: 'zapdos', duration: abilityEntrances.zapdos.duration };
    if (action.ability === 'special-team-rocket' && game.coin)
      return { theme: 'rocket', duration: abilityEntrances.rocket.duration };
  }
  return null;
}

export const drawMotifs = creatureMotifs;
