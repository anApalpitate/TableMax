import type { ModernArtView } from './view';

/** currentValue remains authoritative; history stores increments, including the
 * current round once settled. Excluding that round prevents double counting. */
export function marketValueParts(
  artist: ModernArtView['artists'][number],
  round: number,
) {
  const historical = artist.history
    .slice(0, Math.max(0, round - 1))
    .reduce((total, value) => total + value, 0);
  return {
    historical,
    increment: artist.currentValue > 0 ? artist.currentValue - historical : 0,
    eligible: artist.currentValue > 0,
  };
}
