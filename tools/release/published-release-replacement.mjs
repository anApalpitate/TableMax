import assert from 'node:assert/strict';

const decimal = /^[1-9][0-9]*$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const sha256 = /^[a-f0-9]{64}$/;

function option(args, name) {
  assert(!args.includes(name), `Use ${name}=<value>`);
  const values = args.filter((arg) => arg.startsWith(name + '='));
  assert.equal(values.length, 1, `Provide exactly one ${name}=<value>`);
  const value = values[0].slice(name.length + 1);
  assert(value.length > 0, `Missing ${name} value`);
  return value;
}

export function parsePublishedReplacement(args) {
  assert(
    !args.some((arg) => arg.startsWith('--replace-published=')),
    'Use --replace-published without a value',
  );
  const replacements = args.filter((arg) => arg === '--replace-published');
  const related = [
    '--release-id',
    '--reviewed-release',
    '--reviewed-release-sha256',
  ];
  if (!replacements.length) {
    assert(
      !args.some((arg) =>
        related.some((name) => arg === name || arg.startsWith(name + '=')),
      ),
      'Published replacement options require --replace-published',
    );
    return null;
  }
  assert.equal(replacements.length, 1, 'Duplicate --replace-published');
  assert.equal(
    args.filter((arg) => arg === '--publish').length,
    1,
    'Published replacement requires explicit --publish',
  );
  assert(
    !args.some((arg) =>
      ['--replace-draft', '--draft-id', '--created-draft-id'].some(
        (name) => arg === name || arg.startsWith(name + '='),
      ),
    ),
    'Published and draft release modes are mutually exclusive',
  );
  const releaseId = option(args, '--release-id');
  assert.match(releaseId, decimal, 'Invalid reviewed release ID');
  const reviewedReleasePath = option(args, '--reviewed-release');
  const reviewedReleaseSha256 = option(args, '--reviewed-release-sha256');
  assert.match(
    reviewedReleaseSha256,
    sha256,
    'Invalid reviewed metadata SHA-256',
  );
  return { releaseId, reviewedReleasePath, reviewedReleaseSha256 };
}

function assetIdentity(asset, names) {
  assert(asset && typeof asset === 'object', 'Missing release asset');
  assert(
    Number.isSafeInteger(asset.id) && asset.id > 0,
    'Invalid release asset ID',
  );
  assert(
    names.includes(asset.name),
    'Unexpected published attachment: ' + asset.name,
  );
  assert(
    Number.isSafeInteger(asset.size) && asset.size > 0,
    'Invalid release asset size',
  );
  assert.match(
    asset.digest ?? '',
    digest,
    'Published attachment lacks a verified SHA-256',
  );
  assert(
    asset.state === undefined || asset.state === 'uploaded',
    'Release asset is not fully uploaded',
  );
  return {
    id: asset.id,
    name: asset.name,
    size: asset.size,
    digest: asset.digest,
  };
}

/** Ignore counters and response ordering, never identity, notes or asset bytes. */
export function publishedReleaseSnapshot(
  release,
  { releaseId, tag, assetNames },
  { complete = true } = {},
) {
  assert.match(tag, /^v1\.\d+\.\d+$/);
  assert.deepEqual(
    [...assetNames].sort(),
    [
      `TableMax-${tag.slice(1)}-installer-win-x64.exe`,
      `TableMax-${tag.slice(1)}-source.zip`,
    ].sort(),
    'Published replacement permits only the complete installer and matching source ZIP',
  );
  assert.equal(String(release.id), releaseId, 'Reviewed release ID changed');
  assert.equal(release.tag_name, tag, 'Reviewed release tag changed');
  assert.equal(
    release.name,
    `TableMax ${tag}`,
    'Reviewed release title changed',
  );
  assert.equal(
    release.draft,
    false,
    'Replacement requires an already published release',
  );
  assert.equal(
    release.prerelease,
    false,
    'Replacement cannot target a prerelease',
  );
  assert.notEqual(
    release.immutable,
    true,
    'An immutable release cannot be replaced',
  );
  assert.equal(
    typeof release.body,
    'string',
    'Reviewed release body must be preserved exactly',
  );
  assert.equal(assetNames.length, 2);
  assert.equal(new Set(assetNames).size, 2);
  assert(Array.isArray(release.assets), 'Missing release assets');
  const assets = release.assets
    .map((asset) => assetIdentity(asset, assetNames))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.equal(
    new Set(assets.map((asset) => asset.id)).size,
    assets.length,
    'Duplicate release asset ID',
  );
  assert.equal(
    new Set(assets.map((asset) => asset.name)).size,
    assets.length,
    'Duplicate release asset name',
  );
  assert(
    complete ? assets.length === 2 : assets.length <= 2,
    'Published replacement requires exactly the reviewed two attachments',
  );
  return {
    id: release.id,
    tag_name: release.tag_name,
    name: release.name,
    body: release.body,
    draft: release.draft,
    prerelease: release.prerelease,
    immutable: release.immutable ?? false,
    assets,
  };
}

export function assertPublishedReleaseUnchanged(
  expected,
  actual,
  options,
  { complete = true } = {},
) {
  assert.deepEqual(
    publishedReleaseSnapshot(actual, options, { complete }),
    expected,
    'Published release changed since its reviewed snapshot',
  );
}

export function orderedPublishedAssets(assets, { assetNames }) {
  assert.equal(
    assets.length,
    2,
    'Replacement has exactly two local attachments',
  );
  assert.deepEqual(
    assets.map((asset) => asset.name).sort(),
    [...assetNames].sort(),
    'Local attachments must match the reviewed published names',
  );
  for (const asset of assets) {
    assert(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
    assert.match(asset.sha256, sha256);
    assert.equal(typeof asset.path, 'string');
  }
  const source = assets.filter((asset) => asset.name.endsWith('-source.zip'));
  const installer = assets.filter((asset) =>
    asset.name.endsWith('-installer-win-x64.exe'),
  );
  assert.equal(source.length, 1, 'Missing source archive');
  assert.equal(installer.length, 1, 'Missing complete installer');
  return [...source, ...installer];
}

/** Side effects are injected; production calls this only after all shipping gates. */
export async function replacePublishedRelease({
  reviewed,
  options,
  assets,
  approvedInstaller,
  body,
  fetchRelease,
  fetchLatest,
  deleteAsset,
  uploadAsset,
  updateRelease,
  verifyInputs,
  persistAudit,
}) {
  assert.equal(typeof body, 'string', 'Replacement notes must be frozen text');
  let expected = publishedReleaseSnapshot(reviewed, options);
  const ordered = orderedPublishedAssets(assets, options);
  assert(
    approvedInstaller,
    'Published replacement requires the authenticated installer identity',
  );
  const installer = ordered.find(
    (asset) => asset.name === approvedInstaller.assetName,
  );
  assert(installer, 'Signed installer attachment name mismatch');
  assert.equal(
    installer.bytes,
    approvedInstaller.bytes,
    'Signed installer size mismatch',
  );
  assert.equal(
    installer.sha256,
    approvedInstaller.sha256,
    'Signed installer SHA-256 mismatch',
  );
  const completed = [];
  let phase = 'published-preflight';
  let lastUploadResponse;
  const checkpoint = async (next, details = {}) => {
    phase = next;
    await persistAudit({
      result: 'pending',
      phase,
      completed: structuredClone(completed),
      expectedRemote: structuredClone(expected),
      ...details,
    });
  };
  const unchanged = async () => {
    assertPublishedReleaseUnchanged(expected, await fetchRelease(), options, {
      complete: expected.assets.length === 2,
    });
    const latest = await fetchLatest();
    assert.equal(
      String(latest.id),
      options.releaseId,
      'Reviewed release must remain latest before another mutation',
    );
    assert.equal(latest.tag_name, options.tag, 'Latest release tag changed');
  };
  try {
    await checkpoint(phase);
    await unchanged();
    for (const file of ordered) {
      await unchanged();
      await verifyInputs();
      await unchanged();
      const previous = expected.assets.find(
        (asset) => asset.name === file.name,
      );
      assert(previous, 'Reviewed old attachment disappeared');
      await checkpoint('deleting-reviewed-asset', {
        activeAsset: file.name,
        oldAssetId: previous.id,
      });
      await deleteAsset(previous.id);
      completed.push({
        operation: 'delete',
        id: previous.id,
        name: previous.name,
      });
      expected = {
        ...expected,
        assets: expected.assets.filter((asset) => asset.id !== previous.id),
      };
      await checkpoint('reviewed-asset-deleted', { activeAsset: file.name });
      await unchanged();
      await verifyInputs();
      await unchanged();
      await checkpoint('uploading-replacement-asset', {
        activeAsset: file.name,
      });
      lastUploadResponse = await uploadAsset(file);
      await checkpoint('validating-uploaded-asset', {
        activeAsset: file.name,
        lastUploadResponse,
      });
      const uploaded = assetIdentity(lastUploadResponse, options.assetNames);
      assert.equal(
        uploaded.name,
        file.name,
        'Uploaded attachment has the wrong name',
      );
      assert.equal(
        uploaded.size,
        file.bytes,
        'Uploaded attachment size mismatch',
      );
      assert.equal(
        uploaded.digest,
        `sha256:${file.sha256}`,
        'Uploaded attachment SHA-256 mismatch',
      );
      expected = {
        ...expected,
        assets: [...expected.assets, uploaded].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      };
      completed.push({ operation: 'upload', ...uploaded });
      await unchanged();
      await checkpoint('replacement-asset-verified', {
        activeAsset: file.name,
      });
    }
    await unchanged();
    await verifyInputs();
    await unchanged();
    await checkpoint('updating-reviewed-notes');
    await updateRelease({ body, make_latest: 'true' });
    expected = { ...expected, body };
    await unchanged();
    const latest = await fetchLatest();
    assert.equal(
      String(latest.id),
      options.releaseId,
      'Replacement release must remain latest',
    );
    assert.equal(latest.tag_name, options.tag, 'Latest release tag changed');
    await checkpoint('replacement-ready-for-final-validation');
    return {
      releaseId: options.releaseId,
      latestReleaseId: latest.id,
      completed,
      expectedRemote: expected,
    };
  } catch (error) {
    await persistAudit({
      result: 'pending',
      phase,
      completed,
      expectedRemote: expected,
      ...(lastUploadResponse ? { lastUploadResponse } : {}),
      error: error.message,
    });
    throw error;
  }
}
