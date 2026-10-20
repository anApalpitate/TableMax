import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createWriteStream } from 'node:fs';
import {
  readFile,
  writeFile,
  stat,
  lstat,
  mkdir,
  copyFile,
} from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, join, basename, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { PROJECT_GAME_PUBLIC_KEY } from '../../apps/server/src/game-packages/project-public-key.ts';
import { gameReleaseAssets } from './game-release-assets.mjs';
import { windowsExecutableName } from './windows-executable-name.mjs';
import {
  assertDeliveryPath,
  assertNoDeliveryLinks,
} from './delivery-paths.mjs';
import {
  loadIsolationEvidence,
  verifyInstallationPublication,
} from './installation-publication.mjs';
import { verifyPreservedRuntime } from './installation-verifier.mjs';
import { verifyOriginalExecutableAcceptance } from './original-executable-acceptance.mjs';
import { verifyGitHubRelease } from '../shared/application-update.mjs';
import {
  parsePublishedReplacement,
  publishedReleaseSnapshot,
  assertPublishedReleaseUnchanged,
  replacePublishedRelease,
} from './published-release-replacement.mjs';
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
const bytesHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = async (path) => bytesHash(await readFile(path));
const assertConfirmedBuild = async () => {
  try {
    await lstat(resolve('build-version.reservation.json'));
    assert.fail(
      'Confirm the accepted build revision before publication; build-version.reservation.json still exists',
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const repo = 'anApalpitate/TableMax';
const tag = `v${version}`;
const replaceDraft = process.argv.includes('--replace-draft');
const replacePublished = parsePublishedReplacement(process.argv.slice(2));
const createdDraftArguments = process.argv.filter((arg) =>
  arg.startsWith('--created-draft-id='),
);
assert.ok(!process.argv.includes('--created-draft-id'));
assert.ok(createdDraftArguments.length <= 1);
const createdDraftId = createdDraftArguments[0]?.slice(19);
if (createdDraftId !== undefined) {
  assert.match(createdDraftId, /^[0-9]+$/);
  assert.equal(replaceDraft, false);
}
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
const reviewedNotesBytes = await readFile(notes);
const reviewedNotes = reviewedNotesBytes.toString('utf8');
const reviewedNotesSha256 = bytesHash(reviewedNotesBytes);
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
    await verifyOriginalExecutableAcceptance({
      delivery,
      evidence:
        payloadIndex.originalExecutableAcceptance ??
        proof.originalExecutableAcceptance,
    });
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
      notes: reviewedNotes,
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
await assertConfirmedBuild();
assert.ok(
  createdDraftId === undefined || applicationUpdate,
  'Resuming a created draft requires an authenticated installer release',
);
const commit = await run('git', ['rev-parse', 'HEAD']);
const tagCommit = await run('git', ['rev-parse', `${tag}^{commit}`]);
if (!replaceDraft && !replacePublished)
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
let previous, reviewedPublishedBytes, publishedOptions;
if (replacePublished) {
  assert.ok(
    applicationUpdate,
    'Published replacement requires the authenticated installer gates',
  );
  const reviewedPath = resolve(replacePublished.reviewedReleasePath);
  assertNoDeliveryLinks(reviewedPath);
  reviewedPublishedBytes = await readFile(reviewedPath);
  assert.equal(
    bytesHash(reviewedPublishedBytes),
    replacePublished.reviewedReleaseSha256,
    'Reviewed release metadata changed',
  );
  const reviewed = JSON.parse(reviewedPublishedBytes);
  publishedOptions = {
    releaseId: replacePublished.releaseId,
    tag,
    assetNames: [windowsExecutableName(version, 'full'), basename(source)],
  };
  const expected = publishedReleaseSnapshot(reviewed, publishedOptions);
  previous = JSON.parse(
    await run('gh', [
      'api',
      `repos/${repo}/releases/${replacePublished.releaseId}`,
    ]),
  );
  assertPublishedReleaseUnchanged(expected, previous, publishedOptions);
}
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
// Keep every frozen input in the gate without exceeding Win32's command line.
const inputPaths = [...inputs];
const verifyFrozenSource = async () => {
  for (let offset = 0; offset < inputPaths.length; offset += 64) {
    const batch = inputPaths.slice(offset, offset + 64);
    assert.ok(
      batch.reduce((length, path) => length + path.length + 3, 256) < 24000,
      'Frozen source input batch exceeds the Windows command-line budget',
    );
    assert.equal(
      await run('git', ['diff', '--name-only', 'HEAD', '--', ...batch]),
      '',
      'Commit all frozen runtime source inputs before publishing',
    );
  }
};
await verifyFrozenSource();
await mkdir(publicDirectory, { recursive: true });
for (let i = 0; i < exes.length; i++) await copyFile(localExes[i], exes[i]);
const assets = [...exes, source];
if (replacePublished) {
  assert.equal(
    (await stat(exes[0])).size,
    applicationUpdate.description.bytes,
    'Public installer size differs from the accepted signed identity',
  );
  assert.equal(
    await hash(exes[0]),
    applicationUpdate.description.sha256,
    'Public installer SHA-256 differs from the accepted signed identity',
  );
}
let backup,
  publishedAudit,
  publishedBackupManifest,
  obsolete = [];
if (replacePublished) {
  const directory = resolve(
    'artifacts/maintenance',
    tag,
    `published-replacement-${Date.now()}-${randomUUID()}`,
  );
  assertNoDeliveryLinks(directory);
  backup = join(directory, 'previous');
  await mkdir(backup, { recursive: true });
  publishedAudit = join(directory, 'github-publication.json');
  const initial = {
    mode: 'replace-published',
    result: 'pending',
    phase: 'backing-up-reviewed-release',
    releaseId: previous.id,
    tag,
    sourceCommit: commit,
    tagCommit,
    tagObject,
    reviewedReleasePath: resolve(replacePublished.reviewedReleasePath),
    reviewedReleaseSha256: replacePublished.reviewedReleaseSha256,
    reviewedSnapshot: publishedReleaseSnapshot(previous, publishedOptions),
    backup,
  };
  await writeFile(publishedAudit, JSON.stringify(initial, null, 2) + '\n', {
    flag: 'wx',
  });
  try {
    await writeFile(
      join(backup, 'reviewed-release.json'),
      reviewedPublishedBytes,
      { flag: 'wx' },
    );
    await writeFile(
      join(backup, 'release-before.json'),
      JSON.stringify(previous, null, 2) + '\n',
      { flag: 'wx' },
    );
    await writeFile(join(backup, 'body-before.md'), previous.body, {
      flag: 'wx',
    });
    const saved = [];
    for (const asset of previous.assets) {
      const target = join(backup, asset.name);
      const downloaded = resolve(
        dirname(resolve(replacePublished.reviewedReleasePath)),
        asset.name,
      );
      let local = false;
      try {
        assertNoDeliveryLinks(downloaded);
        const entry = await stat(downloaded);
        assert(
          entry.isFile(),
          'Reviewed downloaded asset must be an ordinary file',
        );
        assert.equal(
          entry.size,
          asset.size,
          'Reviewed downloaded asset size changed',
        );
        assert.equal(
          await hash(downloaded),
          asset.digest.slice(7),
          'Reviewed downloaded asset SHA-256 changed',
        );
        await copyFile(downloaded, target);
        local = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (!local) {
        const child = spawn(
          'gh',
          [
            'api',
            `repos/${repo}/releases/assets/${asset.id}`,
            '--header',
            'Accept: application/octet-stream',
          ],
          { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let stderr = '';
        child.stderr.on('data', (bytes) => {
          stderr = (stderr + bytes.toString()).slice(-8192);
        });
        const completion = new Promise((accept, reject) => {
          child.once('error', reject);
          child.once('close', (code) =>
            code === 0
              ? accept()
              : reject(
                  new Error(
                    `Old release asset download failed (${code}): ${stderr}`,
                  ),
                ),
          );
        });
        await Promise.all([
          pipeline(child.stdout, createWriteStream(target, { flags: 'wx' })),
          completion,
        ]);
      }
      assert.equal(
        (await stat(target)).size,
        asset.size,
        'Old attachment backup size mismatch',
      );
      assert.equal(
        await hash(target),
        asset.digest.slice(7),
        'Old attachment backup SHA-256 mismatch',
      );
      saved.push({
        id: asset.id,
        name: asset.name,
        bytes: asset.size,
        sha256: asset.digest.slice(7),
        path: target,
        source: local ? downloaded : 'GitHub asset ID download',
      });
    }
    publishedBackupManifest = {
      reviewedReleaseSha256: replacePublished.reviewedReleaseSha256,
      releaseId: previous.id,
      files: await Promise.all(
        ['reviewed-release.json', 'release-before.json', 'body-before.md'].map(
          async (name) => ({
            name,
            path: join(backup, name),
            bytes: (await stat(join(backup, name))).size,
            sha256: await hash(join(backup, name)),
          }),
        ),
      ),
      assets: saved,
    };
    await writeFile(
      join(backup, 'asset-backups.json'),
      JSON.stringify(publishedBackupManifest, null, 2) + '\n',
      { flag: 'wx' },
    );
    await writeFile(
      publishedAudit,
      JSON.stringify(
        {
          ...initial,
          phase: 'reviewed-release-backed-up',
          backupManifest: publishedBackupManifest,
        },
        null,
        2,
      ) + '\n',
    );
  } catch (error) {
    await writeFile(
      publishedAudit,
      JSON.stringify({ ...initial, error: error.message }, null, 2) + '\n',
    );
    throw error;
  }
}
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
  mode: replacePublished
    ? 'replace-published'
    : replaceDraft
      ? 'replace-draft'
      : createdDraftId
        ? 'resume-created-draft'
        : 'new-release',
  ...(createdDraftId ? { createdDraftId } : {}),
  sourceCommit: commit,
  tagCommit,
  tagObject,
  ...(backup ? { backup, previousReleaseId: previous.id } : {}),
  ...(replacePublished
    ? {
        reviewedReleasePath: resolve(replacePublished.reviewedReleasePath),
        reviewedReleaseSha256: replacePublished.reviewedReleaseSha256,
        reviewedSnapshot: publishedReleaseSnapshot(previous, publishedOptions),
        backupManifest: publishedBackupManifest,
        backupManifestSha256: await hash(join(backup, 'asset-backups.json')),
        reviewedNotesSha256,
      }
    : {}),
  assets: await Promise.all(
    assets.map(async (path) => ({
      path,
      bytes: (await stat(path)).size,
      sha256: await hash(path),
    })),
  ),
};
const audit =
  publishedAudit ??
  (replaceDraft
    ? resolve(
        'artifacts/maintenance',
        tag,
        'pages-release-20261011',
        `github-draft-replacement-${Date.now()}.json`,
      )
    : resolve(evidence, 'github-publication.json'));
if (replaceDraft || replacePublished)
  await writeFile(
    audit,
    JSON.stringify(
      { ...record, result: 'pending', phase: 'preflight-complete' },
      null,
      2,
    ) + '\n',
    replacePublished ? undefined : { flag: 'wx' },
  );
if (replacePublished) {
  const updatePath = join(dirname(audit), 'reviewed-release-update.json');
  const update = { body: reviewedNotes, make_latest: 'true' };
  const updateBytes = Buffer.from(JSON.stringify(update) + '\n');
  await writeFile(updatePath, updateBytes, { flag: 'wx' });
  record.replacement = await replacePublishedRelease({
    reviewed: previous,
    options: publishedOptions,
    assets: record.assets.map((asset) => ({
      ...asset,
      name: basename(asset.path),
    })),
    approvedInstaller: applicationUpdate.description,
    body: reviewedNotes,
    fetchRelease: async () =>
      JSON.parse(
        await run('gh', [
          'api',
          `repos/${repo}/releases/${replacePublished.releaseId}`,
        ]),
      ),
    fetchLatest: async () =>
      JSON.parse(await run('gh', ['api', `repos/${repo}/releases/latest`])),
    deleteAsset: async (id) =>
      run('gh', [
        'api',
        '--method',
        'DELETE',
        `repos/${repo}/releases/assets/${id}`,
      ]),
    uploadAsset: async (asset) =>
      JSON.parse(
        await run('gh', [
          'api',
          '--method',
          'POST',
          `https://uploads.github.com/repos/${repo}/releases/${replacePublished.releaseId}/assets?name=${encodeURIComponent(asset.name)}`,
          '--header',
          'Content-Type: application/octet-stream',
          '--input',
          asset.path,
        ]),
      ),
    updateRelease: async (value) => {
      assert.deepEqual(value, update);
      assert.equal(
        await hash(updatePath),
        bytesHash(updateBytes),
        'Frozen release update request changed',
      );
      return run('gh', [
        'api',
        '--method',
        'PATCH',
        `repos/${repo}/releases/${replacePublished.releaseId}`,
        '--input',
        updatePath,
      ]);
    },
    verifyInputs: async () => {
      await assertConfirmedBuild();
      assert.equal(
        await hash(notes),
        reviewedNotesSha256,
        'Reviewed signed notes changed',
      );
      assert.equal(
        await hash(resolve(replacePublished.reviewedReleasePath)),
        replacePublished.reviewedReleaseSha256,
        'Reviewed old release metadata changed',
      );
      assert.equal(
        await run('git', ['rev-parse', 'HEAD']),
        commit,
        'Source commit changed during replacement',
      );
      assert.equal(
        await run('git', ['rev-parse', tag]),
        tagObject,
        'Existing tag object changed',
      );
      assert.ok(
        (
          await run('git', ['ls-remote', 'origin', `refs/tags/${tag}`])
        ).startsWith(tagObject + '\t'),
        'Remote tag changed during replacement',
      );
      await verifyFrozenSource();
      for (const asset of record.assets) {
        const actualBytes = (await stat(asset.path)).size;
        const actualSha256 = await hash(asset.path);
        assert.equal(
          actualBytes,
          asset.bytes,
          'Frozen replacement attachment size changed',
        );
        assert.equal(
          actualSha256,
          asset.sha256,
          'Frozen replacement attachment changed',
        );
        if (basename(asset.path) === applicationUpdate.description.assetName) {
          assert.equal(
            actualBytes,
            applicationUpdate.description.bytes,
            'Installer size no longer matches its accepted signed identity',
          );
          assert.equal(
            actualSha256,
            applicationUpdate.description.sha256,
            'Installer SHA-256 no longer matches its accepted signed identity',
          );
        }
      }
      assert.equal(
        await hash(join(backup, 'asset-backups.json')),
        record.backupManifestSha256,
        'Old release backup manifest changed',
      );
      for (const asset of [
        ...publishedBackupManifest.assets,
        ...publishedBackupManifest.files,
      ]) {
        assert.equal(
          (await stat(asset.path)).size,
          asset.bytes,
          'Old attachment backup size changed',
        );
        assert.equal(
          await hash(asset.path),
          asset.sha256,
          'Old attachment backup changed',
        );
      }
    },
    persistAudit: async (state) =>
      writeFile(audit, JSON.stringify({ ...record, ...state }, null, 2) + '\n'),
  });
} else if (replaceDraft) {
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
  let draftId = createdDraftId;
  if (!draftId) {
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
    // The REST tag endpoint omits unpublished releases. The CLI resolves drafts.
    const created = JSON.parse(
      await run('gh', [
        'release',
        'view',
        tag,
        '--repo',
        repo,
        '--json',
        'apiUrl',
      ]),
    );
    const apiPrefix = `https://api.github.com/repos/${repo}/releases/`;
    assert.ok(created.apiUrl.startsWith(apiPrefix));
    draftId = created.apiUrl.slice(apiPrefix.length);
    assert.match(draftId, /^[0-9]+$/);
  }
  const ready = JSON.parse(
    await run('gh', ['api', `repos/${repo}/releases/${draftId}`]),
  );
  assert.equal(String(ready.id), draftId);
  assert.equal(ready.tag_name, tag);
  assert.equal(ready.name, `TableMax ${tag}`);
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
if (replacePublished) {
  assert.equal(
    String(latest.id),
    replacePublished.releaseId,
    'Latest release must retain the reviewed release ID',
  );
  assert.ok(
    (await run('git', ['ls-remote', 'origin', `refs/tags/${tag}`])).startsWith(
      tagObject + '\t',
    ),
    'Original remote tag must remain unchanged',
  );
  const finalRelease = JSON.parse(
    await run('gh', [
      'api',
      `repos/${repo}/releases/${replacePublished.releaseId}`,
    ]),
  );
  assertPublishedReleaseUnchanged(
    record.replacement.expectedRemote,
    finalRelease,
    publishedOptions,
  );
}
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
