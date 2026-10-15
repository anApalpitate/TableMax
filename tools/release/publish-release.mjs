import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, basename } from 'node:path';
import { PROJECT_GAME_PUBLIC_KEY } from '../../apps/server/src/game-packages/project-public-key.ts';
import { gameReleaseAssets } from './game-release-assets.mjs';
import { windowsExecutableName } from './windows-executable-name.mjs';
import { assertDeliveryPath } from './delivery-paths.mjs';
import {
  loadIsolationEvidence,
  verifyInstallationPublication,
} from './installation-publication.mjs';
import { verifyPreservedRuntime } from './installation-verifier.mjs';
import { verifyGitHubRelease } from '../shared/application-update.mjs';
assert.ok(
  process.argv.includes('--publish'),
  'Publication is disabled by default. Explicit user release authorization and --publish are required.',
);
const run = async (command, args) =>
  (
    await promisify(execFile)(command, args, {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })
  ).stdout.trim();
const hash = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const repo = 'anApalpitate/TableMax';
const tag = `v${version}`;
const replaceDraft = process.argv.includes('--replace-draft');
const payloadIndex = JSON.parse(
  await readFile(
    resolve('artifacts/package-payloads', tag, 'current.json'),
    'utf8',
  ),
);
assert.equal(payloadIndex.version, version);
assert.deepEqual(
  payloadIndex.deliveries.map((item) => item.edition).sort(),
  ['full'],
  'Publication requires the verified complete Windows EXE',
);
const evidence = resolve(
  'artifacts/maintenance',
  tag,
  'windows-editions',
  payloadIndex.snapshot,
);
const notes = process.argv.find((arg) => arg.startsWith('--notes='))?.slice(8);
assert.ok(notes, 'Provide reviewed release notes with --notes=<file>');
await stat(notes);
const localExes = ['full'].map((edition) => {
  const delivery = payloadIndex.deliveries.find(
    (item) => item.edition === edition,
  );
  assert.equal(
    delivery.deliveryType,
    'installer',
    'Release requires a complete installer',
  );
  assert.equal(delivery.executable.type, 'installer');
  return assertDeliveryPath({
    version,
    buildVersion: payloadIndex.buildVersion ?? version,
    edition,
    path: delivery.executable.path,
  });
});
const publicDirectory = resolve(
  'artifacts/maintenance',
  tag,
  'public-assets',
  payloadIndex.snapshot,
);
const exes = ['full'].map((edition) =>
  join(publicDirectory, windowsExecutableName(version, edition)),
);
const source = resolve(`artifacts/releases/TableMax-${version}-source.zip`);
let applicationUpdate;
for (const edition of ['full']) {
  const proof = JSON.parse(
    await readFile(
      resolve(evidence, `shipping-executable-checks-${edition}.json`),
      'utf8',
    ),
  );
  assert.equal(proof.result, 'passed');
  assert.equal(proof.snapshot, payloadIndex.snapshot);
  assert.equal(proof.edition, edition);
  const delivery = payloadIndex.deliveries.find(
    (item) => item.edition === edition,
  );
  const payloadManifest = JSON.parse(
    await readFile(delivery.manifestPath, 'utf8'),
  );
  assert.equal(payloadManifest.edition, edition);
  assert.equal(payloadManifest.snapshot, payloadIndex.snapshot);
  assert.equal(proof.payloadSha256, payloadManifest.archive.sha256);
  if (delivery.deliveryType === 'installer') {
    applicationUpdate = verifyInstallationPublication({
      delivery,
      proof,
      payloadManifest,
      payloadManifestSha256: await hash(delivery.manifestPath),
      payloadManifestByteLength: (await stat(delivery.manifestPath)).size,
      ...(await loadIsolationEvidence(proof)),
      installationManifest: JSON.parse(
        await readFile(delivery.executable.installation.manifestPath, 'utf8'),
      ),
      installationManifestSha256: await hash(
        delivery.executable.installation.manifestPath,
      ),
      snapshot: payloadIndex.snapshot,
      notes: await readFile(notes, 'utf8'),
      releaseVersion: version,
      buildVersion: payloadIndex.buildVersion,
    });
    await verifyPreservedRuntime({
      copy: proof.verifiedRuntime,
      delivery,
      payloadBytes: await readFile(delivery.manifestPath),
      sourceRuntimeRoot: proof.runtimeRoot,
      installationId: proof.installationId,
    });
  }
  assert.equal(
    proof.executableBytes,
    (await stat(delivery.executable.path)).size,
  );
  assert.equal(
    await hash(localExes[['full'].indexOf(edition)]),
    proof.executableSha256,
    'Shipping EXE changed after validation',
  );
}
const commit = await run('git', ['rev-parse', 'HEAD']);
const tagCommit = await run('git', ['rev-parse', `${tag}^{commit}`]);
if (!replaceDraft)
  assert.equal(
    tagCommit,
    commit,
    'Release tag must point to current source commit',
  );
const tagObject = await run('git', ['rev-parse', tag]);
assert.ok(
  (await run('git', ['ls-remote', 'origin', `refs/tags/${tag}`])).startsWith(
    tagObject + '\t',
  ),
  'Push verified release tag first',
);
let previous;
if (replaceDraft) {
  const draftId = process.argv
    .find((arg) => arg.startsWith('--draft-id='))
    ?.slice(11);
  assert.match(
    draftId ?? '',
    /^[0-9]+$/,
    'Provide the reviewed existing draft ID with --draft-id=<id>',
  );
  previous = JSON.parse(
    await run('gh', ['api', `repos/${repo}/releases/${draftId}`]),
  );
  assert.equal(
    previous.draft,
    true,
    'Replacement requires an existing draft; published releases cannot be replaced',
  );
  assert.equal(previous.tag_name, tag);
  assert.equal(previous.prerelease, false);
}
const manifest = JSON.parse(
  await readFile(payloadIndex.deliveries[0].manifestPath, 'utf8'),
);
const inputs = new Set([
  'apps/desktop/release/Launcher.cs',
  'apps/desktop/native/LegacyGames.cs',
]);
for (const item of payloadIndex.deliveries) {
  if (item.deliveryType !== 'installer') continue;
  for (const file of item.executable.installation.recipe.inputs) {
    assert.equal(
      await hash(file.path),
      file.sha256,
      'Installer recipe changed after freezing: ' + file.path,
    );
    await run('git', ['ls-files', '--error-unmatch', '--', file.path]);
    inputs.add(file.path);
  }
}
for (const unit of manifest.units) {
  const record = JSON.parse(
    await readFile(
      resolve(
        '.cache/build-modules/v1',
        unit.id,
        unit.fingerprint,
        'manifest.json',
      ),
      'utf8',
    ),
  );
  for (const file of record.inputs.files) inputs.add(file.path);
}
assert.equal(
  await run('git', ['diff', '--name-only', 'HEAD', '--', ...inputs]),
  '',
  'Commit all frozen runtime source inputs before publishing',
);
await mkdir(publicDirectory, { recursive: true });
for (let i = 0; i < exes.length; i++) await copyFile(localExes[i], exes[i]);
const assets = [...exes, source];
let backup,
  obsolete = [];
if (replaceDraft) {
  const base = resolve('artifacts/maintenance', tag, 'pages-release-20261011');
  await mkdir(join(base, 'previous'), { recursive: true });
  backup = join(base, 'previous', `online-assets-${Date.now()}`);
  await mkdir(backup); // A replacement never overwrites prior audit/asset backups.
  await writeFile(
    join(backup, 'release-before.json'),
    JSON.stringify(previous, null, 2) + '\n',
    { flag: 'wx' },
  );
  let historical = [];
  try {
    historical = JSON.parse(
      await readFile(
        join(base, 'previous/github-release-20261005/github-publication.json'),
        'utf8',
      ),
    ).assets;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const backups = [];
  for (const asset of previous.assets) {
    assert.match(asset.name, /^[A-Za-z0-9._-]+$/);
    assert.match(
      asset.digest ?? '',
      /^sha256:[a-f0-9]{64}$/,
      'Old remote asset requires a verified SHA-256 digest',
    );
    const expected = asset.digest.slice(7);
    const candidates = [
      join(base, 'previous', asset.name),
      resolve('artifacts/game-packages', tag, asset.name),
      resolve('artifacts/releases', asset.name),
      ...historical
        .filter((file) => basename(file.path) === asset.name)
        .map((file) => file.path),
    ];
    let matched;
    for (const candidate of candidates) {
      try {
        if (
          (await stat(candidate)).isFile() &&
          (await stat(candidate)).size === asset.size &&
          (await hash(candidate)) === expected
        ) {
          matched = candidate;
          break;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    const target = join(backup, asset.name);
    if (matched) await copyFile(matched, target);
    else
      await run('gh', [
        'release',
        'download',
        tag,
        '--repo',
        repo,
        '--pattern',
        asset.name,
        '--dir',
        backup,
      ]);
    assert.equal((await stat(target)).size, asset.size);
    assert.equal(
      await hash(target),
      expected,
      'Previous attachment backup mismatch: ' + asset.name,
    );
    backups.push({
      id: asset.id,
      name: asset.name,
      bytes: asset.size,
      sha256: expected,
      path: target,
      source: matched ?? 'GitHub download',
    });
  }
  const hasLegacyCatalog = previous.assets.some(
    (asset) => asset.name === `TableMax-game-catalog-${tag}.json`,
  );
  const gameAssets = hasLegacyCatalog
    ? await gameReleaseAssets(backup, {
        publicKey: PROJECT_GAME_PUBLIC_KEY,
      })
    : [];
  if (hasLegacyCatalog)
    assert.equal(
      gameAssets.length,
      22,
      'Expected historical signed catalog plus 21 game packages',
    );
  const gameNames = new Set(gameAssets.map((asset) => asset.name));
  const newNames = new Set(assets.map((path) => basename(path)));
  const previousExe = `TableMax-${version}-win-x64.exe`;
  assert.ok(
    previous.assets.every(
      (asset) =>
        gameNames.has(asset.name) ||
        newNames.has(asset.name) ||
        asset.name === previousExe,
    ),
    'Unexpected old attachment: manual review required',
  );
  obsolete = previous.assets.filter(
    (asset) => gameNames.has(asset.name) || asset.name === previousExe,
  );
  await writeFile(
    join(backup, 'asset-backups.json'),
    JSON.stringify(backups, null, 2) + '\n',
    { flag: 'wx' },
  );
}
// Preserve old source attachments before producing the new source archive.
await run('git', [
  'archive',
  '--format=zip',
  `--prefix=TableMax-${version}/`,
  `--output=${source}`,
  commit,
]);
const record = {
  version,
  buildVersion: payloadIndex.buildVersion ?? version + '.0',
  snapshot: payloadIndex.snapshot,
  commit,
  tag,
  repo,
  mode: replaceDraft ? 'replace-draft' : 'new-release',
  sourceCommit: commit,
  tagCommit,
  tagObject,
  ...(backup ? { backup, previousReleaseId: previous.id } : {}),
  assets: await Promise.all(
    assets.map(async (path) => ({
      path,
      bytes: (await stat(path)).size,
      sha256: await hash(path),
    })),
  ),
};
const audit = replaceDraft
  ? resolve(
      'artifacts/maintenance',
      tag,
      'pages-release-20261011',
      `github-draft-replacement-${Date.now()}.json`,
    )
  : resolve(evidence, 'github-publication.json');
if (replaceDraft)
  await writeFile(
    audit,
    JSON.stringify(
      { ...record, result: 'pending', phase: 'preflight-complete' },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
if (replaceDraft) {
  // Re-read immediately before mutations: an already published draft is not authorized.
  const current = JSON.parse(
    await run('gh', ['api', `repos/${repo}/releases/${previous.id}`]),
  );
  assert.equal(current.draft, true, 'Draft changed during preflight');
  assert.deepEqual(
    current.assets.map((asset) => [asset.id, asset.name, asset.digest]).sort(),
    previous.assets.map((asset) => [asset.id, asset.name, asset.digest]).sort(),
    'Attachments changed during preflight',
  );
  await run('gh', [
    'release',
    'upload',
    tag,
    ...assets,
    '--repo',
    repo,
    '--clobber',
  ]);
  await writeFile(
    audit,
    JSON.stringify(
      { ...record, result: 'pending', phase: 'new-attachments-uploaded' },
      null,
      2,
    ) + '\n',
  );
  const uploaded = JSON.parse(
    await run('gh', ['api', `repos/${repo}/releases/${previous.id}`]),
  );
  for (const file of record.assets) {
    const asset = uploaded.assets.find(
      (item) => item.name === basename(file.path),
    );
    assert.ok(
      asset &&
        asset.size === file.bytes &&
        asset.digest === `sha256:${file.sha256}`,
      'New draft attachment mismatch before deleting old games',
    );
  }
  for (const asset of obsolete)
    await run('gh', [
      'api',
      '--method',
      'DELETE',
      `repos/${repo}/releases/assets/${asset.id}`,
    ]);
  const ready = JSON.parse(
    await run('gh', ['api', `repos/${repo}/releases/${previous.id}`]),
  );
  assert.equal(ready.draft, true);
  assert.equal(
    ready.assets.length,
    2,
    'Draft must have exactly two verified assets before becoming public',
  );
  for (const file of record.assets) {
    const asset = ready.assets.find(
      (item) => item.name === basename(file.path),
    );
    assert.ok(
      asset &&
        asset.size === file.bytes &&
        asset.digest === `sha256:${file.sha256}`,
      'Draft attachment changed before publication',
    );
  }
  await writeFile(
    audit,
    JSON.stringify(
      {
        ...record,
        result: 'pending',
        phase: 'old-game-attachments-removed',
        removedAssetIds: obsolete.map((asset) => asset.id),
      },
      null,
      2,
    ) + '\n',
  );
  await run('gh', [
    'release',
    'edit',
    tag,
    '--repo',
    repo,
    '--draft=false',
    '--prerelease=false',
    '--latest',
    '--title',
    `TableMax ${tag}`,
    '--notes-file',
    resolve(notes),
  ]);
} else if (applicationUpdate) {
  await run('gh', [
    'release',
    'create',
    tag,
    ...assets,
    '--repo',
    repo,
    '--verify-tag',
    '--draft',
    '--title',
    `TableMax ${tag}`,
    '--notes-file',
    resolve(notes),
  ]);
  const ready = JSON.parse(
    await run('gh', ['api', `repos/${repo}/releases/tags/${tag}`]),
  );
  assert.equal(ready.draft, true);
  assert.equal(ready.prerelease, false);
  assert.equal(
    ready.assets.length,
    2,
    'Installer release requires exactly two attachments',
  );
  assert.equal(ready.body.trim(), (await readFile(notes, 'utf8')).trim());
  for (const file of record.assets) {
    const asset = ready.assets.find(
      (item) => item.name === basename(file.path),
    );
    assert.ok(
      asset &&
        asset.size === file.bytes &&
        asset.digest === `sha256:${file.sha256}`,
      'Draft attachment differs from reviewed bytes',
    );
  }
  await run('gh', [
    'release',
    'edit',
    tag,
    '--repo',
    repo,
    '--draft=false',
    '--prerelease=false',
    '--latest',
  ]);
} else
  await run('gh', [
    'release',
    'create',
    tag,
    ...assets,
    '--repo',
    repo,
    '--verify-tag',
    '--latest',
    '--title',
    `TableMax ${tag}`,
    '--notes-file',
    resolve(notes),
  ]);
const online = JSON.parse(
  await run('gh', [
    'release',
    'view',
    tag,
    '--repo',
    repo,
    '--json',
    'url,assets,tagName,name,body,isDraft,isPrerelease',
  ]),
);
// Draft URLs may contain an untagged placeholder; use the published canonical URL.
const url = online.url;
assert.equal(online.isDraft, false);
assert.equal(online.isPrerelease, false);
assert.equal(online.tagName, tag);
assert.equal(online.name, `TableMax ${tag}`);
assert.equal(
  online.body.trim(),
  (await readFile(resolve(notes), 'utf8')).trim(),
  'Published notes must match reviewed notes',
);
assert.equal(
  online.assets.length,
  assets.length,
  'Public release must contain only the complete EXE and source ZIP',
);
for (const file of record.assets) {
  const name = file.path.split(/[\\/]/).at(-1);
  const asset = online.assets.find((item) => item.name === name);
  assert.ok(
    asset &&
      asset.size === file.bytes &&
      asset.digest === `sha256:${file.sha256}`,
    'Remote uploaded attachment mismatch: ' + name,
  );
}
assert.equal(
  await run('git', ['rev-parse', tag]),
  tagObject,
  'Existing tag object must remain unchanged',
);
assert.equal(
  await run('git', ['rev-parse', `${tag}^{commit}`]),
  tagCommit,
  'Existing tag commit must remain unchanged',
);
const latest = JSON.parse(
  await run('gh', ['api', `repos/${repo}/releases/latest`]),
);
if (applicationUpdate) {
  const published = JSON.parse(
    await run('gh', ['api', `repos/${repo}/releases/tags/${tag}`]),
  );
  verifyGitHubRelease(published, applicationUpdate.description);
  const finalProof = JSON.parse(
    await readFile(
      resolve(evidence, 'shipping-executable-checks-full.json'),
      'utf8',
    ),
  );
  const finalDescription = verifyInstallationPublication({
    delivery: payloadIndex.deliveries[0],
    proof: finalProof,
    payloadManifest: manifest,
    payloadManifestSha256: await hash(payloadIndex.deliveries[0].manifestPath),
    payloadManifestByteLength: (
      await stat(payloadIndex.deliveries[0].manifestPath)
    ).size,
    ...(await loadIsolationEvidence(finalProof)),
    installationManifest: JSON.parse(
      await readFile(
        payloadIndex.deliveries[0].executable.installation.manifestPath,
        'utf8',
      ),
    ),
    installationManifestSha256: await hash(
      payloadIndex.deliveries[0].executable.installation.manifestPath,
    ),
    snapshot: payloadIndex.snapshot,
    notes: published.body,
    releaseVersion: version,
    buildVersion: payloadIndex.buildVersion,
  });
  assert.equal(
    finalDescription.descriptionSha256,
    applicationUpdate.descriptionSha256,
    'Published authenticated body changed',
  );
}
assert.equal(latest.tag_name, tag, 'Published release must be latest');
await writeFile(
  audit,
  JSON.stringify(
    {
      ...record,
      result: 'passed',
      url,
      online,
      latestReleaseId: latest.id,
      removedAssetIds: obsolete.map((asset) => asset.id),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'passed',
    url,
    commit,
    tagCommit,
    tagObject,
    audit,
    assets: online.assets.map((item) => item.name),
  }),
);
