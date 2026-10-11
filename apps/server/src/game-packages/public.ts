import { readFileSync } from 'node:fs';
import type {
  GameReleaseSummary,
  PublicPackageSnapshot,
} from '@tablemax/protocol';
import {
  projectGameDetails,
  projectGameWeb,
} from '@tablemax/game-sdk/metadata';
import type { GameDetails } from '@tablemax/game-sdk/module-manifest';
import type { GameRelease } from './types';
import type { PackageStore } from './store';
import { safePath } from './verification';
import { preferredCatalogReleases, releaseCompatible } from './catalog';
import { releaseCompatibilityIssue } from '../../../../packages/game-sdk/src/compatibility.mjs';
import { retiredVariant, retiredVariantPolicies } from '../game-variant-policy';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const introduction = (value: unknown): boolean =>
  object(value) &&
  ['tagline', 'lead', 'goal'].every((key) => typeof value[key] === 'string') &&
  Array.isArray(value.steps) &&
  value.steps.every(
    (step) =>
      object(step) &&
      ['icon', 'title', 'text'].every((key) => typeof step[key] === 'string'),
  );

function isDetailDocument(value: unknown, id: string): value is GameDetails {
  return (
    object(value) &&
    value.schemaVersion === 1 &&
    value.id === id &&
    (value.guidance === undefined || typeof value.guidance === 'boolean') &&
    (value.introduction === undefined || introduction(value.introduction)) &&
    (value.botIntroduction === undefined ||
      (object(value.botIntroduction) &&
        ['default', 'doubao', 'juewu'].every((level) => {
          const detail = (value.botIntroduction as Record<string, unknown>)[
            level
          ];
          return (
            object(detail) &&
            typeof detail.lead === 'string' &&
            Array.isArray(detail.details) &&
            detail.details.every((item) => typeof item === 'string')
          );
        }))) &&
    (value.variants === undefined ||
      (Array.isArray(value.variants) &&
        value.variants.every(
          (variant) =>
            object(variant) &&
            typeof variant.id === 'string' &&
            /^[a-z][a-z0-9-]*$/.test(variant.id) &&
            introduction(variant.introduction),
        )))
  );
}

export function projectReleaseSummary(
  release: GameRelease,
): GameReleaseSummary {
  const module = release.module;
  const variant = module.variants?.find(
    (item) => item.id === release.variantId,
  );
  const compatibilityIssue = releaseCompatibilityIssue(release);
  return {
    releaseId: release.releaseId,
    gameId: release.gameId,
    ...(release.variantId === undefined
      ? {}
      : { variantId: release.variantId }),
    name: module.catalog.name,
    ...(variant === undefined ? {} : { variantName: variant.name }),
    ...(module.defaultVariantId === undefined
      ? {}
      : { defaultVariantId: module.defaultVariantId }),
    releaseTag: release.releaseTag,
    compatible: releaseCompatible(release),
    ...(compatibilityIssue === undefined ? {} : { compatibilityIssue }),
  };
}

export function projectPackageSnapshot(
  snapshot: ReturnType<PackageStore['snapshot']>,
  policies = retiredVariantPolicies(),
): PublicPackageSnapshot {
  const current = (release: GameRelease) =>
    !retiredVariant(
      release.gameId,
      release.variantId ?? release.module.defaultVariantId,
      policies,
    );
  const releases = Object.entries(snapshot.index.releases).filter(
    ([, release]) => current(release),
  );
  const visible = new Set(releases.map(([id]) => id));
  return {
    catalog: {
      releases: preferredCatalogReleases(snapshot.catalog.releases)
        .filter(current)
        .map(projectReleaseSummary),
    },
    index: {
      releases: Object.fromEntries(
        releases.map(([id, release]) => [id, projectReleaseSummary(release)]),
      ),
      selected: Object.fromEntries(
        Object.entries(snapshot.index.selected).filter(([, id]) =>
          visible.has(id),
        ),
      ),
    },
    tasks: snapshot.tasks.map(
      ({ releaseId, phase, transferredBytes, totalBytes, error }) => ({
        releaseId,
        phase,
        transferredBytes,
        totalBytes,
        ...(error === undefined ? {} : { error }),
      }),
    ),
    unavailableReleaseIds: [...snapshot.unavailableReleaseIds],
  };
}

export function publicReleaseClient(store: PackageStore, releaseId: string) {
  const found = store.resolveModule(releaseId);
  return found
    ? {
        gameId: found.release.gameId,
        module: projectGameWeb(found.release.module),
      }
    : undefined;
}

/** Installed bytes are resolved through the package inventory, never an arbitrary path. */
export function publicReleaseDetails(
  store: PackageStore,
  releaseId: string,
): GameDetails | undefined {
  const found = store.resolveModule(releaseId);
  if (!found) return undefined;
  const descriptor = found.release.module;
  if (descriptor.details === undefined) return projectGameDetails(descriptor);
  if (!safePath(descriptor.details) || !descriptor.details.startsWith('web/'))
    return undefined;
  const file = store.resolvePublicFile(releaseId, descriptor.details);
  if (!file) return undefined;
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!isDetailDocument(value, found.release.gameId)) return undefined;
    // Reuse the same allowlist as source metadata and legacy embedded documents.
    return projectGameDetails(value);
  } catch {
    return undefined;
  }
}
