import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  unlink,
  rmdir,
  realpath,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { hash } from './installation-toolchain.mjs';
import {
  assertDeliveryPath,
  assertNoDeliveryLinks,
} from './delivery-paths.mjs';
import {
  createInstallationExecutable,
  installationInventory,
} from './installation-package.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';

async function sourcePath(path) {
  assert.equal(typeof path, 'string', 'Explicit frozen source path required');
  const root = resolve('.'),
    absolute = resolve(root, path);
  const child = relative(root, absolute);
  assert.ok(
    child &&
      !isAbsolute(child) &&
      child !== '..' &&
      !child.startsWith('..' + sep),
    'Frozen fixture source escapes workspace',
  );
  assertNoDeliveryLinks(absolute);
  assert.equal(
    (await realpath(absolute)).toLowerCase(),
    absolute.toLowerCase(),
    'Frozen fixture source is aliased',
  );
  assert.ok(
    (await stat(absolute)).isFile(),
    'Frozen fixture source must be a regular file',
  );
  return absolute;
}

async function sourceRecord(path) {
  path = await sourcePath(path);
  const raw = await readFile(path);
  return { path, bytes: raw.length, sha256: hash(raw) };
}

/** Authenticate an explicit source before any fixture compilation or extraction. */
export async function readInstallationFixtureSource(sourcePointer) {
  assertWorkspaceRoot();
  const currentVersion = JSON.parse(
    await readFile('package.json', 'utf8'),
  ).version;
  const pointerPath = await sourcePath(
    sourcePointer ??
      resolve(
        'artifacts/package-payloads',
        'v' + currentVersion,
        'current.json',
      ),
  );
  const pointerBytes = await readFile(pointerPath);
  const pointer = JSON.parse(pointerBytes.toString('utf8'));
  assert.match(pointer.version, /^1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/);
  assert.ok(
    pointer.buildVersion === pointer.version ||
      new RegExp(
        '^' + pointer.version.replaceAll('.', '\\.') + '\\.(?:0|[1-9]\\d*)$',
      ).test(pointer.buildVersion),
    'Frozen source build does not belong to its public version',
  );
  assert.match(pointer.snapshot, /^[a-f0-9]{64}$/);
  assert.ok(Array.isArray(pointer.deliveries));
  const selected = pointer.deliveries.filter((item) => item.edition === 'full');
  assert.equal(
    selected.length,
    1,
    'Exactly one frozen complete source required',
  );
  const delivery = selected[0];
  const manifestPath = await sourcePath(delivery.manifestPath);
  const previousBytes = await readFile(manifestPath);
  const previous = JSON.parse(previousBytes.toString('utf8'));
  assert.equal(previous.version, pointer.version);
  assert.equal(previous.buildVersion, pointer.buildVersion);
  assert.equal(previous.snapshot, pointer.snapshot);
  assert.equal(previous.edition, 'full');
  const archive = await sourceRecord(delivery.archivePath);
  assert.equal(archive.bytes, previous.archive.bytes);
  assert.equal(archive.sha256, previous.archive.sha256);
  const executablePath = assertDeliveryPath({
    version: pointer.version,
    buildVersion: pointer.buildVersion,
    path: delivery.executable.path,
  });
  const executable = await sourceRecord(executablePath);
  assert.equal(executable.bytes, delivery.executable.bytes);
  assert.equal(executable.sha256, delivery.executable.sha256);
  assert.equal(delivery.executable.payloadSha256, archive.sha256);
  const source = {
    pointer: {
      path: pointerPath,
      bytes: pointerBytes.length,
      sha256: hash(pointerBytes),
    },
    manifest: {
      path: manifestPath,
      bytes: previousBytes.length,
      sha256: hash(previousBytes),
    },
    archive,
    executable,
    version: pointer.version,
    buildVersion: pointer.buildVersion,
    snapshot: pointer.snapshot,
  };
  if (
    delivery.deliveryType === 'installer' ||
    delivery.executable.type === 'installer'
  ) {
    assert.equal(delivery.deliveryType, 'installer');
    assert.equal(delivery.executable.type, 'installer');
    const installation = delivery.executable.installation;
    const installedRecord = await sourceRecord(installation.manifestPath);
    assert.equal(installedRecord.sha256, installation.manifestSha256);
    const installed = JSON.parse(await readFile(installedRecord.path, 'utf8'));
    assert.equal(installed.releaseVersion, pointer.version);
    assert.equal(installed.buildVersion, pointer.buildVersion);
    assert.equal(installed.productId, '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}');
    assert.equal(installed.productId, installation.productId);
    assert.equal(installed.payloadManifestSha256, source.manifest.sha256);
    assert.equal(
      installed.payloadManifestSha256,
      installation.payloadManifestSha256,
    );
    assert.equal(
      installed.currentMappingSha256,
      installation.currentMappingSha256,
    );
    source.installationManifest = installedRecord;
  }
  const snapshotRecord = await sourceRecord(
    resolve('build/snapshots', pointer.snapshot + '.json'),
  );
  const snapshot = JSON.parse(await readFile(snapshotRecord.path, 'utf8'));
  assert.equal(snapshot.id, pointer.snapshot);
  assert.equal(snapshot.version, pointer.version);
  assert.equal(snapshot.buildVersion, pointer.buildVersion);
  assert.equal(
    hash(
      Buffer.from(
        JSON.stringify({
          version: snapshot.version,
          ...(snapshot.buildVersion
            ? { buildVersion: snapshot.buildVersion }
            : {}),
          assemblerSha256: snapshot.assemblerSha256,
          units: snapshot.units.map(({ id, fingerprint }) => ({
            id,
            fingerprint,
          })),
        }),
      ),
    ),
    pointer.snapshot,
    'Frozen source snapshot identity changed',
  );
  source.snapshotRecord = snapshotRecord;
  return {
    currentVersion,
    pointer,
    pointerBytes,
    previous,
    previousBytes,
    delivery,
    source,
  };
}

/** Frozen published games plus explicitly selected new test native/server/web units. */
export async function createInstallationFixturePackage({
  nativeDirectory,
  serverDirectory,
  webDirectory,
  buildVersion,
  applicationTrustRootsPath,
  handoffTest = false,
  sourcePointer,
}) {
  assertWorkspaceRoot();
  assert.ok(
    nativeDirectory && serverDirectory && webDirectory,
    'Explicit latest fixture units required',
  );
  const {
    currentVersion,
    pointer,
    pointerBytes,
    previous,
    delivery,
    source: originalSource,
  } = await readInstallationFixtureSource(sourcePointer);
  const sourceVersion = pointer.version;
  // Test-only application identities may exercise the future layout baseline;
  // signed game bytes still come from the unchanged current source release.
  const version = buildVersion
    ? buildVersion.split('.').slice(0, 3).join('.')
    : currentVersion;
  assert.match(version, /^1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/);
  if (buildVersion)
    assert.match(
      buildVersion,
      new RegExp('^' + version.replaceAll('.', '\\.') + '\\.([0-9]{1,5})$'),
    );
  if (sourcePointer)
    assert.equal(
      version,
      currentVersion,
      'Explicit-source fixtures must use the current package public version',
    );
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/installation-fixture-package-'));
  const frozenPointerPath = join(work, 'source-pointer.json');
  await writeFile(frozenPointerPath, pointerBytes, { flag: 'wx' });
  const fixtureSource = {
    ...originalSource,
    frozenPointer: await sourceRecord(frozenPointerPath),
  };
  const payload = join(work, 'payload');
  const run = promisify(execFile);
  const nativeVersion = await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      '[Diagnostics.FileVersionInfo]::GetVersionInfo($env:TABLEMAX_FIXTURE_NATIVE).FileVersion',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_FIXTURE_NATIVE: resolve(nativeDirectory, 'TableMax.exe'),
      },
    },
  );
  assert.equal(
    nativeVersion.stdout.trim(),
    buildVersion ?? previous.buildVersion,
    'Fixture native assembly must match the requested four-part installer identity',
  );
  await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:TABLEMAX_FIXTURE_ORIGINAL,$env:TABLEMAX_FIXTURE_PAYLOAD)',
    ],
    {
      windowsHide: true,
      timeout: 120000,
      env: {
        ...process.env,
        TABLEMAX_FIXTURE_ORIGINAL: delivery.archivePath,
        TABLEMAX_FIXTURE_PAYLOAD: payload,
      },
    },
  );
  assert.deepEqual(await installationInventory(payload), previous.files);
  for (const name of [
    'TableMax.exe',
    'TableMax.exe.config',
    'Microsoft.Web.WebView2.Core.dll',
    'Microsoft.Web.WebView2.WinForms.dll',
    'WebView2Loader.dll',
  ])
    await copyFile(join(nativeDirectory, name), join(payload, name));
  for (const name of ['server.cjs', 'server.cjs.br'])
    await copyFile(join(serverDirectory, name), join(payload, name));
  if (buildVersion) {
    const applicationPackage = join(payload, 'package.json');
    const metadata = JSON.parse(await readFile(applicationPackage, 'utf8'));
    metadata.version = version;
    metadata.buildVersion = buildVersion;
    await writeFile(
      applicationPackage,
      JSON.stringify(metadata, null, 2) + '\n',
    );
  }
  const oldBoxRecord = previous.units.find(
    (unit) => unit.id === 'platform-box',
  );
  assert.ok(oldBoxRecord, 'Frozen original platform-box ownership required');
  const oldBox = JSON.parse(
    await readFile(
      resolve(
        '.cache/build-modules/v1/platform-box',
        oldBoxRecord.fingerprint,
        'manifest.json',
      ),
      'utf8',
    ),
  );
  assert.equal(oldBox.id, 'platform-box');
  assert.equal(oldBox.fingerprint, oldBoxRecord.fingerprint);
  assert.equal(
    hash(Buffer.from(JSON.stringify(oldBox.inputs))),
    oldBox.fingerprint,
  );
  for (const file of oldBox.files) {
    assert.ok(
      file.path === 'index.html' ||
        (file.path.startsWith('assets/') &&
          !file.path.split('/').some((part) => part === '..' || part === '.')),
      'Box unit must not claim catalog, runtime or game files',
    );
    const frozen = previous.files.find(
      (record) => record.path === 'web/' + file.path,
    );
    assert.ok(frozen);
    if (file.path !== 'index.html') {
      assert.equal(file.bytes, frozen.bytes);
      assert.equal(file.sha256, frozen.sha256);
    }
  }
  const boxClaims = new Set(oldBox.files.map((file) => 'web/' + file.path));
  const retainedWeb = previous.files.filter(
    (file) => file.path.startsWith('web/') && !boxClaims.has(file.path),
  );
  assert.ok(retainedWeb.some((file) => file.path === 'web/catalog.json'));
  assert.ok(
    retainedWeb.some((file) => file.path.startsWith('web/runtime/v1/')),
  );
  for (const file of oldBox.files) {
    const target = resolve(payload, 'web', file.path);
    assert.ok(target.startsWith(resolve(payload, 'web') + sep));
    assert.ok(
      previous.files.some((record) => record.path === 'web/' + file.path),
      'Cannot remove a file outside the frozen original box claims',
    );
    await unlink(target);
    for (
      let directory = dirname(target);
      directory !== resolve(payload, 'web');
      directory = dirname(directory)
    ) {
      try {
        await rmdir(directory);
      } catch (error) {
        if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') break;
        throw error;
      }
    }
  }
  const web = await installationInventory(webDirectory);
  for (const file of web) {
    assert.ok(
      file.path === 'index.html' || file.path.startsWith('assets/'),
      'New box unit must not override separately assembled runtime/catalog/game members',
    );
    const destination = join(payload, 'web', file.path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(webDirectory, file.path), destination);
  }
  // Match assemble.mjs: the box unit index needs the separately frozen runtime CSS.
  const runtimeCss = retainedWeb.filter(
    (file) =>
      file.path.startsWith('web/runtime/v1/') && file.path.endsWith('.css'),
  );
  const cssLinks = runtimeCss
    .map((file) => '<link rel="stylesheet" href="/' + file.path.slice(4) + '">')
    .join('');
  const indexPath = join(payload, 'web/index.html');
  await writeFile(
    indexPath,
    (await readFile(indexPath, 'utf8')).replace(
      '</head>',
      cssLinks + '</head>',
    ),
  );
  for (const file of retainedWeb) {
    const actual = join(payload, file.path);
    assert.equal((await stat(actual)).size, file.bytes);
    assert.equal(
      hash(await readFile(actual)),
      file.sha256,
      'Frozen game/catalog/runtime member lost during box overlay: ' +
        file.path,
    );
  }
  const index = await readFile(indexPath, 'utf8');
  for (const match of index.matchAll(/(?:src|href)="(\/[^"?#]+)"/g))
    assert.ok(
      (await stat(join(payload, 'web', match[1].slice(1)))).isFile(),
      'Index asset closure missing: ' + match[1],
    );
  const records = await installationInventory(payload);
  const archivePath = join(work, 'payload.zip');
  await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:TABLEMAX_FIXTURE_PAYLOAD,$env:TABLEMAX_FIXTURE_ARCHIVE,[IO.Compression.CompressionLevel]::Optimal,$false)',
    ],
    {
      windowsHide: true,
      timeout: 120000,
      env: {
        ...process.env,
        TABLEMAX_FIXTURE_PAYLOAD: payload,
        TABLEMAX_FIXTURE_ARCHIVE: archivePath,
      },
    },
  );
  const snapshot = hash(
    Buffer.from(
      JSON.stringify({
        fixture: 'test-product-new-native-server-web',
        original: pointer.snapshot,
        records,
      }),
    ),
  );
  const manifest = {
    ...previous,
    version,
    ...(buildVersion ? { buildVersion } : {}),
    snapshot,
    generatedAt: new Date().toISOString(),
    archive: {
      name: 'payload.zip',
      bytes: (await stat(archivePath)).size,
      sha256: hash(await readFile(archivePath)),
    },
    files: records,
    fileCount: records.length,
    unpackedBytes: records.reduce((sum, file) => sum + file.bytes, 0),
    fixture: {
      originalReleaseVersion: sourceVersion,
      source: fixtureSource,
      originalPayloadSha256: previous.archive.sha256,
      nativeDirectory: resolve(nativeDirectory),
      serverDirectory: resolve(serverDirectory),
      webDirectory: resolve(webDirectory),
      originalBoxFingerprint: oldBoxRecord.fingerprint,
      retainedWebFiles: retainedWeb,
      boundary:
        'Separate product GUID and test native compilation; preserves exact original signed games. Not production-identity acceptance.',
    },
  };
  const manifestPath = join(work, 'release-manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const executable = await createInstallationExecutable({
    archivePath,
    manifestPath,
    outputPath: join(work, 'TableMax-installation-fixture.exe'),
    fixture: true,
    applicationTrustRootsPath,
    handoffTest,
  });
  const result = {
    deliveryType: 'installer',
    edition: 'full',
    archivePath,
    manifestPath,
    executable,
    snapshot,
    version,
    buildVersion: manifest.buildVersion,
    source: fixtureSource,
  };
  await writeFile(
    join(work, 'fixture-delivery.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

if (isDirectExecution(import.meta.url)) {
  const args = process.argv.slice(2),
    value = (name) =>
      args
        .find((arg) => arg.startsWith('--' + name + '='))
        ?.slice(name.length + 3);
  console.log(
    JSON.stringify(
      await createInstallationFixturePackage({
        nativeDirectory: value('native'),
        serverDirectory: value('server'),
        webDirectory: value('web'),
      }),
    ),
  );
}
