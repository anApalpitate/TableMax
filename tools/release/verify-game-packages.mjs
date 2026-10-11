import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises';
import { createPublicKey } from 'node:crypto';
import { resolve, join } from 'node:path';
import {
  verifyCatalog,
  readZip,
  blobIdentity,
  releaseIdentity,
  sha256,
} from '../../apps/server/src/game-packages/verification.ts';
import { gameResourcesPlugin, mediaGlobs } from '../build/game-resources.mjs';
import { inputsFor, assertGameImport } from '../build/module-build.mjs';
import { resourceUrl } from '../../packages/web-host/src/resource-url.ts';
import { gameReleaseAssets } from './game-release-assets.mjs';
import { PROJECT_GAME_PUBLIC_KEY } from '../../apps/server/src/game-packages/project-public-key.ts';
import { isDirectExecution } from '../shared/workspace-root.mjs';
export async function verifyGamePackages({
  out = 'artifacts/game-packages/v1.0.6',
  publicKey = PROJECT_GAME_PUBLIC_KEY,
} = {}) {
  const envelope = JSON.parse(
    await readFile(join(out, 'TableMax-game-catalog-v1.0.6.json'), 'utf8'),
  );
  const catalog = verifyCatalog(envelope, createPublicKey(publicKey));
  const ownSource = resolve('games/uno/ui/probe.ts');
  assert.doesNotThrow(() =>
    assertGameImport('uno', ownSource, '@tablemax/game-sdk'),
  );
  assert.doesNotThrow(() => assertGameImport('uno', ownSource, '../types'));
  for (const request of [
    '../../../apps/web/src/session/useRoomSession',
    '../../avalon/rules/index',
    '../../../packages/game-sdk/src',
    '@tablemax/web-host/platform',
  ])
    assert.throws(() => assertGameImport('uno', ownSource, request));
  const whitelist = await gameReleaseAssets(out, { publicKey });
  assert.equal(
    whitelist.length,
    1 + catalog.blobs.length + catalog.releases.length,
  );
  let bytes = 0;
  for (const blob of catalog.blobs) {
    assert.equal(blobIdentity(blob), blob.id);
    const archive = await readFile(join(out, blob.assetName));
    assert.equal(archive.length, blob.archiveBytes);
    assert.equal(sha256(archive), blob.archiveSha256);
    const files = readZip(archive);
    assert.equal(files.size, blob.files.length);
    for (const file of blob.files) {
      assert.equal(files.get(file.path)?.length, file.size);
      assert.equal(sha256(files.get(file.path)), file.sha256);
      bytes += file.size;
    }
    if (blob.kind === 'code')
      assert.ok(
        blob.files.every(
          (file) => !/\.(?:flac|wav|webp|png|ogg|svg)$/.test(file.path),
        ),
        'Code archive contains media',
      );
  }
  for (const release of catalog.releases) {
    assert.equal(releaseIdentity(release), release.releaseId);
    const offline = readZip(await readFile(join(out, release.offlineAsset)));
    const closure = [...new Set([release.code, ...release.resources])];
    assert.deepEqual(
      [...offline.keys()].sort(),
      [
        'catalog.json',
        'release.json',
        ...closure.map((id) => `blobs/${id}.zip`),
      ].sort(),
    );
    assert.equal(
      JSON.parse(offline.get('release.json')).releaseId,
      release.releaseId,
    );
    for (const id of closure)
      assert.equal(
        sha256(offline.get(`blobs/${id}.zip`)),
        catalog.blobs.find((blob) => blob.id === id).archiveSha256,
      );
  }
  const original = catalog.releases.find(
    (release) =>
      release.gameId === 'pokemon-encounters' &&
      release.variantId === 'original',
  );
  const expansion = catalog.releases.find(
    (release) =>
      release.gameId === 'pokemon-encounters' &&
      release.variantId === 'expansion',
  );
  if (original && expansion) {
    assert.equal(original.code, expansion.code);
    assert.ok(
      !Object.keys(original.resourceMap).some((id) =>
        id.includes('/expansion/'),
      ),
    );
    assert.ok(
      Object.keys(expansion.resourceMap).some((id) =>
        id.includes('/expansion/'),
      ),
    );
  }
  const source =
    "const images=import.meta.glob('../../../assets/games/modern-art/rules/illustrations-v2/*.webp',{eager:true,query:'?url',import:'default'});";
  const file = resolve('games/modern-art/ui/RulesGuide.tsx');
  const glob = mediaGlobs(source, file, resolve('.'));
  assert.ok(glob[0].keys.every((key) => key.startsWith('../../../assets/')));
  const transformed = gameResourcesPlugin(resolve('.')).transform(source, file);
  assert.ok(transformed.includes('resourceUrl'));
  assert.ok(!transformed.includes('import.meta.glob'));
  const resourceRef = 'a'.repeat(64);
  assert.equal(
    resourceUrl(
      'uno/audio/place-v1.flac',
      `http://127.0.0.1/game-packages/${resourceRef}/web/entry.js`,
    ),
    `/game-packages/${resourceRef}/resources/uno/audio/place-v1.flac`,
  );
  assert.equal(
    resourceUrl(
      'uno/audio/place-v1.flac',
      'http://127.0.0.1/games/uno/web/entry.js',
    ),
    '/games/uno/resources/uno/audio/place-v1.flac',
  );
  assert.equal(
    resourceUrl('uno/audio/place-v1.flac'),
    ' /assets/games/uno/audio/place-v1.flac'.trim(),
  );
  await mkdir('tmp', { recursive: true });
  const probe = await mkdtemp(resolve('tmp/game-resource-byte-proof-'));
  await writeFile(
    join(probe, 'entry.ts'),
    "import texture from './texture.webp';export default texture;",
  );
  await writeFile(join(probe, 'texture.webp'), Buffer.from([1, 2, 3]));
  const webProbe = {
    id: 'resource-byte-proof',
    kind: 'web',
    module: { id: 'probe', compatibility: {} },
    inputs: [join(probe, 'entry.ts')],
  };
  const resourceProbe = {
    ...webProbe,
    kind: 'resources',
    inputs: [join(probe, 'texture.webp')],
  };
  const webBefore = await inputsFor(webProbe),
    resourceBefore = await inputsFor(resourceProbe);
  await writeFile(join(probe, 'texture.webp'), Buffer.from([4, 5, 6]));
  assert.deepEqual(
    await inputsFor(webProbe),
    webBefore,
    'Media bytes changed code fingerprint',
  );
  assert.notDeepEqual(
    await inputsFor(resourceProbe),
    resourceBefore,
    'Media bytes failed to change resource fingerprint',
  );
  const result = {
    passed: true,
    releases: catalog.releases.length,
    blobs: catalog.blobs.length,
    installedUniqueBytes: bytes,
    publicationAssetCount: whitelist.length,
    checks: [
      'project-public-key',
      'blob-archive-and-file-hashes',
      'strict-offline-closure',
      'media-free-code',
      'variant-resource-isolation',
      'resource-byte-independent-code-fingerprint',
      'version-pinned-resource-urls',
      'catalog-asset-whitelist',
    ],
    verifiedAtUtc: new Date().toISOString(),
  };
  await writeFile(
    join(out, 'verification.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}
if (isDirectExecution(import.meta.url)) {
  const out = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6);
  console.log(JSON.stringify(await verifyGamePackages({ out })));
}
