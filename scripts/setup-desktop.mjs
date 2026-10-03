import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export const nodeVersion = '22.14.0';
export const nodeArchiveSha256 =
  '55b639295920b219bb2acbcfa00f90393a2789095b7323f79475c9f34795f217';
export const nodeRuntime = resolve('.cache/node/' + nodeVersion + '/runtime');
const nativePackages = [
  [
    'microsoft.web.webview2',
    '1.0.4258.31',
    'HlGVwvyP/IWiXAU8K57Vmg59khY3DWMOxMnH4AHusFRy0/vDAjKItXUIVNXiXXaq4CLfSZyNUic1wOIlnPLsPQ==',
  ],
  [
    'microsoft.netframework.referenceassemblies.net48',
    '1.0.3',
    'XWKgyeNadNcTQaIVvQB8BrdCNrEar6fo/de1OdQRZ9HFy0jcBSaM8IV5q64ZampsSnC8AlTsACaGZUuoFw41RA==',
  ],
];
const archiveName = 'node-v' + nodeVersion + '-win-x64.zip';
const cache = resolve('.cache/node/' + nodeVersion);
const archive = join(cache, archiveName);
export async function execute(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });
  await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? done() : reject(new Error(command + ' exited with ' + code)),
    );
  });
}
async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
export async function prepareDesktop() {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('This project targets Windows x64');
  await mkdir(cache, { recursive: true });
  if (!(await exists(archive))) {
    const response = await fetch(
      'https://nodejs.org/dist/v' + nodeVersion + '/' + archiveName,
      {
        signal: AbortSignal.timeout(600000),
      },
    );
    if (!response.ok)
      throw new Error('Official Node download failed: ' + response.status);
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  }
  const actual = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  if (actual !== nodeArchiveSha256)
    throw new Error(
      'Official Node archive SHA-256 mismatch; cache preserved for inspection',
    );
  await mkdir(nodeRuntime, { recursive: true });
  if (
    !(await exists(join(nodeRuntime, 'node.exe'))) ||
    !(await exists(join(nodeRuntime, 'LICENSE')))
  ) {
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '$ErrorActionPreference = "Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::OpenRead($env:TABLEMAX_NODE_ARCHIVE); try { foreach ($name in @("node.exe", "LICENSE")) { $entry = $zip.GetEntry("node-v22.14.0-win-x64/" + $name); [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $env:TABLEMAX_NODE_RUNTIME $name), $true) } } finally { $zip.Dispose() }',
      ],
      {
        env: {
          ...process.env,
          TABLEMAX_NODE_ARCHIVE: archive,
          TABLEMAX_NODE_RUNTIME: nodeRuntime,
        },
      },
    );
  }
  // Validate the installed cache against entries in the verified official archive.
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      '$ErrorActionPreference = "Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::OpenRead($env:TABLEMAX_NODE_ARCHIVE); try { foreach ($name in @("node.exe", "LICENSE")) { $entry = $zip.GetEntry("node-v22.14.0-win-x64/" + $name); $input = $entry.Open(); $sha = [Security.Cryptography.SHA256]::Create(); try { $expected = [BitConverter]::ToString($sha.ComputeHash($input)).Replace("-", "").ToLowerInvariant(); $cached = [IO.File]::OpenRead((Join-Path $env:TABLEMAX_NODE_RUNTIME $name)); try { $actual = [BitConverter]::ToString($sha.ComputeHash($cached)).Replace("-", "").ToLowerInvariant() } finally { $cached.Dispose() }; if ($expected -ne $actual) { throw "Cached runtime hash mismatch: $name" } } finally { $input.Dispose(); $sha.Dispose() } } } finally { $zip.Dispose() }',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_NODE_ARCHIVE: archive,
        TABLEMAX_NODE_RUNTIME: nodeRuntime,
      },
    },
  );
  console.log(
    'Verified official Windows x64 Node ' + nodeVersion + ': ' + actual,
  );
  const nativeSource = resolve('.cache/nuget-downloads');
  await mkdir(nativeSource, { recursive: true });
  for (const [id, version, expected] of nativePackages) {
    const name = id + '.' + version + '.nupkg';
    const file = join(nativeSource, name);
    if (!(await exists(file))) {
      const cached = resolve('.cache/nuget', id, version, name);
      if (await exists(cached)) await writeFile(file, await readFile(cached));
      else {
        const response = await fetch(
          'https://api.nuget.org/v3-flatcontainer/' +
            id +
            '/' +
            version +
            '/' +
            name,
          { signal: AbortSignal.timeout(600000) },
        );
        if (!response.ok)
          throw new Error('Official NuGet package download failed: ' + id);
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
      }
    }
    if (
      createHash('sha512')
        .update(await readFile(file))
        .digest('base64') !== expected
    )
      throw new Error('Locked official NuGet package hash mismatch: ' + id);
  }
  await execute(
    'dotnet',
    [
      'restore',
      resolve('apps/desktop/native/TableMax.csproj'),
      '--locked-mode',
      '--source',
      nativeSource,
    ],
    {
      env: {
        ...process.env,
        DOTNET_CLI_HOME: resolve('.cache/dotnet-home'),
        DOTNET_NOLOGO: '1',
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      },
    },
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve('scripts/setup-desktop.mjs')
)
  await prepareDesktop();
