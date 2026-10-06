import { cardArt } from '../../../../assets/games/pokemon-encounters/catalog';

const portraits = import.meta.glob<string>(
  '../../../../assets/games/pokemon-encounters/expansion/portraits/*.webp',
  { eager: true, query: '?url', import: 'default' },
);
export function portraitFor(categoryId: string) {
  const creature = categoryId.replace(/^(ordinary|special)-/, '');
  return (
    portraits[
      `../../../../assets/games/pokemon-encounters/expansion/portraits/${creature}-official-v1.webp`
    ] ?? cardArt(categoryId).image
  );
}
