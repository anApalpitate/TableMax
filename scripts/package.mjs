import './build.mjs';
import { resolve, join, relative, sep } from 'node:path';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execute, nodeVersion, nodeArchiveSha256 } from './setup-desktop.mjs';

const maximumBytes = 100000000;
const budgetBytes = 95000000;
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
    if (item.isDirectory()) await copyTree(input, target);
    else if (item.isFile()) await copyFile(input, target);
  }
}
for (const file of files)
  await copyFile(join(source, file), join(unpacked, file));
for (const directory of ['games', 'bots', 'web'])
  await copyTree(join(source, directory), join(unpacked, directory));
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
const unpackedBytes = records.reduce((total, file) => total + file.bytes, 0);
if (unpackedBytes >= maximumBytes)
  throw new Error(
    'Unpacked release must be below 100,000,000 bytes: ' + unpackedBytes,
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
    'Release ZIP must be below 100,000,000 bytes: ' + archiveBytes,
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
  extractedBytes: actualRecords.reduce((total, file) => total + file.bytes, 0),
  fileCount: records.length,
  files: records,
};
await writeFile(
  join(output, 'release-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
await copyFile(archive, join(releases, name));
await copyFile(
  join(output, 'release-manifest.json'),
  join(releases, 'TableMax-' + project.version + '-win-x64-manifest.json'),
);
if (unpackedBytes >= budgetBytes)
  console.warn(
    'Engineering budget exceeded: ' +
      unpackedBytes +
      ' bytes (hard 100 MB gate passed).',
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
