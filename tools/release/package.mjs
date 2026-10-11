import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from './package-limits.mjs';
import { buildProject } from '../build/build.mjs';
import { scheduleMaintenance } from '../maintenance/lifecycle.mjs';
scheduleMaintenance();
import assert from 'node:assert/strict';
import { resolve, join, relative, sep } from 'node:path';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
  rename,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  execute,
  nodeVersion,
  nodeArchiveSha256,
} from '../build/setup-desktop.mjs';
import {
  lock,
  discover,
  validateInputs,
  unitsFor,
  buildUnit,
} from '../build/module-build.mjs';
import { assemble, assertIdle } from '../build/assemble.mjs';
import {
  createReleaseExecutable,
  assertReleaseIdle,
} from './release-executable.mjs';
import { gameReleaseAssets } from './game-release-assets.mjs';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
assert.ok(
  args.length <= 4 &&
    args.every(
      (arg) =>
        arg.startsWith('--snapshot=') ||
        arg.startsWith('--games=') ||
        arg.startsWith('--edition=') ||
        arg.startsWith('--platform-from='),
    ) &&
    new Set(args.map((arg) => arg.split('=')[0])).size === args.length,
);
assert.ok(
  !(
    args.some((arg) => arg.startsWith('--snapshot=')) &&
    args.some((arg) => arg.startsWith('--platform-from='))
  ),
  'Choose one frozen-snapshot source',
);
const edition =
  args.find((arg) => arg.startsWith('--edition='))?.slice(10) ?? 'both';
assert.ok(['full', 'box', 'both'].includes(edition), 'Unknown Windows edition');
const editions = edition === 'both' ? ['box', 'full'] : [edition];
async function resumeSnapshot(path) {
  const snapshotPath = resolve(path);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const id = createHash('sha256')
    .update(
      JSON.stringify({
        version: snapshot.version,
        assemblerSha256: snapshot.assemblerSha256,
        units: snapshot.units.map(({ id, fingerprint }) => ({
          id,
          fingerprint,
        })),
      }),
    )
    .digest('hex');
  assert.equal(snapshot.id, id);
  assert.deepEqual(
    snapshot.modules,
    (await discover()).filter((module) => !module.internal),
  );
  for (const unit of snapshot.units) await validateInputs(unit);
  await assemble(snapshotPath);
  return { ...snapshot, snapshotPath };
}
async function refreshPlatformSnapshot(path) {
  const previous = JSON.parse(await readFile(resolve(path), 'utf8'));
  const identity = (snapshot) =>
    createHash('sha256')
      .update(
        JSON.stringify({
          version: snapshot.version,
          assemblerSha256: snapshot.assemblerSha256,
          units: snapshot.units.map(({ id, fingerprint }) => ({
            id,
            fingerprint,
          })),
        }),
      )
      .digest('hex');
  assert.equal(previous.id, identity(previous));
  const assemblerSha256 = createHash('sha256')
    .update(await readFile('tools/build/assemble.mjs'))
    .digest('hex');
  assert.equal(
    previous.assemblerSha256,
    assemblerSha256,
    'Frozen assembler changed',
  );
  assert.deepEqual(
    previous.modules,
    (await discover()).filter((module) => !module.internal),
  );
  const platform = [];
  for (const unit of await unitsFor([])) {
    const result = await buildUnit(unit);
    await validateInputs(result);
    platform.push(result);
    console.log(
      result.id +
        ': ' +
        (result.cached ? 'cache hit' : result.durationMs + 'ms'),
    );
  }
  const snapshot = {
    ...previous,
    units: [
      ...platform,
      ...previous.units.filter((unit) => unit.id.startsWith('game-')),
    ],
    retainedGameSnapshot: previous.id,
  };
  snapshot.id = identity(snapshot);
  const snapshotPath = resolve('build/snapshots', snapshot.id + '.json');
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
  // assemble verifies every retained cache file/hash; mutable game source is deliberately not rebuilt.
  await assemble(snapshotPath);
  await writeFile(
    'build/snapshots/latest.json',
    JSON.stringify({ snapshotPath, id: snapshot.id }) + '\n',
  );
  return { ...snapshot, snapshotPath };
}

await lock('package-win', async () => {
  const started = performance.now();
  const snapshotArgument = args.find((arg) => arg.startsWith('--snapshot='));
  const platformArgument = args.find((arg) =>
    arg.startsWith('--platform-from='),
  );
  const buildSnapshot = platformArgument
    ? await refreshPlatformSnapshot(platformArgument.slice(16))
    : snapshotArgument
      ? await resumeSnapshot(snapshotArgument.slice('--snapshot='.length))
      : await buildProject(['--production']);
  for (const game of await discover())
    if (
      !game.internal &&
      Object.entries(game.budgets).some(
        ([key, value]) => key.endsWith('Bytes') && value === 0,
      )
    )
      throw new Error('Initialize game budgets before packaging: ' + game.id);
  const maximumBytes = MAXIMUM_PACKAGE_BYTES;
  const budgetBytes = PACKAGE_BUDGET_BYTES;
  const project = JSON.parse(await readFile('package.json', 'utf8'));
  const releases = resolve('artifacts/releases');
  await mkdir(releases, { recursive: true });
  const payloadRoot = resolve(
    'artifacts/package-payloads',
    'v' + project.version,
  );
  await mkdir(payloadRoot, { recursive: true });
  const runOutput = await mkdtemp(
    join(payloadRoot, buildSnapshot.id.slice(0, 12) + '-'),
  );
  const deliveries = [];
  const gamesDirectory = resolve(
    args.find((arg) => arg.startsWith('--games='))?.slice(8) ??
      'artifacts/game-packages/v1.0.6/pages-ready-20261011',
  );
  const catalogSource = join(
    gamesDirectory,
    'TableMax-game-catalog-v1.0.6.json',
  );
  await execute(process.execPath, [
    '--import',
    'tsx',
    'tools/release/verify-game-packages.mjs',
    '--out=' + gamesDirectory,
  ]);
  const catalogBytes = await readFile(catalogSource);
  for (const currentEdition of editions) {
    const output = join(runOutput, currentEdition);
    await mkdir(output);
    const unpacked = join(output, 'win-unpacked');
    await mkdir(unpacked);
    const source = resolve('build/desktop');
    const files = [
      'TableMax.exe',
      'TableMax.exe.config',
      'Microsoft.Web.WebView2.Core.dll',
      'Microsoft.Web.WebView2.WinForms.dll',
      'WebView2Loader.dll',
      'node.exe',
      'Node-LICENSE.txt',
      'WebView2-LICENSE.txt',
      'WebView2-NOTICE.txt',
      'server.cjs',
      'server.cjs.br',
      'bot-worker.cjs',
      'package.json',
    ];
    async function copyTree(from, to) {
      await mkdir(to, { recursive: true });
      for (const item of await readdir(from, { withFileTypes: true })) {
        if (item.isSymbolicLink())
          throw new Error('Release cannot contain linked files: ' + item.name);
        const input = join(from, item.name),
          target = join(to, item.name);
        if (
          /^web\/games\/[^/]+\/(?:web|resources)(?:\/|$)/.test(
            relative(source, input).split(sep).join('/'),
          )
        )
          continue;
        if (item.isDirectory()) await copyTree(input, target);
        else if (item.isFile()) await copyFile(input, target);
      }
    }
    await lock('assemble-' + source, async () => {
      await assertIdle();
      for (const file of files)
        await copyFile(join(source, file), join(unpacked, file));
      for (const directory of ['web'])
        await copyTree(join(source, directory), join(unpacked, directory));
    });
    let preinstalled;
    if (currentEdition === 'full') {
      const envelope = JSON.parse(catalogBytes.toString('utf8'));
      // The verifier checks the project signature and every closure before copying.
      const trustSource = await readFile(
        'apps/server/src/game-packages/project-public-key.ts',
        'utf8',
      );
      const pemLiteral = trustSource.match(/'([^']+)'/)[1];
      const publicKey = pemLiteral.replaceAll('\\n', '\n');
      const verified = await gameReleaseAssets(gamesDirectory, { publicKey });
      const catalog = envelope.payload;
      assert.equal(
        catalog.releases.length,
        8,
        'Full edition requires all eight current variants',
      );
      const ids = new Set(
        catalog.releases.flatMap((release) => [
          release.code,
          ...release.resources,
        ]),
      );
      const bundles = catalog.blobs.filter((blob) => ids.has(blob.id));
      assert.equal(bundles.length, ids.size);
      const bootstrap = join(unpacked, 'preinstalled-games');
      await mkdir(join(bootstrap, 'blobs'), { recursive: true });
      await writeFile(join(bootstrap, 'catalog.json'), catalogBytes);
      await writeFile(
        join(bootstrap, 'bootstrap.json'),
        JSON.stringify(
          {
            schemaVersion: 1,
            releaseIds: catalog.releases.map((release) => release.releaseId),
          },
          null,
          2,
        ) + '\n',
      );
      for (const blob of bundles) {
        const asset = verified.find((file) => file.name === blob.assetName);
        assert.ok(asset);
        const copied = join(bootstrap, 'blobs', blob.id + '.zip');
        await copyFile(asset.path, copied);
        assert.equal(
          createHash('sha256')
            .update(await readFile(copied))
            .digest('hex'),
          blob.archiveSha256,
          'Frozen bootstrap archive changed while copying',
        );
      }
      preinstalled = {
        releaseIds: catalog.releases.map((release) => release.releaseId),
        blobCount: bundles.length,
        archiveBytes: bundles.reduce((sum, blob) => sum + blob.archiveBytes, 0),
        installedBlobBytes: bundles.reduce(
          (sum, blob) => sum + blob.installedBytes,
          0,
        ),
      };
    }
    async function inventory(directory) {
      const records = [];
      async function visit(current) {
        for (const item of await readdir(current, { withFileTypes: true })) {
          const file = join(current, item.name);
          if (item.isSymbolicLink())
            throw new Error('Release contains a linked file');
          if (item.isDirectory()) await visit(file);
          else if (item.isFile())
            records.push({
              path: relative(directory, file).split(sep).join('/'),
              bytes: (await stat(file)).size,
              sha256: createHash('sha256')
                .update(await readFile(file))
                .digest('hex'),
            });
        }
      }
      await visit(directory);
      return records.sort((a, b) => a.path.localeCompare(b.path));
    }
    const records = await inventory(unpacked);
    const assembly = JSON.parse(
      await readFile(
        resolve('build/snapshots', buildSnapshot.id + '-assembly.json'),
        'utf8',
      ),
    );
    const expected = assembly.files.filter(
      (file) =>
        !file.path.startsWith('.tablemax-') &&
        file.path !== 'modules.json' &&
        !/^(games|bots)\//.test(file.path) &&
        !/^web\/games\/[^/]+\/(web|resources)\//.test(file.path),
    );
    expected.push(
      ...records.filter((file) => file.path.startsWith('preinstalled-games/')),
    );
    expected.sort((a, b) => a.path.localeCompare(b.path));
    if (JSON.stringify(records) !== JSON.stringify(expected))
      throw new Error('Materialized package differs from frozen snapshot');
    const unpackedBytes = records.reduce(
      (total, file) => total + file.bytes,
      0,
    );
    if (unpackedBytes >= maximumBytes)
      throw new Error(
        'Unpacked release must be below 120,000,000 bytes: ' + unpackedBytes,
      );
    const name = 'payload.zip';
    const archive = join(output, name);
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '$ErrorActionPreference = "Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:TABLEMAX_PACKAGE_INPUT, $env:TABLEMAX_PACKAGE_OUTPUT, [IO.Compression.CompressionLevel]::Optimal, $false)',
      ],
      {
        env: {
          ...process.env,
          TABLEMAX_PACKAGE_INPUT: unpacked,
          TABLEMAX_PACKAGE_OUTPUT: archive,
        },
      },
    );
    const archiveBytes = (await stat(archive)).size;
    if (archiveBytes >= maximumBytes)
      throw new Error(
        'Release ZIP must be below 120,000,000 bytes: ' + archiveBytes,
      );
    // Inspect actual extraction, rather than relying only on the pre-compression staging folder.
    const extracted = join(output, 'size-verification');
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '$ErrorActionPreference = "Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:TABLEMAX_PACKAGE_OUTPUT, $env:TABLEMAX_PACKAGE_EXTRACT)',
      ],
      {
        env: {
          ...process.env,
          TABLEMAX_PACKAGE_OUTPUT: archive,
          TABLEMAX_PACKAGE_EXTRACT: extracted,
        },
      },
    );
    const actualRecords = await inventory(extracted);
    if (JSON.stringify(actualRecords) !== JSON.stringify(records))
      throw new Error(
        'Actual ZIP extraction does not match the staged file/hash manifest',
      );
    const manifest = {
      durationMs: Math.round(performance.now() - started),
      snapshot: buildSnapshot.id,
      ...(buildSnapshot.retainedGameSnapshot
        ? { retainedGameSnapshot: buildSnapshot.retainedGameSnapshot }
        : {}),
      units: buildSnapshot.units.map(
        ({ id, fingerprint, cached, durationMs }) => ({
          id,
          fingerprint,
          cached,
          durationMs,
        }),
      ),
      version: project.version,
      edition: currentEdition,
      ...(preinstalled ? { preinstalled } : {}),
      generatedAt: new Date().toISOString(),
      runtime: {
        desktop: '.NET Framework 4.8 / shared WebView2',
        architecture: 'x64',
        nodeVersion,
        nodeArchiveSha256,
        webview2Sdk: '1.0.4258.31',
        dotnetSdk: '9.0.102',
      },
      sizeLimitBytes: maximumBytes,
      engineeringBudgetBytes: budgetBytes,
      archive: {
        name,
        bytes: archiveBytes,
        sha256: createHash('sha256')
          .update(await readFile(archive))
          .digest('hex'),
      },
      unpackedBytes,
      extractedBytes: actualRecords.reduce(
        (total, file) => total + file.bytes,
        0,
      ),
      fileCount: records.length,
      files: records,
    };
    await writeFile(
      join(output, 'release-manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    const outputPath = join(
      releases,
      `TableMax-${project.version}-win-x64-${currentEdition}.exe`,
    );
    await assertReleaseIdle(outputPath);
    const executable = await createReleaseExecutable({
      archivePath: archive,
      manifestPath: join(output, 'release-manifest.json'),
      outputPath,
    });
    await writeFile(
      outputPath.replace(/\.exe$/, '-manifest.json'),
      JSON.stringify(
        { ...manifest, executable, internalPayloadPath: archive },
        null,
        2,
      ) + '\n',
    );
    deliveries.push({
      edition: currentEdition,
      archivePath: archive,
      manifestPath: join(output, 'release-manifest.json'),
      executable,
    });
    if (unpackedBytes >= budgetBytes)
      console.warn(
        'Engineering budget exceeded: ' +
          unpackedBytes +
          ' bytes (hard 120 MB gate passed).',
      );
    console.log('Windows EXE: ' + outputPath);
    console.log(
      'ZIP ' +
        archiveBytes +
        ' bytes; actual unpacked files ' +
        unpackedBytes +
        ' bytes; both strictly below ' +
        maximumBytes,
    );
  }
  const pointer = join(payloadRoot, 'current.json');
  await writeFile(
    pointer + '.next',
    JSON.stringify(
      { version: project.version, snapshot: buildSnapshot.id, deliveries },
      null,
      2,
    ) + '\n',
  );
  await rename(pointer + '.next', pointer);
  console.log(JSON.stringify({ deliveries, internalPayloadIndex: pointer }));
});
