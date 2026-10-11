import { canonical } from './game-package-format.mjs';

/** Current entries first; signed historical identities and archive bytes never change. */
export function mergeCatalogHistory(current, histories) {
  const releases = new Map(),
    blobs = new Map();
  for (const catalog of [current, ...histories]) {
    for (const release of catalog.releases) {
      const previous = releases.get(release.releaseId);
      if (previous && canonical(previous) !== canonical(release))
        throw new Error('Historical release identity conflict');
      if (!previous) releases.set(release.releaseId, release);
    }
    for (const blob of catalog.blobs) {
      const previous = blobs.get(blob.id);
      if (
        previous &&
        (previous.archiveSha256 !== blob.archiveSha256 ||
          canonical(previous.files) !== canonical(blob.files))
      )
        throw new Error('Historical blob identity conflict');
      // Historical URLs remain valid even when a new release shares the same content.
      blobs.set(blob.id, blob);
    }
  }
  return {
    schemaVersion: 1,
    releases: [...releases.values()],
    blobs: [...blobs.values()],
  };
}

export function legacyCatalog(payload) {
  const retired = new Set(
    payload.releases.flatMap((r) =>
      (r.module.retiredVariantIds ?? []).map((id) => `${r.gameId}:${id}`),
    ),
  );
  const releases = payload.releases.filter((r) => {
    const compatible = (c) =>
      c?.sdk === 1 &&
      c.protocol === 7 &&
      c.webHost === 1 &&
      !c.requiredCapabilities?.length;
    return (
      !retired.has(`${r.gameId}:${r.variantId}`) &&
      compatible(r.module.compatibility) &&
      (r.variantId === undefined ||
        compatible(
          r.module.variants?.find((v) => v.id === r.variantId)?.compatibility,
        ))
    );
  });
  const ids = new Set(releases.flatMap((r) => [r.code, ...r.resources]));
  return {
    schemaVersion: 1,
    releases,
    blobs: payload.blobs.filter((b) => ids.has(b.id)),
  };
}
