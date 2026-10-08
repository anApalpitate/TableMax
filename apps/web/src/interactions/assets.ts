const files = import.meta.glob(
  '../../../../assets/platform/interaction/*.{mp3,svg,webp}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>;
const assets = new Map(
  Object.entries(files).map(([path, url]) => [path.split('/').at(-1)!, url]),
);
export function interactionAsset(file: string) {
  return assets.get(file) ?? '';
}
