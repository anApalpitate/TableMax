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
import { GAME_PAGES_ROOT } from '../../apps/server/src/game-packages/distribution.ts';
import { PROJECT_GAME_PUBLIC_KEY } from '../../apps/server/src/game-packages/project-public-key.ts';
import { gameReleaseAssets } from './game-release-assets.mjs';
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
  ['box', 'full'],
  'Publication requires both verified Windows editions',
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
const exes = ['full', 'box'].map((edition) =>
  resolve(`artifacts/releases/TableMax-${version}-win-x64-${edition}.exe`),
);
const source = resolve(`artifacts/releases/TableMax-${version}-source.zip`);
for (const edition of ['full', 'box']) {
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
  assert.equal(
    proof.executableBytes,
    (await stat(delivery.executable.path)).size,
  );
  assert.equal(
    await hash(exes.find((path) => path.endsWith(`-${edition}.exe`))),
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
const devkit = process.argv
  .find((arg) => arg.startsWith('--devkit='))
  ?.slice(9);
assert.ok(
  devkit,
  'Provide the independently verified developer toolkit with --devkit=<zip>',
);
assert.ok(
  /^TableMax-author-toolkit-[A-Za-z0-9._-]+\.zip$/.test(
    devkit.split(/[\\/]/).at(-1),
  ),
  'Invalid developer toolkit name',
);
const pagesManifest = process.argv
  .find((arg) => arg.startsWith('--pages-manifest='))
  ?.slice(17);
assert.ok(
  pagesManifest,
  'Provide reviewed Pages manifest with --pages-manifest=<file>',
);
const pages = JSON.parse(await readFile(resolve(pagesManifest), 'utf8'));
assert.equal(pages.tag, tag);
assert.equal(pages.root, GAME_PAGES_ROOT);
assert.ok(pages.bytes <= 1_000_000_000 && pages.files.length > 0);
// A local preparation never proves deployment. Verify exact public bytes first.
const publicFiles = pages.files.filter(
  (file) => !(file.path === '.nojekyll' && file.deploymentOnly === true),
);
const pagesProofPath = process.argv
  .find((arg) => arg.startsWith('--pages-proof='))
  ?.slice(14);
let verifiedPublicFiles = publicFiles;
if (pagesProofPath) {
  const checked = JSON.parse(await readFile(resolve(pagesProofPath), 'utf8'));
  assert.equal(checked.result, 'passed');
  assert.equal(checked.root, GAME_PAGES_ROOT);
  assert.equal(checked.tag, tag);
  const age = Date.now() - Date.parse(checked.verifiedAt);
  assert.ok(
    age >= 0 && age < 60 * 60 * 1000,
    'Pages byte evidence must be under one hour old',
  );
  assert.match(checked.staticCommit, /^[a-f0-9]{40}$/);
  assert.ok(
    (
      await run('git', ['ls-remote', 'origin', 'refs/heads/gh-pages'])
    ).startsWith(checked.staticCommit + '\t'),
    'Pages source changed since verification',
  );
  assert.equal(checked.checks.length, publicFiles.length);
  assert.equal(
    new Set(checked.checks.map((item) => item.url)).size,
    publicFiles.length,
  );
  for (const file of publicFiles) {
    const prior = checked.checks.find(
      (item) => item.url === new URL(file.path, GAME_PAGES_ROOT).href,
    );
    assert.ok(
      prior && prior.bytes === file.bytes && prior.sha256 === file.sha256,
      'Pages evidence does not match current manifest',
    );
  }
  // Immutable files were already checked against the unchanged deployment.
  // Recheck its mutable catalog immediately before publication.
  verifiedPublicFiles = publicFiles.filter(
    (file) => file.path === `games/${tag}/catalog.json`,
  );
  assert.equal(verifiedPublicFiles.length, 1);
}
for (let offset = 0; offset < verifiedPublicFiles.length; offset += 4) {
  const results = await Promise.allSettled(
    verifiedPublicFiles.slice(offset, offset + 4).map(async (file) => {
      const url = new URL(file.path, GAME_PAGES_ROOT);
      assert.equal(url.origin, new URL(GAME_PAGES_ROOT).origin);
      assert.ok(url.pathname.startsWith('/TableMax/'));
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120000),
        cache: 'no-store',
      });
      assert.ok(response.ok, 'Pages directory is not published: ' + url);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, file.bytes);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        file.sha256,
        'Pages published bytes mismatch: ' + url,
      );
    }),
  );
  for (const result of results)
    if (result.status === 'rejected') throw result.reason;
}
const assets = [...exes, source, resolve(devkit)];
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
  for (const asset of gameAssets) {
    const retained =
      asset.name === `TableMax-game-catalog-${tag}.json`
        ? pages.files.find(
            (file) =>
              file.path.includes('/history/') &&
              file.bytes === asset.bytes &&
              file.sha256 === asset.sha256,
          )
        : pages.files.find(
            (file) =>
              file.path === `games/${tag}/packages/${asset.name}` &&
              file.bytes === asset.bytes &&
              file.sha256 === asset.sha256,
          );
    assert.ok(
      retained,
      'Pages must preserve exact previous game attachment before removal: ' +
        asset.name,
    );
  }
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
  commit,
  tag,
  repo,
  mode: replaceDraft ? 'replace-draft' : 'new-release',
  sourceCommit: commit,
  pagesManifest: resolve(pagesManifest),
  ...(pagesProofPath ? { pagesByteProof: resolve(pagesProofPath) } : {}),
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
    4,
    'Draft must have exactly four verified assets before becoming public',
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
  'Public release must contain only full/box EXEs, source ZIP and verified author toolkit; game packages are on Pages',
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
