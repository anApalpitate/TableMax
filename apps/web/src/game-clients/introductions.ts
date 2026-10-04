import { pokemonIntroduction } from '../../../../games/pokemon-encounters/ui/introduction';
import { modernArtIntroduction } from '../../../../games/modern-art/ui/introduction';
import { powerGridIntroduction } from '../../../../games/power-grid/ui/introduction';

export type IntroductionIcon =
  'cards' | 'swap' | 'pair' | 'auction' | 'painting' | 'coins';
export interface GameIntroductionContent {
  readonly tagline: string;
  readonly lead: string;
  readonly steps: readonly {
    readonly icon: IntroductionIcon;
    readonly title: string;
    readonly text: string;
  }[];
  readonly goal: string;
}

// Box metadata stays independent of the heavy, lazily loaded game clients.
export function gameIntroduction(
  id: string,
): GameIntroductionContent | undefined {
  if (id === 'pokemon-encounters') return pokemonIntroduction;
  if (id === 'modern-art') return modernArtIntroduction;
  if (id === 'power-grid') return powerGridIntroduction;
  return undefined;
}
