/** Trusted static distribution; signatures and hashes remain authoritative. */
export const GAME_PAGES_ROOT = 'https://anapalpitate.github.io/TableMax/';
export const GAME_CATALOG_TAG = 'v1.0.6';

function segment(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value))
    throw new Error('invalid-distribution-path');
  return encodeURIComponent(value);
}

export function gameCatalogUrl(tag = GAME_CATALOG_TAG) {
  return `${GAME_PAGES_ROOT}games/${segment(tag)}/catalog.json`;
}

export function gameAssetUrl(blob: { releaseTag: string; assetName: string }) {
  return `${GAME_PAGES_ROOT}games/${segment(blob.releaseTag)}/packages/${segment(blob.assetName)}`;
}
