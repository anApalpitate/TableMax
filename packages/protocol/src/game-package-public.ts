/** Browser installation state. Signed/internal package manifests stay on the host. */
export interface GameReleaseSummary {
  releaseId: string;
  gameId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  defaultVariantId?: string;
  releaseTag: string;
  compatible: boolean;
}

export type PublicPackageTaskPhase =
  | 'queued'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'complete'
  | 'cancelled'
  | 'failed';

export interface PublicPackageTask {
  releaseId: string;
  phase: PublicPackageTaskPhase;
  transferredBytes: number;
  totalBytes: number;
  error?: string;
}

export interface PublicPackageSnapshot {
  catalog: { releases: GameReleaseSummary[] };
  index: {
    releases: Record<string, GameReleaseSummary>;
    selected: Record<string, string>;
  };
  tasks: PublicPackageTask[];
  unavailableReleaseIds: string[];
}
