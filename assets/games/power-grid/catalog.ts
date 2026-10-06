/** Loaded with the Power Grid client; all references are local and game-owned. */
import terrainUrl from './board-v3-expanded.webp?url';
import classicTerrainUrl from './board-v2.webp?url';
import atlasUrl from './plants-atlas-v1.webp?url';
import coverUrl from './cover-v1.webp?url';

export const mapTerrain = terrainUrl;
export const classicMapTerrain = classicTerrainUrl;
export const plantAtlas = atlasUrl;
export const cover = coverUrl;

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
