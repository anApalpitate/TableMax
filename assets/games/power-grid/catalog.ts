/** Loaded with the Power Grid client; all references are local and game-owned. */
const files = import.meta.glob('./*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const mapTerrain = files['./board-v1.webp']!;
export const plantAtlas = files['./plants-atlas-v1.webp']!;
export const cover = files['./cover-v1.webp']!;

export type PlantArtFuel =
  'coal' | 'oil' | 'hybrid' | 'garbage' | 'uranium' | 'green' | 'fusion';

/** Row-major, zero-based indices in a four-by-four atlas. */
export const plantArtIndices: Readonly<
  Record<PlantArtFuel, readonly number[]>
> = {
  coal: [0, 1, 2, 3],
  oil: [4, 5, 7],
  hybrid: [6],
  garbage: [8, 9],
  uranium: [10, 11],
  green: [12, 13, 14],
  fusion: [15],
};

/** A small inset excludes the generated sheet's hairline tile seams. */
export function plantImage(fuel: PlantArtFuel, plantId = 0) {
  const choices = plantArtIndices[fuel];
  const index = choices[Math.abs(Math.trunc(plantId)) % choices.length]!;
  const inset = 0.0025;
  const extent = 0.25 - inset * 2;
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    url: plantAtlas,
    index,
    position: `${((column / 4 + inset) / (1 - extent)) * 100}% ${((row / 4 + inset) / (1 - extent)) * 100}%`,
    size: `${100 / extent}% ${100 / extent}%`,
  };
}
