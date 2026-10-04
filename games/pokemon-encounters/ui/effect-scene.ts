import type { PublicAction } from '../../../packages/protocol/src';
import type { PokemonView } from '../rules/project';
import type { EffectTheme } from './presentation-state';

/** Only decisive, committed public actions get a screen-wide entrance. */
export function effectScene(
  action: PublicAction | undefined,
  game: PokemonView,
  result: boolean,
): { theme: EffectTheme | 'result'; duration: number } | null {
  if (result)
    return { theme: 'result', duration: game.matchWinners.length ? 1000 : 900 };
  if (!action) return null;
  if (action.verb === 'draw') {
    if (action.ability === 'special-mew')
      return { theme: 'mew', duration: 700 };
    if (action.ability === 'special-zapdos')
      return { theme: 'zapdos', duration: 650 };
    if (action.ability === 'special-team-rocket' && game.coin)
      return { theme: 'rocket', duration: 850 };
  }
  if (action.verb === 'swap' && action.ability === 'special-snorlax')
    return { theme: 'snorlax', duration: 600 };
  if (action.verb === 'peek' && action.ability === 'special-charizard')
    return { theme: 'charizard', duration: 650 };
  return null;
}

export const drawMotifs: Record<string, string> = {
  'ordinary--2': 'electric',
  'ordinary-0': 'song',
  'ordinary-1': 'star',
  'ordinary-3': 'leaf',
  'ordinary-4': 'water',
  'ordinary-7': 'mist',
};
