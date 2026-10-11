import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  createSignedCatalog,
  canonical,
  sha256,
} from './game-package-format.mjs';
import { gameReleaseAssets } from './game-release-assets.mjs';
import { preparePages } from './prepare-pages.mjs';
import { PROJECT_GAME_PUBLIC_KEY } from '../../apps/server/src/game-packages/project-public-key.ts';
import {
  verifyCatalog,
  readZip,
} from '../../apps/server/src/game-packages/verification.ts';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';

assertWorkspaceRoot();
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const current = resolve(option('current'));
const previous = resolve(option('previous'));
const out = resolve(option('out'));
const metadata = JSON.parse(
  await readFile(resolve(option('previous-release')), 'utf8'),
);
const tag = 'v1.0.6';
assert.equal(metadata.tag_name, tag);
await assert.rejects(lstat(out), { code: 'ENOENT' });
await mkdir(out, { recursive: true });
const staging = join(out, 'packages');
await mkdir(staging);
const catalogs = [];
const members = new Map();
const retainedOffline = [];
for (const directory of [current, previous]) {
  const bytes = await readFile(
    join(directory, `TableMax-game-catalog-${tag}.json`),
  );
  const envelope = JSON.parse(bytes);
  const catalog = verifyCatalog(envelope, PROJECT_GAME_PUBLIC_KEY);
  catalogs.push({ bytes, catalog });
  for (const asset of await gameReleaseAssets(directory, {
    publicKey: PROJECT_GAME_PUBLIC_KEY,
  })) {
    if (asset.name === `TableMax-game-catalog-${tag}.json`) continue;
    assert.equal((await lstat(asset.path)).isSymbolicLink(), false);
    const bytes = await readFile(asset.path);
    if (directory === previous) {
      const remote = metadata.assets.find((item) => item.name === asset.name);
      assert.ok(remote, 'Previous package absent from release audit');
      assert.equal(remote.size, bytes.length);
      assert.equal(remote.digest, `sha256:${sha256(bytes)}`);
    }
    const existing = members.get(asset.name.toLowerCase());
    if (existing && sha256(existing.bytes) !== sha256(bytes)) {
      // Old builders embedded the whole catalog; preserve the published archive.
      assert.ok(
        asset.name.endsWith('-offline.zip'),
        'Immutable blob filename collision',
      );
      const before = readZip(existing.bytes),
        after = readZip(bytes);
      assert.equal(before.size, after.size);
      assert.equal(
        before.get('release.json').toString(),
        after.get('release.json').toString(),
      );
      for (const [name, content] of before)
        if (name !== 'catalog.json')
          assert.equal(
            sha256(content),
            sha256(after.get(name)),
            'Offline dependency collision',
          );
      retainedOffline.push({
        name: asset.name,
        kept: sha256(bytes),
        candidate: sha256(existing.bytes),
        reason: 'Same release and dependencies; retain published archive',
      });
      members.set(asset.name.toLowerCase(), { name: asset.name, bytes });
    } else if (!existing)
      members.set(asset.name.toLowerCase(), { name: asset.name, bytes });
  }
}
const oldCatalogAsset = metadata.assets.find(
  (item) => item.name === `TableMax-game-catalog-${tag}.json`,
);
assert.equal(oldCatalogAsset.digest, `sha256:${sha256(catalogs[1].bytes)}`);
const merge = (field, key) => {
  const merged = new Map();
  for (const { catalog } of catalogs)
    for (const item of catalog[field]) {
      const prior = merged.get(item[key]);
      if (prior)
        assert.equal(
          canonical(prior),
          canonical(item),
          'Immutable identity collision',
        );
      else merged.set(item[key], item);
    }
  return [...merged.values()];
};
const payload = {
  ...catalogs[0].catalog,
  releases: merge('releases', 'releaseId'),
  blobs: merge('blobs', 'id'),
};
const signed = createSignedCatalog(
  payload,
  await readFile(resolve(option('key') ?? 'secrets/game-release-ed25519.pem')),
);
verifyCatalog(signed, PROJECT_GAME_PUBLIC_KEY);
for (const member of members.values())
  await writeFile(join(staging, member.name), member.bytes);
await writeFile(
  join(staging, `TableMax-game-catalog-${tag}.json`),
  JSON.stringify(signed, null, 2) + '\n',
);
const prepared = await preparePages({
  directory: staging,
  out: join(out, 'site'),
  tag,
});
const oldHash = sha256(catalogs[1].bytes);
const path = `games/${tag}/history/catalog-${oldHash}.json`;
await mkdir(join(prepared.directory, `games/${tag}/history`));
await writeFile(join(prepared.directory, path), catalogs[1].bytes);
prepared.files.push({
  path,
  bytes: catalogs[1].bytes.length,
  sha256: oldHash,
  url: prepared.root + path,
});
prepared.bytes += catalogs[1].bytes.length;
prepared.retainedOffline = retainedOffline;
assert.ok(prepared.bytes <= 1_000_000_000);
prepared.history = {
  previousCatalogSha256: oldHash,
  previousReleaseId: metadata.id,
  previousPackages: metadata.assets.filter(
    (asset) =>
      !/^(TableMax-1\.0\.6-(source\.zip|win-x64\.exe)|TableMax-author-toolkit-1\.0\.6\.zip)$/.test(
        asset.name,
      ),
  ),
  releases: payload.releases.map((item) => item.releaseId),
};
await writeFile(prepared.manifest, JSON.stringify(prepared, null, 2) + '\n');
console.log(
  JSON.stringify({
    result: prepared.result,
    files: prepared.files.length,
    bytes: prepared.bytes,
    releases: payload.releases.length,
    manifest: prepared.manifest,
  }),
);
