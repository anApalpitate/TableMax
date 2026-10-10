import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from './lib/package-limits.mjs';
import { buildProject } from './build.mjs';
import { scheduleMaintenance } from '../tools/maintenance/lifecycle.mjs';
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
  rm,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execute, nodeVersion, nodeArchiveSha256 } from './setup-desktop.mjs';
import { lock, discover, validateInputs } from './module-build.mjs';
import { assemble, assertIdle } from './assemble.mjs';

const args = process.argv.slice(2);
assert.ok(
  args.length <= 1 && args.every((arg) => arg.startsWith('--snapshot=')),
);
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

await lock('package-win', async () => {
  const started = performance.now();
  const buildSnapshot = args.length
    ? await resumeSnapshot(args[0].slice('--snapshot='.length))
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
  const output = await mkdtemp(
    resolve(releases, 'package-' + project.version + '-'),
  );
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
    'modules.json',
  ];
  async function copyTree(from, to) {
    await mkdir(to, { recursive: true });
    for (const item of await readdir(from, { withFileTypes: true })) {
      if (item.isSymbolicLink())
        throw new Error('Release cannot contain linked files: ' + item.name);
      const input = join(from, item.name),
        target = join(to, item.name);
      if (item.isDirectory()) await copyTree(input, target);
      else if (item.isFile()) await copyFile(input, target);
    }
  }
  await lock('assemble-' + source, async () => {
    await assertIdle();
    for (const file of files)
      await copyFile(join(source, file), join(unpacked, file));
    for (const directory of ['games', 'bots', 'web'])
      await copyTree(join(source, directory), join(unpacked, directory));
  });
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
    (file) => !file.path.startsWith('.tablemax-'),
  );
  if (JSON.stringify(records) !== JSON.stringify(expected))
    throw new Error('Materialized package differs from frozen snapshot');
  const unpackedBytes = records.reduce((total, file) => total + file.bytes, 0);
  if (unpackedBytes >= maximumBytes)
    throw new Error(
      'Unpacked release must be below 120,000,000 bytes: ' + unpackedBytes,
    );
  const name = 'TableMax-' + project.version + '-win-x64.zip';
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
    units: buildSnapshot.units.map(
      ({ id, fingerprint, cached, durationMs }) => ({
        id,
        fingerprint,
        cached,
        durationMs,
      }),
    ),
    version: project.version,
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
  const targets = [
    { from: archive, to: join(releases, name) },
    {
      from: join(output, 'release-manifest.json'),
      to: join(
        releases,
        'TableMax-' + project.version + '-win-x64-manifest.json',
      ),
    },
  ];
  const replaced = [];
  try {
    for (const target of targets) {
      const next = target.to + '.next-' + process.pid,
        previous = target.to + '.previous-' + process.pid;
      await copyFile(target.from, next);
      let existed = false;
      try {
        await rename(target.to, previous);
        existed = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      replaced.push({ to: target.to, previous, existed });
      await rename(next, target.to);
    }
  } catch (error) {
    for (const target of replaced.reverse()) {
      await rm(target.to, { force: true });
      if (target.existed) await rename(target.previous, target.to);
    }
    throw error;
  }
  for (const target of replaced) await rm(target.previous, { force: true });
  if (unpackedBytes >= budgetBytes)
    console.warn(
      'Engineering budget exceeded: ' +
        unpackedBytes +
        ' bytes (hard 120 MB gate passed).',
    );
  console.log('Release ZIP: ' + join(releases, name));
  console.log(
    'ZIP ' +
      archiveBytes +
      ' bytes; actual unpacked files ' +
      unpackedBytes +
      ' bytes; both strictly below ' +
      maximumBytes,
  );
});
