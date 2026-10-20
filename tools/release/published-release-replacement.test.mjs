import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parsePublishedReplacement,
  publishedReleaseSnapshot,
  assertPublishedReleaseUnchanged,
  orderedPublishedAssets,
  replacePublishedRelease,
} from './published-release-replacement.mjs';

const tag = 'v1.0.8';
const installer = 'TableMax-1.0.8-installer-win-x64.exe';
const source = 'TableMax-1.0.8-source.zip';
const options = {
  releaseId: '416648428',
  tag,
  assetNames: [installer, source],
};
const sha = (letter) => letter.repeat(64);
const clone = (value) => structuredClone(value);
const authorization = [
  '--publish',
  '--replace-published',
  '--release-id=416648428',
  '--reviewed-release=reviewed/release.json',
  `--reviewed-release-sha256=${sha('a')}`,
];
const oldRelease = () => ({
  id: 416648428,
  tag_name: tag,
  name: `TableMax ${tag}`,
  body: 'Reviewed old notes.\n',
  draft: false,
  prerelease: false,
  immutable: false,
  assets: [
    {
      id: 10,
      name: installer,
      size: 9,
      digest: `sha256:${sha('a')}`,
      state: 'uploaded',
    },
    {
      id: 11,
      name: source,
      size: 7,
      digest: `sha256:${sha('b')}`,
      state: 'uploaded',
    },
  ],
});
const localAssets = () => [
  {
    name: installer,
    bytes: 19,
    sha256: sha('c'),
    path: '/reviewed/new-installer.exe',
  },
  {
    name: source,
    bytes: 17,
    sha256: sha('d'),
    path: '/reviewed/new-source.zip',
  },
];

function simulation(hooks = {}) {
  const state = {
    remote: oldRelease(),
    operations: [],
    audits: [],
    reads: 0,
    inputChecks: 0,
    nextId: 20,
  };
  const dependencies = {
    reviewed: oldRelease(),
    options,
    assets: localAssets(),
    approvedInstaller: { assetName: installer, bytes: 19, sha256: sha('c') },
    body: 'Reviewed replacement notes.\n',
    fetchRelease: async () => {
      state.reads++;
      await hooks.fetchRelease?.(state);
      return clone(state.remote);
    },
    fetchLatest: async () =>
      typeof hooks.latest === 'function'
        ? hooks.latest(state)
        : (hooks.latest ?? {
            id: state.remote.id,
            tag_name: state.remote.tag_name,
          }),
    deleteAsset: async (id) => {
      await hooks.beforeDelete?.(state, id);
      const asset = state.remote.assets.find((item) => item.id === id);
      assert(asset, 'The fake transport only deletes a present asset by ID');
      state.operations.push({ operation: 'delete', id, name: asset.name });
      state.remote.assets = state.remote.assets.filter(
        (item) => item.id !== id,
      );
    },
    uploadAsset: async (file) => {
      assert(
        !state.remote.assets.some((item) => item.name === file.name),
        'No upload may clobber a remote attachment',
      );
      const asset = {
        id: state.nextId++,
        name: file.name,
        size: file.bytes,
        digest: `sha256:${file.sha256}`,
        state: 'uploaded',
      };
      await hooks.upload?.(state, asset);
      state.remote.assets.push(asset);
      state.operations.push({
        operation: 'upload',
        id: asset.id,
        name: asset.name,
      });
      return clone(asset);
    },
    updateRelease: async (request) => {
      assert.deepEqual(request, {
        body: dependencies.body,
        make_latest: 'true',
      });
      await hooks.beforeUpdate?.(state, request);
      state.operations.push({ operation: 'notes', request: clone(request) });
      state.remote.body = request.body;
    },
    verifyInputs: async () => {
      state.inputChecks++;
      await hooks.verifyInputs?.(state);
    },
    persistAudit: async (record) => state.audits.push(clone(record)),
  };
  return {
    state,
    dependencies,
    execute: () => replacePublishedRelease(dependencies),
  };
}

test('published replacement requires explicit, unique authorization bound to reviewed metadata', () => {
  assert.deepEqual(parsePublishedReplacement(authorization), {
    releaseId: options.releaseId,
    reviewedReleasePath: 'reviewed/release.json',
    reviewedReleaseSha256: sha('a'),
  });
  assert.equal(
    parsePublishedReplacement([
      '--publish',
      '--replace-draft',
      '--draft-id=123',
    ]),
    null,
  );
  for (const name of [
    '--publish',
    '--release-id=',
    '--reviewed-release=',
    '--reviewed-release-sha256=',
  ]) {
    assert.throws(() =>
      parsePublishedReplacement(
        authorization.filter((arg) => !arg.startsWith(name)),
      ),
    );
  }
  for (const extra of [
    '--replace-published',
    '--replace-published=true',
    '--replace-draft',
    '--draft-id=123',
    '--created-draft-id=123',
    '--release-id=123',
    `--reviewed-release-sha256=${sha('b')}`,
  ]) {
    assert.throws(() => parsePublishedReplacement([...authorization, extra]));
  }
  for (const replacement of [
    '--release-id=0',
    '--release-id=-1',
    '--release-id=1.5',
    '--release-id=416648428x',
    '--reviewed-release=',
    '--reviewed-release-sha256=abc',
  ]) {
    const name = replacement.slice(0, replacement.indexOf('='));
    assert.throws(() =>
      parsePublishedReplacement([
        ...authorization.filter((arg) => !arg.startsWith(name + '=')),
        replacement,
      ]),
    );
  }
  assert.throws(() =>
    parsePublishedReplacement(['--publish', '--release-id=416648428']),
  );
  assert.throws(() =>
    parsePublishedReplacement([
      ...authorization.filter((arg) => !arg.startsWith('--release-id=')),
      '--release-id',
      '416648428',
    ]),
  );
});

test('reviewed snapshot normalizes only incidental counters and attachment ordering', () => {
  const expected = publishedReleaseSnapshot(oldRelease(), options);
  const fetched = oldRelease();
  fetched.assets.reverse();
  fetched.assets[0].download_count = 123;
  fetched.updated_at = 'later';
  assertPublishedReleaseUnchanged(expected, fetched, options);
  assert.deepEqual(
    Object.keys(expected).sort(),
    [
      'id',
      'tag_name',
      'name',
      'body',
      'draft',
      'prerelease',
      'immutable',
      'assets',
    ].sort(),
  );
  assert.deepEqual(
    Object.keys(expected.assets[0]).sort(),
    ['id', 'name', 'size', 'digest'].sort(),
  );
  for (const mutate of [
    (release) => release.id++,
    (release) => {
      release.tag_name = 'v1.0.7';
    },
    (release) => {
      release.name = 'Different release';
    },
    (release) => {
      release.body += ' ';
    },
    (release) => {
      release.draft = true;
    },
    (release) => {
      release.prerelease = true;
    },
    (release) => {
      release.immutable = true;
    },
    (release) => {
      release.assets[0].id++;
    },
    (release) => {
      release.assets[0].size++;
    },
    (release) => {
      release.assets[0].digest = `sha256:${sha('f')}`;
    },
  ]) {
    const changed = oldRelease();
    mutate(changed);
    assert.throws(() =>
      assertPublishedReleaseUnchanged(expected, changed, options),
    );
  }
});

test('published replacement refuses missing, unrelated, duplicate and unverified attachments', () => {
  for (const mutate of [
    (release) => release.assets.pop(),
    (release) =>
      release.assets.push({
        ...release.assets[0],
        id: 99,
        name: 'unrelated.txt',
      }),
    (release) => {
      release.assets[0].name = '../escape.exe';
    },
    (release) => {
      release.assets[0].name = source;
    },
    (release) => {
      release.assets[0].id = release.assets[1].id;
    },
    (release) => {
      release.assets[0].size = 0;
    },
    (release) => {
      release.assets[0].id = '10';
    },
    (release) => {
      delete release.assets[0].digest;
    },
    (release) => {
      release.assets[0].state = 'starter';
    },
  ]) {
    const changed = oldRelease();
    mutate(changed);
    assert.throws(() => publishedReleaseSnapshot(changed, options));
  }
  assert.throws(() =>
    publishedReleaseSnapshot(oldRelease(), {
      ...options,
      assetNames: [installer, 'unrelated.zip'],
    }),
  );
  const local = localAssets();
  assert.deepEqual(
    orderedPublishedAssets(local, options).map((asset) => asset.name),
    [source, installer],
  );
  assert.deepEqual(
    local.map((asset) => asset.name),
    [installer, source],
  );
  assert.throws(() => orderedPublishedAssets(local.slice(0, 1), options));
  assert.throws(() =>
    orderedPublishedAssets(
      [local[0], { ...local[1], name: 'unrelated.zip' }],
      options,
    ),
  );
  assert.throws(() =>
    orderedPublishedAssets(
      [local[0], { ...local[1], sha256: 'unverified' }],
      options,
    ),
  );
});

test('replacement uploads source then installer by reviewed asset IDs and updates only notes/latest last', async () => {
  const run = simulation();
  const result = await run.execute();
  assert.deepEqual(run.state.operations, [
    { operation: 'delete', id: 11, name: source },
    { operation: 'upload', id: 20, name: source },
    { operation: 'delete', id: 10, name: installer },
    { operation: 'upload', id: 21, name: installer },
    {
      operation: 'notes',
      request: { body: run.dependencies.body, make_latest: 'true' },
    },
  ]);
  assert.equal(run.state.remote.id, 416648428);
  assert.equal(run.state.remote.tag_name, tag);
  assert.equal(run.state.remote.draft, false);
  assert.equal(run.state.remote.prerelease, false);
  assert.equal(run.state.remote.assets.length, 2);
  assert.equal(result.latestReleaseId, 416648428);
  assert.deepEqual(
    result.expectedRemote,
    publishedReleaseSnapshot(run.state.remote, options),
  );
  assert.equal(run.state.audits.at(-1).result, 'pending');
  assert.equal(
    run.state.audits.at(-1).phase,
    'replacement-ready-for-final-validation',
  );
  assert(run.state.audits.every((audit) => audit.result === 'pending'));
});

test('remote metadata race before replacement preserves every existing attachment', async () => {
  const run = simulation({
    fetchRelease: (state) => {
      state.remote.body = 'Concurrent edit';
    },
  });
  await assert.rejects(run.execute(), /changed since its reviewed snapshot/);
  assert.deepEqual(run.state.operations, []);
  assert.equal(run.state.remote.assets.length, 2);
  assert.match(
    run.state.audits.at(-1).error,
    /changed since its reviewed snapshot/,
  );
});

test('a self-consistent local installer record cannot replace the accepted signed identity', async () => {
  for (const mutate of [
    (dependencies) => {
      dependencies.assets[0].sha256 = sha('f');
    },
    (dependencies) => {
      dependencies.assets[0].bytes++;
    },
    (dependencies) => {
      dependencies.approvedInstaller.assetName = 'unrelated.exe';
    },
    (dependencies) => {
      delete dependencies.approvedInstaller;
    },
  ]) {
    const run = simulation();
    mutate(run.dependencies);
    await assert.rejects(
      run.execute(),
      /Signed installer|authenticated installer identity/,
    );
    assert.deepEqual(run.state.operations, []);
    assert.deepEqual(run.state.remote, oldRelease());
  }
});

test('remote race during local input verification is reread before destructive operations', async () => {
  const run = simulation({
    verifyInputs: (state) => {
      state.remote.assets[0].digest = `sha256:${sha('f')}`;
    },
  });
  await assert.rejects(run.execute(), /changed since its reviewed snapshot/);
  assert.deepEqual(run.state.operations, []);
  assert.equal(run.state.audits.at(-1).result, 'pending');
});

test('local preflight failure performs no remote mutation and leaves pending audit', async () => {
  const run = simulation({
    verifyInputs: () => {
      throw new Error('Backup or replacement input changed');
    },
  });
  await assert.rejects(run.execute(), /Backup or replacement input changed/);
  assert.deepEqual(run.state.operations, []);
  assert.match(
    run.state.audits.at(-1).error,
    /Backup or replacement input changed/,
  );
});

test('a concurrent same-name attachment after deletion is preserved instead of overwritten', async () => {
  const run = simulation({
    verifyInputs: (state) => {
      if (state.inputChecks === 2) {
        state.remote.assets.push({
          id: 99,
          name: source,
          size: 7,
          digest: `sha256:${sha('b')}`,
          state: 'uploaded',
        });
      }
    },
  });
  await assert.rejects(run.execute(), /changed since its reviewed snapshot/);
  assert.deepEqual(run.state.operations, [
    { operation: 'delete', id: 11, name: source },
  ]);
  assert(run.state.remote.assets.some((asset) => asset.id === 99));
  assert(run.state.remote.assets.some((asset) => asset.id === 10));
  assert.equal(run.state.audits.at(-1).result, 'pending');
});

test('a remote body race after both uploads prevents the final notes mutation', async () => {
  const run = simulation({
    verifyInputs: (state) => {
      if (state.inputChecks === 5) state.remote.body = 'Concurrent final notes';
    },
  });
  await assert.rejects(run.execute(), /changed since its reviewed snapshot/);
  assert.equal(run.state.operations.length, 4);
  assert.equal(run.state.remote.body, 'Concurrent final notes');
  assert.equal(run.state.audits.at(-1).result, 'pending');
});

test('unrelated remote asset appearing after source upload aborts before installer deletion', async () => {
  const run = simulation({
    upload: (state) =>
      state.remote.assets.push({
        id: 99,
        name: 'someone-elses.txt',
        size: 1,
        digest: `sha256:${sha('f')}`,
        state: 'uploaded',
      }),
  });
  await assert.rejects(run.execute(), /Unexpected published attachment/);
  assert.deepEqual(
    run.state.operations.map(({ operation, name }) => [operation, name]),
    [
      ['delete', source],
      ['upload', source],
    ],
  );
  assert(run.state.remote.assets.some((asset) => asset.id === 99));
  assert(run.state.remote.assets.some((asset) => asset.id === 10));
  assert.equal(run.state.audits.at(-1).result, 'pending');
});

test('unexpected upload digest remains pending and records the returned attachment identity', async () => {
  const run = simulation({
    upload: (_state, asset) => {
      asset.digest = `sha256:${sha('f')}`;
    },
  });
  await assert.rejects(run.execute(), /SHA-256 mismatch/);
  assert.deepEqual(
    run.state.operations.map(({ operation, name }) => [operation, name]),
    [
      ['delete', source],
      ['upload', source],
    ],
  );
  const audit = run.state.audits.at(-1);
  assert.equal(audit.result, 'pending');
  assert.equal(audit.phase, 'validating-uploaded-asset');
  assert.equal(audit.lastUploadResponse.id, 20);
  assert.equal(audit.lastUploadResponse.digest, `sha256:${sha('f')}`);
  assert(run.state.remote.assets.some((asset) => asset.id === 10));
});

test('failed deletion does not upload or retry and keeps the old remote bytes', async () => {
  const run = simulation({
    beforeDelete: () => {
      throw new Error('Delete request failed');
    },
  });
  await assert.rejects(run.execute(), /Delete request failed/);
  assert.deepEqual(run.state.operations, []);
  assert.deepEqual(run.state.remote, oldRelease());
  assert.equal(run.state.audits.at(-1).phase, 'deleting-reviewed-asset');
});

test('notes failure and latest identity mismatch retain pending evidence without recovery writes', async () => {
  const notesFailure = simulation({
    beforeUpdate: () => {
      throw new Error('Patch request uncertain');
    },
  });
  await assert.rejects(notesFailure.execute(), /Patch request uncertain/);
  assert.equal(notesFailure.state.operations.length, 4);
  assert.equal(notesFailure.state.remote.body, oldRelease().body);
  assert.equal(
    notesFailure.state.audits.at(-1).phase,
    'updating-reviewed-notes',
  );
  const latestMismatch = simulation({ latest: { id: 123, tag_name: tag } });
  await assert.rejects(latestMismatch.execute(), /remain latest/);
  assert.equal(latestMismatch.state.operations.length, 0);
  assert.equal(latestMismatch.state.audits.at(-1).result, 'pending');
  assert.equal(latestMismatch.state.remote.assets.length, 2);
});

test('another release becoming latest stops before deleting the reviewed installer', async () => {
  const run = simulation({
    latest: (state) =>
      state.operations.length >= 2
        ? { id: 123, tag_name: 'v1.0.9' }
        : { id: state.remote.id, tag_name: state.remote.tag_name },
  });
  await assert.rejects(run.execute(), /remain latest/);
  assert.equal(run.state.operations.length, 2);
  assert(run.state.remote.assets.some((asset) => asset.id === 10));
  assert.equal(run.state.remote.body, oldRelease().body);
  assert.equal(run.state.audits.at(-1).result, 'pending');
});
