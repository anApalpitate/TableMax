/** Loaded only with the Modern Art client; the box has its own small cover. */
const files = import.meta.glob('./*-atlas-v1.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const artAtlases: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    path.replace('./', '').replace('-atlas-v1.webp', ''),
    url,
  ]),
);

export function paintingImage(artistId: string, artIndex: number) {
  const cell = Math.max(0, Math.min(15, artIndex - 1));
  return {
    url: artAtlases[artistId],
    position: `${((cell % 4) / 3) * 100}% ${(Math.floor(cell / 4) / 3) * 100}%`,
  };
}
