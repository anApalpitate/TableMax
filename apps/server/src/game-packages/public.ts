import { readFileSync } from 'node:fs';
import type {
  GameReleaseSummary,
  PublicPackageSnapshot,
} from '@tablemax/protocol';
import {
  projectGameDetails,
  projectGameWeb,
} from '@tablemax/game-sdk/metadata';
import type {
  GameDetails,
  ModuleManifest,
} from '@tablemax/game-sdk/module-manifest';
import type { GameRelease } from './types';
import type { PackageStore } from './store';
import { safePath } from './verification';
import { preferredCatalogReleases } from './catalog';

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
  const compatible = (
    compatibility: ModuleManifest['compatibility'] | undefined,
  ) =>
    compatibility?.sdk === 1 &&
    compatibility.protocol === 7 &&
    compatibility.webHost === 1;
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
    compatible:
      compatible(module.compatibility) &&
      (release.variantId === undefined || compatible(variant?.compatibility)),
  };
}

export function projectPackageSnapshot(
  snapshot: ReturnType<PackageStore['snapshot']>,
): PublicPackageSnapshot {
  return {
    catalog: {
      releases: preferredCatalogReleases(snapshot.catalog.releases).map(
        projectReleaseSummary,
      ),
    },
    index: {
      releases: Object.fromEntries(
        Object.entries(snapshot.index.releases).map(([id, release]) => [
          id,
          projectReleaseSummary(release),
        ]),
      ),
      selected: { ...snapshot.index.selected },
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
