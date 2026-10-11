export const PLATFORM_CAPABILITIES: readonly string[];
export function compatibleModule(
  value:
    | {
        sdk?: number;
        protocol?: number;
        webHost?: number;
        requiredCapabilities?: readonly string[];
      }
    | undefined,
  capabilities?: readonly string[],
): boolean;

type CompatibleRelease = {
  gameId: string;
  variantId?: string;
  module?: {
    compatibility: Parameters<typeof compatibleModule>[0];
    variants?: {
      id: string;
      compatibility: Parameters<typeof compatibleModule>[0];
    }[];
  };
};
export function moduleCompatibilityIssue(
  value: Parameters<typeof compatibleModule>[0],
  capabilities?: readonly string[],
): string | undefined;
export function releaseCompatibilityIssue(
  release: Pick<CompatibleRelease, 'variantId' | 'module'>,
): string | undefined;
export function releaseCompatible(
  release: Pick<CompatibleRelease, 'variantId' | 'module'>,
): boolean;
export function preferredCatalogReleases<T extends CompatibleRelease>(
  releases: readonly T[],
): T[];
