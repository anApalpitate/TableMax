/** Browser-only art registry. Rules and saved state never depend on asset filenames. */
import {
  creatureResources,
  originalCreatureIds,
  type CreatureResourceId,
} from '../../../games/pokemon-encounters/shared/presentation';
const images = import.meta.glob<string>('./characters/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function cardArt(categoryId: string) {
  return creatureArt(originalCreatureIds[categoryId]);
}
export function creatureArt(resourceId: CreatureResourceId | undefined) {
  const resource = resourceId ? creatureResources[resourceId] : undefined;
  const categoryId = resource?.category;
  return {
    image:
      images[`./characters/${categoryId}-official.png`] ??
      images[`./characters/${categoryId}-v1.webp`],
    frame: resource?.frame ?? '#eee6ce',
  };
}

export const coinArt = {
  pikachu: images['./characters/ordinary--2-official.png'],
  meowth: images['./characters/coin-meowth-official.png'],
};
