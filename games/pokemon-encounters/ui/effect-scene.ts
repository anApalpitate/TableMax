import type { PublicAction } from '../../../packages/protocol/src';
import type { PokemonView } from '../rules/project';
import type { EffectTheme } from './presentation-state';
import { creatureMotifs } from '../shared/presentation';
import { abilityEntrances } from '../variants/original-presentation';

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
      return { theme: 'mew', duration: abilityEntrances.mew.duration };
    if (action.ability === 'special-zapdos')
      return { theme: 'zapdos', duration: abilityEntrances.zapdos.duration };
    if (action.ability === 'special-team-rocket' && game.coin)
      return { theme: 'rocket', duration: abilityEntrances.rocket.duration };
  }
  return null;
}

export const drawMotifs = creatureMotifs;
