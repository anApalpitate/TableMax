import { readFile, stat } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { createPublicKey, verify } from 'node:crypto';
import { canonical, sha256 } from './game-package-format.mjs';
/** Publish only signed catalog members; old build candidates never enter assets. */
export async function gameReleaseAssets(
  directory,
  { publicKey, devkitPath, tag } = {},
) {
  if (!publicKey)
    throw new Error('Project public key required for game asset whitelist');
  tag ??= 'v' + JSON.parse(await readFile('package.json', 'utf8')).version;
  const catalogPath = resolve(directory, `TableMax-game-catalog-${tag}.json`);
  const envelope = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (
    !verify(
      null,
      Buffer.from(canonical(envelope.payload)),
      createPublicKey(publicKey),
      Buffer.from(envelope.signature, 'base64'),
    )
  )
    throw new Error('Invalid game catalog signature');
  const catalog = envelope.payload;
  if (
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.blobs) ||
    !Array.isArray(catalog.releases)
  )
    throw new Error('Invalid game catalog');
  const requested = new Map([[basename(catalogPath), { path: catalogPath }]]);
  const add = (name, expected = {}) => {
    if (
      !/^[A-Za-z0-9._-]+$/.test(name) ||
      name === '.' ||
      name === '..' ||
      requested.has(name.toLowerCase())
    )
      throw new Error('Invalid release asset name');
    requested.set(name.toLowerCase(), {
      path: join(resolve(directory), name),
      ...expected,
    });
  };
  for (const blob of catalog.blobs)
    add(blob.assetName, {
      bytes: blob.archiveBytes,
      sha256: blob.archiveSha256,
    });
  for (const release of catalog.releases)
    if (release.offlineAsset) add(release.offlineAsset);
  if (devkitPath) {
    const name = basename(devkitPath);
    if (
      !/^TableMax-author-toolkit-[A-Za-z0-9._-]+\.zip$/.test(name) ||
      requested.has(name.toLowerCase())
    )
      throw new Error('Invalid developer toolkit asset');
    requested.set(name.toLowerCase(), { path: resolve(devkitPath) });
  }
  const assets = [];
  for (const item of requested.values()) {
    const stats = await stat(item.path);
    if (!stats.isFile()) throw new Error('Non-file release asset');
    const bytes = await readFile(item.path);
    if (
      (item.bytes !== undefined && item.bytes !== bytes.length) ||
      (item.sha256 && item.sha256 !== sha256(bytes))
    )
      throw new Error('Release asset integrity mismatch');
    assets.push({
      path: item.path,
      name: basename(item.path),
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  return assets.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
