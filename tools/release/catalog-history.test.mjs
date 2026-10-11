import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCatalogHistory, legacyCatalog } from './catalog-history.mjs';

test('keeps historical references, addresses and bytes while excluding unsupported and retired legacy recommendations', () => {
  const module = (protocol) => ({
    compatibility: { sdk: 1, protocol, webHost: 1 },
    retiredVariantIds: ['classic'],
    variants: [
      { id: 'configured', compatibility: { sdk: 1, protocol, webHost: 1 } },
    ],
  });
  const release = (releaseId, protocol, variantId = 'configured') => ({
    releaseId,
    gameId: 'avalon',
    variantId,
    module: module(protocol),
    code: 'blob',
    resources: [],
  });
  const blob = {
    id: 'blob',
    archiveSha256: 'same-bytes',
    files: [],
    releaseTag: 'v1.0.5',
  };
  const current = {
    releases: [release('new', 8)],
    blobs: [{ ...blob, releaseTag: 'v1.0.6' }],
  };
  const old = {
    releases: [release('prior', 7), release('retired', 7, 'classic')],
    blobs: [blob],
  };
  const merged = mergeCatalogHistory(current, [old]);
  assert.deepEqual(
    merged.releases.map((r) => r.releaseId),
    ['new', 'prior', 'retired'],
  );
  assert.equal(merged.blobs[0].releaseTag, 'v1.0.5');
  assert.deepEqual(
    legacyCatalog(merged).releases.map((r) => r.releaseId),
    ['prior'],
  );
  assert.throws(
    () =>
      mergeCatalogHistory(current, [
        { ...old, blobs: [{ ...blob, archiveSha256: 'tampered' }] },
      ]),
    /conflict/,
  );
  assert.throws(
    () =>
      mergeCatalogHistory(current, [
        { ...old, releases: [{ ...current.releases[0], code: 'tampered' }] },
      ]),
    /conflict/,
  );
});
