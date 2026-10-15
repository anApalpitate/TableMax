import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { compileInstallationProgram } from '../../release/installation-package.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { failureLimit } from '../runner/failure-policy.mjs';

// Fixture-only: real helper, real readonly Node/SQLite analysis and handle
// deletion; synthetic executable/module bytes never execute. The in-memory
// Ed25519 key replaces only the bundled planner's public game trust module.
const caseIds = [
  'same-root-migration',
  'nonempty-data',
  'cleanup-current',
  'cleanup-references',
  'cleanup-damaged',
  'cleanup-unknown-link',
];
const productId = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const workspace = resolve('.');
const sourcePaths = [
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateHelper.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'apps/desktop/installation-runtime/cleanup-plan.mjs',
  'apps/desktop/native/LegacyGames.cs',
  'apps/desktop/native/app.manifest',
  'apps/desktop/native/ApplicationUpdateKeys.json',
  'apps/server/src/save-codec.mjs',
  'apps/server/src/game-packages/verification.ts',
  'apps/server/src/game-packages/project-public-key.ts',
  'tools/release/installation-package.mjs',
  'tools/release/installation-toolchain.mjs',
  'tools/release/installation-toolchain.json',
  'tools/release/package-limits.mjs',
  'tools/shared/application-version.mjs',
  'tools/shared/workspace-root.mjs',
  'tools/test/runner/failure-policy.mjs',
  'tools/test/installation/resource-cleanup-harness.cs',
  'tools/test/installation/verify-resource-cleanup.mjs',
  'global.json',
  'package.json',
  'pnpm-lock.yaml',
  'assets/platform/app-icon.ico',
];
const helperSources = sourcePaths.slice(0, 4).concat(sourcePaths[5]);
const options = new Map();
for (const argument of process.argv.slice(2)) {
  const match = /^--(only|prior-failures|evidence)=(.+)$/.exec(argument);
  assert(
    match && !options.has(match[1]),
    'Use unique known component options.',
  );
  options.set(match[1], match[2]);
}
const requested = options.has('only')
  ? options.get('only').split(',')
  : caseIds;
assert(
  requested.length &&
    requested.every((id) => caseIds.includes(id)) &&
    new Set(requested).size === requested.length,
  'Use unique known case IDs.',
);
const selected = caseIds.filter((id) => requested.includes(id));
const limit = failureLimit();
const priorText = options.get('prior-failures') ?? '0';
assert(
  /^(0|[1-9]\d*)$/.test(priorText) && Number(priorText) < limit,
  'Prior failures exceed the current execution budget.',
);
const priorFailures = Number(priorText);
assertWorkspaceRoot();
assert.equal(
  process.platform,
  'win32',
  'The actual net48 helper requires Windows.',
);

function below(parent, path) {
  const value = relative(resolve(parent), resolve(path));
  assert(
    value &&
      value !== '..' &&
      !value.startsWith('..' + sep) &&
      !value.includes(':'),
    'Use a private workspace descendant.',
  );
  return resolve(path);
}
async function noLinks(path) {
  for (let at = resolve(path); ; at = dirname(at)) {
    try {
      assert(!(await lstat(at)).isSymbolicLink(), 'Linked component input.');
    } catch (cause) {
      if (cause.code !== 'ENOENT') throw cause;
    }
    const parent = dirname(at);
    if (parent === at) break;
    try {
      const entry = (await readdir(parent, { withFileTypes: true })).find(
        (entry) =>
          entry.name.toLowerCase() === relative(parent, at).toLowerCase(),
      );
      assert(
        !entry?.isSymbolicLink(),
        'Linked component input directory entry.',
      );
    } catch (cause) {
      if (cause.code !== 'ENOENT') throw cause;
    }
  }
}
async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (cause) {
    if (cause.code === 'ENOENT') return false;
    throw cause;
  }
}
async function record(path) {
  await noLinks(path);
  const data = await readFile(path);
  return { path: resolve(path), bytes: data.length, sha256: sha(data) };
}
async function put(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { flag: 'wx' });
}
async function putJson(path, value) {
  await put(path, JSON.stringify(value, null, 2) + '\n');
}
async function inventory(root) {
  const rows = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name),
        info = await lstat(path);
      const name = relative(root, path).split(sep).join('/');
      if (entry.isSymbolicLink() || info.isSymbolicLink())
        rows.push({ path: name, kind: 'link' });
      else if (entry.isDirectory() && info.isDirectory()) {
        rows.push({ path: name, kind: 'directory' });
        await visit(path);
      } else {
        assert(entry.isFile() && info.isFile());
        const file = await record(path);
        rows.push({
          path: name,
          kind: 'file',
          bytes: file.bytes,
          sha256: file.sha256,
        });
      }
    }
  }
  if (await exists(root)) await visit(root);
  return rows.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
async function sourceRecords(extra = []) {
  return await Promise.all(
    [...new Set([...sourcePaths, ...extra])].map(record),
  );
}
await mkdir(join(workspace, 'tmp'), { recursive: true });
const work = await mkdtemp(join(workspace, 'tmp', 'resource-cleanup-'));
const evidence = options.has('evidence')
  ? below(join(workspace, 'artifacts/maintenance'), options.get('evidence'))
  : join(work, 'evidence');
await noLinks(evidence);
assert(!(await exists(evidence)), 'Use a new evidence directory.');
await mkdir(evidence, { recursive: true });
const reportPath = join(evidence, 'report.json');
const report = {
  schemaVersion: 1,
  scenario: 'resource-cleanup-component',
  result: 'running',
  priorFailures,
  failureLimit: limit,
  failures: 0,
  selectedCases: selected,
  work,
  evidence,
  preparation: { result: 'pending' },
  results: [],
  cleanup: { result: 'pending', productProcessesStarted: false },
  boundary:
    'Actual compiled helper --uninstall, actual readonly Node/SQLite and original-handle resource deletion. Migration invokes actual private MigrationLease/Migrate without Commit/health. Synthetic PE/module/save fixtures; temporary game signing key only in memory. No Native/installer/accounts/registration/network/production signing private key or formal product acceptance.',
};
async function saveReport() {
  const temporary = join(evidence, '.report-' + randomUUID() + '.json');
  await putJson(temporary, report);
  const { rename } = await import('node:fs/promises');
  await rename(temporary, reportPath);
}
const active = new Set();
async function execute(path, arguments_, label, timeout = 150000) {
  const log = {
    path,
    arguments: arguments_,
    code: null,
    signal: null,
    stdout: '',
    stderr: '',
    error: null,
    timedOut: false,
  };
  await new Promise((done) => {
    const child = spawn(path, arguments_, {
      cwd: work,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TEMP: join(work, 'temp'),
        TMP: join(work, 'temp'),
        TABLEMAX_AUTO_MAINTENANCE: '0',
        TABLEMAX_TEST_MAINTENANCE: '0',
      },
    });
    active.add(child);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let length = 0;
    const receive = (name, chunk) => {
      length += chunk.length;
      if (length > 2 * 1024 * 1024) {
        log.error = 'Component output exceeded its bound';
        child.kill();
      } else log[name] += chunk;
    };
    child.stdout.on('data', (chunk) => receive('stdout', chunk));
    child.stderr.on('data', (chunk) => receive('stderr', chunk));
    const timer = setTimeout(() => {
      log.timedOut = true;
      child.kill();
    }, timeout);
    child.once('error', (cause) => {
      log.error = cause.message;
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      active.delete(child);
      log.code = code;
      log.signal = signal;
      done();
    });
  });
  await putJson(join(evidence, label + '.json'), log);
  return log;
}
function createDatabase(path, saved, damaged = false) {
  const database = new DatabaseSync(path);
  try {
    database.exec(
      'PRAGMA user_version=2; CREATE TABLE saves(id INTEGER PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE journal(data TEXT NOT NULL); CREATE TABLE checkpoint_nodes(id TEXT PRIMARY KEY,instance TEXT,previous TEXT,data TEXT); CREATE TABLE receipt_nodes(id TEXT PRIMARY KEY,previous TEXT,data TEXT);',
    );
    if (saved) {
      const checkpoint = JSON.stringify({ fixture: 'recoverable-checkpoint' });
      const node = {
        instance: 'resource-fixture-save',
        previous: null,
        data: checkpoint,
      };
      const checkpointId = sha(JSON.stringify(node));
      database
        .prepare('INSERT INTO checkpoint_nodes VALUES(?,?,?,?)')
        .run(checkpointId, node.instance, null, node.data);
      database.prepare('INSERT INTO saves VALUES(1,?)').run(
        JSON.stringify({
          _storage: 2,
          value: {
            formatVersion: 1,
            instanceId: node.instance,
            releaseRef: saved,
            manifest: { id: 'resource-fixture' },
          },
          historyLength: 1,
          historyHead: checkpointId,
          receiptsHead: null,
          hasSessionReceipts: false,
        }),
      );
      database.prepare('INSERT INTO journal VALUES(?)').run(
        JSON.stringify({
          formatVersion: 1,
          instanceId: node.instance,
          releaseRef: saved,
          manifest: { id: 'resource-fixture' },
          history: [],
        }),
      );
    }
    if (damaged)
      database.prepare('INSERT INTO journal VALUES(?)').run('{broken');
  } finally {
    database.close();
  }
}

try {
  const initialSources = await sourceRecords();
  report.sourceHashes = initialSources;
  await mkdir(join(work, 'temp'));
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const replacement = {
    specifier: 'project-public-key',
    export: 'PROJECT_GAME_PUBLIC_KEY',
    publicKeyPem: publicPem,
    scope: 'bundled-test-resource-only',
  };
  await putJson(join(evidence, 'public-test-trust.json'), replacement);
  const bundled = await build({
    entryPoints: ['apps/desktop/installation-runtime/cleanup-plan.mjs'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
    plugins: [
      {
        name: 'temporary-public-game-trust',
        setup(bundle) {
          bundle.onResolve({ filter: /(?:^|\/)project-public-key$/ }, () => ({
            path: 'temporary-public-game-trust',
            namespace: 'resource-fixture',
          }));
          bundle.onLoad(
            { filter: /.*/, namespace: 'resource-fixture' },
            () => ({
              contents:
                'export const PROJECT_GAME_PUBLIC_KEY = ' +
                JSON.stringify(publicPem) +
                ';',
              loader: 'js',
            }),
          );
        },
      },
    ],
  });
  const resource = join(work, 'cleanup-plan-test.mjs');
  await put(resource, bundled.outputFiles[0].contents);
  const verificationBuild = await build({
    entryPoints: ['apps/server/src/game-packages/verification.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const verificationPath = join(work, 'verification.mjs');
  await put(verificationPath, verificationBuild.outputFiles[0].contents);
  const { canonical, blobIdentity, releaseIdentity, validateCatalog } =
    await import(pathToFileURL(verificationPath).href);
  const makeBlob = (kind, files) => {
    const value = {
      kind,
      files: Object.entries(files).map(([path, data]) => ({
        path,
        size: Buffer.byteLength(data),
        sha256: sha(data),
      })),
      archiveBytes: 1,
      archiveSha256: sha('synthetic-not-a-zip'),
      installedBytes: Object.values(files).reduce(
        (total, data) => total + Buffer.byteLength(data),
        0,
      ),
      assetName: kind + '-fixture.zip',
      releaseTag: 'fixture',
    };
    return { id: blobIdentity(value), ...value };
  };
  const currentFiles = {
    'rules.cjs': 'never executed current rules',
    'bot.cjs': 'never executed current bot',
    'web/index.js': 'never executed current web',
  };
  const oldFiles = {
    'rules.cjs': 'never executed old rules',
    'bot.cjs': 'never executed old bot',
    'web/index.js': 'never executed old web',
  };
  const sharedFiles = {
    'images/fixture.txt': 'shared recoverable old game resource',
  };
  const currentBlob = makeBlob('code', currentFiles),
    oldBlob = makeBlob('code', oldFiles),
    sharedBlob = makeBlob('resources', sharedFiles);
  const makeRelease = (code) => {
    const value = {
      gameId: 'resource-fixture',
      module: {
        id: 'resource-fixture',
        entries: { rules: 'rules.cjs', bot: 'bot.cjs', web: 'web/index.js' },
      },
      code,
      resources: [sharedBlob.id],
      resourceMap: {
        'images/fixture.txt': {
          blobId: sharedBlob.id,
          path: 'images/fixture.txt',
        },
      },
      releaseTag: 'fixture',
    };
    return { releaseId: releaseIdentity(value), ...value };
  };
  const current = makeRelease(currentBlob.id),
    old = makeRelease(oldBlob.id);
  const catalog = {
    schemaVersion: 1,
    releases: [current, old],
    blobs: [currentBlob, oldBlob, sharedBlob],
  };
  validateCatalog(catalog);
  const signature = sign(
    null,
    Buffer.from(canonical(catalog)),
    privateKey,
  ).toString('base64');
  const helper = join(work, 'FixtureUpdateHelper.exe'),
    migration = join(work, 'MigrationComponent.exe');
  const resources = [
    { path: resource, name: 'TableMax.InstallationCleanupPlan.mjs' },
  ];
  const compiler = await compileInstallationProgram({
    outputPath: helper,
    sources: helperSources,
    main: 'TableMax.Installation.UpdateHelper',
    buildVersion: '1.0.7.60000',
    fixture: true,
    resources,
  });
  const migrationCompiler = await compileInstallationProgram({
    outputPath: migration,
    sources: [
      ...helperSources,
      'tools/test/installation/resource-cleanup-harness.cs',
    ],
    main: 'ResourceCleanupHarness',
    buildVersion: '1.0.7.60000',
    fixture: true,
    resources,
  });
  const runtime = join(workspace, '.cache/node/22.14.0/runtime/node.exe');
  await noLinks(runtime);
  const extraSources = [
    ...Object.keys(bundled.metafile.inputs),
    ...Object.keys(verificationBuild.metafile.inputs),
  ].filter((path) => !path.startsWith('resource-fixture:'));
  report.sourceHashes = await sourceRecords(extraSources);
  for (const source of initialSources)
    assert.deepEqual(
      report.sourceHashes.find((value) => value.path === source.path),
      source,
      'Source changed while preparing the component.',
    );
  report.preparation = {
    result: 'passed',
    compiler,
    migrationCompiler,
    helper: await record(helper),
    migrationHarness: await record(migration),
    node: await record(runtime),
    plannerBundle: await record(resource),
    verificationBundle: await record(verificationPath),
    trust: await record(join(evidence, 'public-test-trust.json')),
    replacementRecipe: replacement,
  };
  await saveReport();

  async function migrationCase(id, external = false) {
    const label = external ? id + '-externalD' : id;
    const root = join(work, label, 'I'),
      nonce = randomUUID();
    await mkdir(root, { recursive: true });
    await putJson(join(root, '.resource-cleanup-fixture.json'), {
      kind: 'synthetic-resource-cleanup-component',
      nonce,
    });
    const originalData = external ? join(work, label, 'D') : root;
    await mkdir(originalData, { recursive: true });
    await putJson(join(root, 'TableMax.config.json'), {
      dataDirectory: external ? originalData : '.',
    });
    createDatabase(join(originalData, 'room.sqlite'), old.releaseId);
    await put(
      join(originalData, 'foundation.sqlite'),
      'synthetic original foundation; copied without interpreting',
    );
    await put(
      join(root, 'games', 'old-resource.bin'),
      'original portable game',
    );
    await put(join(root, 'unknown-note.txt'), 'unknown original preserved');
    await put(
      join(root, 'app', 'old-runtime.bin'),
      'original runtime excluded',
    );
    await put(join(root, 'updates', 'audit.json'), '{}');
    const installerSource = join(root, 'synthetic-installer.exe');
    await put(installerSource, 'synthetic installer never executed');
    if (id === 'nonempty-data')
      await put(
        join(root, 'data', 'unknown.txt'),
        'target must not be overwritten',
      );
    const before = await inventory(root);
    const externalBefore = external ? await inventory(originalData) : null;
    const plan = join(work, label, 'migration-plan.json');
    await putJson(plan, { schemaVersion: 1, root, nonce, installerSource });
    const execution = await execute(migration, ['--plan=' + plan], label);
    assert.equal(execution.code, 0, execution.stderr + execution.stdout);
    assert.equal(execution.signal, null);
    assert.equal(execution.error, null);
    assert.equal(execution.timedOut, false);
    const result = JSON.parse(execution.stdout.trim());
    if (id === 'nonempty-data') {
      assert.equal(result.result, 'rejected');
      assert.equal(result.helperCode, 10);
      assert.deepEqual(await inventory(root), before);
    } else {
      assert.equal(result.result, 'migrated');
      for (const item of before.filter((item) => item.kind === 'file'))
        assert.deepEqual(
          await record(join(root, ...item.path.split('/'))),
          {
            path: resolve(join(root, ...item.path.split('/'))),
            bytes: item.bytes,
            sha256: item.sha256,
          },
          'Original portable changed: ' + item.path,
        );
      for (const name of external
        ? ['games/old-resource.bin']
        : [
            'room.sqlite',
            'foundation.sqlite',
            'games/old-resource.bin',
            'unknown-note.txt',
          ])
        assert.equal(
          (await record(join(root, 'data', ...name.split('/')))).sha256,
          (await record(join(root, ...name.split('/')))).sha256,
        );
      assert.deepEqual(
        JSON.parse(
          await readFile(join(root, 'data', 'TableMax.config.json'), 'utf8'),
        ),
        { dataDirectory: external ? originalData : '.' },
      );
      for (const name of ['app', 'updates', 'data', 'synthetic-installer.exe'])
        assert(
          !(await exists(join(root, 'data', name))),
          'Excluded original was copied: ' + name,
        );
      if (external) {
        for (const name of [
          'room.sqlite',
          'foundation.sqlite',
          'unknown-note.txt',
        ])
          assert(
            !(await exists(join(root, 'data', name))),
            'External-data migration copied unrelated source: ' + name,
          );
        assert.deepEqual(await inventory(originalData), externalBefore);
      }
      const database = new DatabaseSync(
        join(external ? originalData : join(root, 'data'), 'room.sqlite'),
        {
          readOnly: true,
        },
      );
      try {
        assert.equal(
          database.prepare('PRAGMA quick_check').get().quick_check,
          'ok',
        );
        assert.equal(
          database.prepare('SELECT count(*) AS n FROM saves').get().n,
          1,
        );
      } finally {
        database.close();
      }
    }
    return {
      root,
      originalData,
      external,
      actual: result,
      before,
      after: await inventory(root),
      execution: label + '.json',
      externalBefore,
      externalAfter: external ? await inventory(originalData) : null,
    };
  }

  async function cleanupCase(id, damagedKind = null) {
    const label = damagedKind ? id + '-' + damagedKind : id;
    const root = join(work, label, 'I'),
      box = join(root, 'data'),
      games = join(box, 'games');
    await mkdir(games, { recursive: true });
    await putJson(join(root, '.resource-cleanup-fixture.json'), {
      kind: 'synthetic-resource-cleanup-component',
      nonce: randomUUID(),
    });
    await putJson(join(box, 'TableMax.config.json'), { dataDirectory: '.' });
    createDatabase(
      join(box, 'room.sqlite'),
      id === 'cleanup-references' ? old.releaseId : null,
      damagedKind === 'journal',
    );
    await put(
      join(box, 'foundation.sqlite'),
      'synthetic original foundation; leased without interpreting',
    );
    await put(join(box, 'unknown-note.txt'), 'unknown user material');
    const includeOld = id === 'cleanup-references';
    const installedBlobs = includeOld
      ? [currentBlob, oldBlob, sharedBlob]
      : [currentBlob, sharedBlob];
    const content = new Map([
      [currentBlob.id, currentFiles],
      [oldBlob.id, oldFiles],
      [sharedBlob.id, sharedFiles],
    ]);
    for (const blob of installedBlobs)
      for (const [name, bytes] of Object.entries(content.get(blob.id)))
        await put(
          join(games, 'resource-fixture', 'blobs', blob.id, ...name.split('/')),
          bytes,
        );
    await putJson(join(games, 'index.json'), {
      schemaVersion: 1,
      releases: Object.fromEntries(
        (includeOld ? [current, old] : [current]).map((release) => [
          release.releaseId,
          release,
        ]),
      ),
      blobs: Object.fromEntries(installedBlobs.map((blob) => [blob.id, blob])),
      selected: { 'resource-fixture:': current.releaseId },
    });
    let outside;
    if (id === 'cleanup-unknown-link') {
      await put(
        join(games, 'resource-fixture', 'blobs', currentBlob.id, 'unknown.txt'),
        'unknown inside current blob',
      );
      await put(join(games, 'unknown.txt'), 'unknown outside blobs');
      outside = join(work, id, 'link-target');
      await put(join(outside, 'original.txt'), 'linked original must remain');
      await symlink(outside, join(games, 'linked-original'), 'junction');
    }
    const files = [];
    async function managed(name, value, fromFile = false) {
      const path = join(root, ...name.split('/'));
      await mkdir(dirname(path), { recursive: true });
      if (fromFile) {
        assert(!(await exists(path)));
        await copyFile(value, path);
      } else await put(path, value);
      const file = await record(path);
      files.push({ path: name, bytes: file.bytes, sha256: file.sha256 });
      return file;
    }
    await managed('TableMax.exe', 'synthetic stable entry never executed');
    await managed('Updater.exe', 'synthetic updater never executed');
    await managed('UpdateHelper.exe', helper, true);
    await managed('data/app/TableMax.exe', 'synthetic native never executed');
    await managed('data/app/node.exe', runtime, true);
    await managed('data/app/server.cjs', 'synthetic server never executed');
    const payload = await managed(
      'data/app/.tablemax-release.json',
      JSON.stringify({ fixture: true }),
    );
    const mapping = await managed(
      'data/app/preinstalled-games/bootstrap.json',
      JSON.stringify({ schemaVersion: 1, releaseIds: [current.releaseId] }),
    );
    await managed(
      'data/app/preinstalled-games/catalog.json',
      JSON.stringify({
        payload: catalog,
        signature:
          damagedKind === 'catalog'
            ? Buffer.alloc(64).toString('base64')
            : signature,
      }),
    );
    const installationId = randomUUID();
    const sidResult = await execute(
      join(
        process.env.WINDIR,
        'System32/WindowsPowerShell/v1.0/powershell.exe',
      ),
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);[Console]::Write([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)',
      ],
      label + '-sid',
    );
    assert.equal(sidResult.code, 0, sidResult.stderr);
    const ownerSid = sidResult.stdout.trim();
    assert(/^S-1-5-21-\d+-\d+-\d+-\d+$/.test(ownerSid));
    const identity = {
      schemaVersion: 1,
      productId,
      arch: 'x64',
      installProtocol: 1,
      releaseVersion: '1.0.7',
      buildVersion: '1.0.7.60000',
      payloadManifestSha256: payload.sha256,
      currentMappingSha256: mapping.sha256,
      files,
      installationId,
      root,
      boxRoot: box,
      ownerSid,
    };
    await putJson(join(box, '.install.json'), identity);
    await putJson(join(box, '.installer-receipt.json'), {
      schemaVersion: 1,
      productId,
      installationId,
      buildVersion: identity.buildVersion,
      bytes: 1,
      sha256: sha('synthetic original full installer'),
    });
    const installerReceiptBefore = await record(
      join(box, '.installer-receipt.json'),
    );
    const protectedPaths = [
      'TableMax.config.json',
      'room.sqlite',
      'foundation.sqlite',
      'unknown-note.txt',
    ];
    const protectedBefore = await Promise.all(
      protectedPaths.map((path) => record(join(box, path))),
    );
    const before = await inventory(games),
      outsideBefore = outside ? await inventory(outside) : null;
    const execution = await execute(
      helper,
      ['--uninstall', '--root=' + root],
      label,
    );
    assert.equal(execution.code, 0, execution.stderr);
    assert.equal(execution.signal, null);
    assert.equal(execution.error, null);
    assert.equal(execution.timedOut, false);
    const receiptPath = join(box, '.uninstall-resources.json');
    const raw = await readFile(receiptPath);
    const receipt = JSON.parse(raw);
    assert(['completed', 'retained'].includes(receipt.result));
    assert.deepEqual(receipt.deferred, []);
    assert.equal(receipt.installationId, installationId);
    assert.equal(receipt.root, root);
    assert.equal(receipt.boxRoot, box);
    assert.equal(receipt.dataDirectory, box);
    assert.equal(receipt.ownerSid, ownerSid);
    assert(/^[a-f0-9]{64}$/.test(receipt.databaseFingerprint));
    assert.equal(sha(await readFile(receipt.auditPath)), sha(raw));
    const covered = new Map();
    for (const action of ['deleted', 'retained'])
      for (const file of receipt[action]) {
        assert(!covered.has(file.path));
        covered.set(file.path, action);
        const original = before.find(
          (row) => 'games/' + row.path === file.path && row.kind === 'file',
        );
        assert(original, 'Receipt authorized a non-original file');
        assert.equal(file.bytes, original.bytes);
        assert.equal(file.sha256, original.sha256);
        assert(/[\u4e00-\u9fff]/.test(file.reason));
        const path = join(box, ...file.path.split('/'));
        if (action === 'deleted')
          assert(!(await exists(path)), 'Deleted resource remains');
        else assert.equal((await record(path)).sha256, original.sha256);
      }
    for (const file of before.filter((row) => row.kind === 'file'))
      assert(
        covered.has('games/' + file.path),
        'Ordinary original omitted from receipt',
      );
    assert.deepEqual(
      await Promise.all(protectedPaths.map((path) => record(join(box, path)))),
      protectedBefore,
    );
    for (const file of files)
      assert(
        !(await exists(join(root, ...file.path.split('/')))),
        'Managed program remains',
      );
    assert(!(await exists(join(box, '.install.json'))));
    assert.deepEqual(
      JSON.parse(await readFile(join(box, '.uninstalled.json'), 'utf8')),
      identity,
    );
    assert.deepEqual(
      await record(join(box, '.installer-receipt.json')),
      installerReceiptBefore,
    );
    if (id === 'cleanup-current') {
      assert.equal(receipt.result, 'completed');
      assert.equal(
        receipt.deleted.length,
        currentBlob.files.length + sharedBlob.files.length,
      );
    }
    if (id === 'cleanup-references') {
      assert.deepEqual(receipt.referencedReleaseIds, [old.releaseId]);
      for (const blob of [oldBlob, sharedBlob])
        for (const file of blob.files)
          assert.equal(
            covered.get(
              'games/resource-fixture/blobs/' + blob.id + '/' + file.path,
            ),
            'retained',
          );
      assert.equal(receipt.deleted.length, currentBlob.files.length);
    }
    if (id === 'cleanup-damaged') {
      assert.equal(receipt.result, 'retained');
      assert.deepEqual(receipt.deleted, []);
      assert.deepEqual(await inventory(games), before);
    }
    if (id === 'cleanup-unknown-link') {
      assert.equal(covered.get('games/unknown.txt'), 'retained');
      for (const file of [...currentBlob.files, { path: 'unknown.txt' }])
        assert.equal(
          covered.get(
            'games/resource-fixture/blobs/' + currentBlob.id + '/' + file.path,
          ),
          'retained',
        );
      assert(
        receipt.entries.some(
          (entry) =>
            entry.path === 'games/linked-original' && entry.kind === 'link',
        ),
      );
      assert.deepEqual(await inventory(outside), outsideBefore);
      assert(
        (await lstat(join(games, 'linked-original'))).isSymbolicLink() ||
          (await readdir(games, { withFileTypes: true })).some(
            (entry) =>
              entry.name === 'linked-original' && entry.isSymbolicLink(),
          ),
      );
    }
    assert.equal(
      receipt.analysisWork.result,
      'completed',
      'Private analysis copy cleanup incomplete',
    );
    assert(
      !(await exists(receipt.analysisWork.path)),
      'Known private analysis directory remains',
    );
    await put(join(evidence, label + '-resource-receipt.json'), raw);
    return {
      root,
      damagedKind,
      execution: label + '.json',
      receipt: await record(receiptPath),
      archivedReceipt: await record(
        join(evidence, label + '-resource-receipt.json'),
      ),
      before,
      after: await inventory(games),
      protectedBefore,
      protectedAfter: await Promise.all(
        protectedPaths.map((path) => record(join(box, path))),
      ),
      outsideBefore,
      outsideAfter: outside ? await inventory(outside) : null,
    };
  }

  for (const id of selected) {
    if (priorFailures + report.failures >= limit) break;
    const began = performance.now();
    try {
      const evidence =
        id === 'same-root-migration'
          ? {
              defaultD: await migrationCase(id),
              externalD: await migrationCase(id, true),
            }
          : id === 'nonempty-data'
            ? await migrationCase(id)
            : id === 'cleanup-damaged'
              ? {
                  catalog: await cleanupCase(id, 'catalog'),
                  journal: await cleanupCase(id, 'journal'),
                }
              : await cleanupCase(id);
      report.results.push({
        id,
        result: 'passed',
        milliseconds: Math.round(performance.now() - began),
        evidence,
      });
    } catch (cause) {
      report.failures++;
      report.results.push({
        id,
        result: 'failed',
        milliseconds: Math.round(performance.now() - began),
        error: cause.stack ?? String(cause),
      });
    }
    await saveReport();
  }
  report.sourcesUnchanged =
    JSON.stringify(await sourceRecords(extraSources)) ===
    JSON.stringify(report.sourceHashes);
  assert(report.sourcesUnchanged, 'Component source changed during execution.');
  assert.deepEqual(
    await record(runtime),
    report.preparation.node,
    'Pinned Node input changed during execution.',
  );
  report.result =
    report.failures === 0 && report.results.length === selected.length
      ? 'passed'
      : 'failed';
} catch (cause) {
  report.failures++;
  if (report.preparation.result !== 'passed')
    report.preparation = {
      result: 'failed',
      error: cause.stack ?? String(cause),
      code: cause.code ?? null,
      stdout: cause.stdout ?? null,
      stderr: cause.stderr ?? null,
    };
  else report.finalizationError = cause.stack ?? String(cause);
  report.result = 'failed';
} finally {
  for (const child of active) child.kill();
  report.totalFailures = priorFailures + report.failures;
  report.cleanup = {
    result: active.size === 0 ? 'passed' : 'failed',
    trackedChildCount: active.size,
    originalSourcesDeleted: false,
    fixtureOutputsRetained: true,
    method:
      'All tracked helper/Node invocations must close before assertions; only private generated copies were eligible for product deletion. Work/evidence retained for diagnosis; no recursive cleanup.',
  };
  await saveReport();
}
console.log(
  JSON.stringify({
    result: report.result,
    cases: report.results.length,
    failures: report.failures,
    totalFailures: report.totalFailures,
    evidence,
    reportPath,
    work,
  }),
);
if (report.result !== 'passed' || report.cleanup.result !== 'passed')
  process.exitCode = 1;
