// Assembled builds read these illustrations from the game's resource package.
export const commonSourceIllustrations = import.meta.glob<string>(
  '../../../../assets/games/*/introduction-*.svg',
  { eager: true, query: '?url', import: 'default' },
);
