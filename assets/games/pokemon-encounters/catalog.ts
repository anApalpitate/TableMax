/** Browser-only art registry. Rules and saved state never depend on asset filenames. */
import {
  creatureResources,
  type CreatureResourceId,
} from '../../../games/pokemon-encounters/shared/creature-resources';
import { originalCreatureIds } from '../../../games/pokemon-encounters/variants/original-presentation';
const images = import.meta.glob<string>(
  ['./characters/*.{png,webp}', '!./characters/*-official.png'],
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);

export function cardArt(categoryId: string) {
  return creatureArt(originalCreatureIds[categoryId]);
}
function imageForStem(stem: string | undefined) {
  return (
    images[`./characters/${stem}-official-lossless-v1.webp`] ??
    images[`./characters/${stem}-official.png`] ??
    images[`./characters/${stem}-v1.webp`]
  );
}
export function creatureArt(resourceId: CreatureResourceId | undefined) {
  const resource = resourceId ? creatureResources[resourceId] : undefined;
  const categoryId = resource?.imageStem;
  return {
    image: imageForStem(categoryId),
    frame: resource?.frame ?? '#eee6ce',
  };
}

export const coinArt = {
  pikachu: imageForStem('ordinary--2'),
  meowth: imageForStem('coin-meowth'),
};
