import pokemon from '../../../../assets/games/pokemon-encounters/cover-v1.webp';
import modernArt from '../../../../assets/games/modern-art/cover-v1.webp';

// The box imports thumbnails only. Full game assets belong to lazy clients.
const covers: Record<string, string> = {
  'pokemon-encounters': pokemon,
  'modern-art': modernArt,
};
export const gameCover = (id: string | undefined) =>
  id ? covers[id] : undefined;
