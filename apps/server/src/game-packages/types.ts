import type { ModuleManifest } from '../../../../packages/game-sdk/src/module-manifest';
import type {
  PublicPackageTask,
  PublicPackageTaskPhase,
} from '@tablemax/protocol';

export interface PackageFile {
  path: string;
  size: number;
  sha256: string;
}
export interface PackageBlob {
  id: string;
  kind: 'code' | 'resources';
  files: PackageFile[];
  archiveBytes: number;
  archiveSha256: string;
  installedBytes: number;
  assetName: string;
  releaseTag: string;
}
export interface GameRelease {
  legacy?: true;
  releaseId: string;
  gameId: string;
  variantId?: string;
  module: ModuleManifest;
  code: string;
  resources: string[];
  resourceMap: Record<string, { blobId: string; path: string }>;
  releaseTag: string;
  offlineAsset?: string;
}
export interface PackageCatalog {
  schemaVersion: 1;
  releases: GameRelease[];
  blobs: PackageBlob[];
}
export interface SignedCatalog {
  payload: PackageCatalog;
  signature: string;
}
export interface InstallIndex {
  schemaVersion: 1;
  releases: Record<string, GameRelease>;
  blobs: Record<string, PackageBlob>;
  selected: Record<string, string>;
}
export type PackageTaskPhase = PublicPackageTaskPhase;
export type PackageTask = PublicPackageTask;
export function releaseKey(
  release: Pick<GameRelease, 'gameId' | 'variantId'>,
): string {
  return `${release.gameId}:${release.variantId ?? ''}`;
}
