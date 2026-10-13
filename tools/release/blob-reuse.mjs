import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createPublicKey } from 'node:crypto';
import { tsImport } from 'tsx/esm/api';
import { canonical, sha256 } from './game-package-format.mjs';

// Scoped TS import uses the production trust/closure/ZIP verifier, without a global loader.
let productionVerifier;
const verifier = () =>
  (productionVerifier ??= tsImport(
    '../../apps/server/src/game-packages/verification.ts',
    import.meta.url,
  ));

export async function loadTrustedBlobReuse(directories, { publicKey } = {}) {
  const started = performance.now();
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'ed25519')
    throw new Error('Ed25519 trust key required');
  const trustKeySha256 = sha256(key.export({ type: 'spki', format: 'der' }));
  const { verifyCatalog, readZip } = await verifier();
  const sources = new Map(),
    histories = [];
  const metrics = {
    trustedCatalogs: 0,
    trustedBlobs: 0,
    trustValidationMs: 0,
    reusedBlobs: 0,
    reusedArchiveBytes: 0,
    compressedBlobs: 0,
    compressionMs: 0,
    materializationMs: 0,
  };
  const recipe = {
    schemaVersion: 1,
    writerSha256: sha256(
      await readFile(new URL('./game-package-format.mjs', import.meta.url)),
    ),
    readerSha256: sha256(
      await readFile(
        new URL(
          '../../apps/server/src/game-packages/verification.ts',
          import.meta.url,
        ),
      ),
    ),
    node: process.versions.node,
    zlib: process.versions.zlib,
    compression: 'deflate-raw-9',
    zip: 'utf8-regular-deterministic-v1',
  };
  for (const input of directories) {
    const directory = resolve(input);
    for (let ancestor = directory; ; ancestor = dirname(ancestor)) {
      const stats = await lstat(ancestor);
      if (!stats.isDirectory() || stats.isSymbolicLink())
        throw new Error('Linked history directory rejected');
      if (dirname(ancestor) === ancestor) break;
    }
    const names = (await readdir(directory)).filter((name) =>
      /^TableMax-game-catalog-v1\.\d+\.\d+\.json$/.test(name),
    );
    if (names.length !== 1)
      throw new Error('History requires one signed catalog');
    const catalogPath = join(directory, names[0]);
    const catalogStat = await lstat(catalogPath);
    if (!catalogStat.isFile() || catalogStat.isSymbolicLink())
      throw new Error('Linked or non-file history catalog rejected');
    const catalogBytes = await readFile(catalogPath);
    const catalogSha256 = sha256(catalogBytes);
    const catalog = verifyCatalog(
      JSON.parse(catalogBytes.toString('utf8')),
      key,
    );
    const assets = [
      {
        name: names[0],
        path: catalogPath,
        bytes: catalogBytes.length,
        sha256: catalogSha256,
      },
    ];
    const assetNames = new Set([names[0].toLowerCase()]);
    for (const blob of catalog.blobs) {
      if (
        !/^[A-Za-z0-9._-]+$/.test(blob.assetName) ||
        assetNames.has(blob.assetName.toLowerCase())
      )
        throw new Error('Invalid history asset whitelist');
      assetNames.add(blob.assetName.toLowerCase());
      const path = join(directory, blob.assetName);
      const stats = await lstat(path);
      if (!stats.isFile() || stats.isSymbolicLink())
        throw new Error('Linked or non-file history blob rejected');
      const archive = await readFile(path);
      if (
        archive.length !== blob.archiveBytes ||
        sha256(archive) !== blob.archiveSha256
      )
        throw new Error('Trusted blob archive integrity mismatch: ' + blob.id);
      const prior = sources.get(blob.id);
      if (
        prior &&
        (prior.blob.archiveSha256 !== blob.archiveSha256 ||
          canonical(prior.blob.files) !== canonical(blob.files))
      )
        throw new Error('Historical blob identity conflict');
      const members = prior ? undefined : readZip(archive);
      if (
        members &&
        (members.size !== blob.files.length ||
          blob.files.some((file) => {
            const data = members.get(file.path);
            return (
              !data || data.length !== file.size || sha256(data) !== file.sha256
            );
          }))
      )
        throw new Error('Trusted blob member integrity mismatch: ' + blob.id);
      if (!prior)
        sources.set(blob.id, {
          blob,
          archive,
          catalogSha256,
        });
      assets.push({
        name: blob.assetName,
        path,
        bytes: archive.length,
        sha256: blob.archiveSha256,
      });
      metrics.trustedBlobs += 1;
    }
    histories.push({ directory, catalog, assets });
    metrics.trustedCatalogs += 1;
  }
  metrics.trustValidationMs = performance.now() - started;
  const evidence = [];
  return {
    histories,
    metrics,
    recipe,
    trustKeySha256,
    evidence,
    async materialize(kind, files, id, out) {
      const source = sources.get(id);
      if (!source) return undefined;
      if (
        source.blob.kind !== kind ||
        canonical(source.blob.files) !== canonical(files)
      )
        throw new Error('Trusted blob descriptor mismatch');
      const materializationStarted = performance.now();
      const target = join(out, source.blob.assetName);
      await writeFile(target, source.archive);
      if (sha256(await readFile(target)) !== source.blob.archiveSha256)
        throw new Error('Trusted blob changed during materialization');
      metrics.materializationMs += performance.now() - materializationStarted;
      metrics.reusedBlobs += 1;
      metrics.reusedArchiveBytes += source.archive.length;
      evidence.push({
        id,
        archiveSha256: source.blob.archiveSha256,
        catalogSha256: source.catalogSha256,
        trustKeySha256,
      });
      // A ZIP recipe change never rewrites a historical content ID's trusted bytes.
      return source.blob;
    },
  };
}
