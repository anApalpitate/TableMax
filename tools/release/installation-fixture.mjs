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
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { hash } from './installation-toolchain.mjs';
import {
  createInstallationExecutable,
  installationInventory,
} from './installation-package.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';

/** Frozen published games plus explicitly selected new test native/server/web units. */
export async function createInstallationFixturePackage({
  nativeDirectory,
  serverDirectory,
  webDirectory,
  buildVersion,
  applicationTrustRootsPath,
  handoffTest = false,
}) {
  assertWorkspaceRoot();
  assert.ok(
    nativeDirectory && serverDirectory && webDirectory,
    'Explicit latest fixture units required',
  );
  const sourceVersion = JSON.parse(
    await readFile('package.json', 'utf8'),
  ).version;
  // Test-only application identities may exercise the future layout baseline;
  // signed game bytes still come from the unchanged current source release.
  const version = buildVersion
    ? buildVersion.split('.').slice(0, 3).join('.')
    : sourceVersion;
  assert.match(version, /^1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/);
  if (buildVersion)
    assert.match(
      buildVersion,
      new RegExp('^' + version.replaceAll('.', '\\.') + '\\.([0-9]{1,5})$'),
    );
  const pointer = JSON.parse(
    await readFile(
      resolve(
        'artifacts/package-payloads',
        'v' + sourceVersion,
        'current.json',
      ),
      'utf8',
    ),
  );
  const delivery = pointer.deliveries.find((item) => item.edition === 'full');
  const previousBytes = await readFile(delivery.manifestPath),
    previous = JSON.parse(previousBytes.toString('utf8'));
  assert.equal(
    hash(await readFile(delivery.archivePath)),
    previous.archive.sha256,
  );
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/installation-fixture-package-'));
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
