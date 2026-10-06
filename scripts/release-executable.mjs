import { createHash } from 'node:crypto';
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  stat,
  rename,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { execute } from './setup-desktop.mjs';
// Packaging a separate release file need not stop a downloaded copy running
// elsewhere. Unknown desktop paths and engineering validation remain protected.
export async function assertReleaseIdle(outputPath) {
  if (process.platform !== 'win32') return;
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      "$taskBusy = @(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne [int]$env:TABLEMAX_BUILD_PID -and (($_.Name -eq 'TableMax.exe' -and (-not $_.ExecutablePath -or -not $_.CommandLine -or ([string]$_.ExecutablePath).StartsWith($env:TABLEMAX_RELEASE_ROOT + '\\', [StringComparison]::OrdinalIgnoreCase) -or ([string]$_.CommandLine).IndexOf($env:TABLEMAX_RELEASE_ROOT, [StringComparison]::OrdinalIgnoreCase) -ge 0)) -or ($_.Name -match '^(node|dotnet|MSBuild)\\.exe$' -and $_.CommandLine -match '(scripts[\\/](verify|dev|launch)|apps[\\/]desktop[\\/]native|vitest)')) }); if ($taskBusy.Count) { throw ('Release target or engineering verification busy: ' + (($taskBusy.ProcessId) -join ',')) }",
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_BUILD_PID: String(process.pid),
        TABLEMAX_RELEASE_ROOT: resolve(outputPath, '..'),
      },
    },
  );
}
export async function createReleaseExecutable({
  archivePath,
  manifestPath,
  outputPath,
}) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version))
    throw new Error('Invalid release version');
  const payload = await readFile(archivePath);
  if (
    payload.length >= 100000000 ||
    createHash('sha256').update(payload).digest('hex') !==
      manifest.archive.sha256
  )
    throw new Error('Payload does not match frozen manifest');
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/release-executable-'));
  const output = join(work, 'TableMax.exe');
  const metadata = join(work, 'AssemblyInfo.cs');
  await writeFile(
    metadata,
    `using System.Reflection;\n[assembly: AssemblyTitle("TableMax")]\n[assembly: AssemblyProduct("TableMax")]\n[assembly: AssemblyVersion("${manifest.version}.0")]\n[assembly: AssemblyFileVersion("${manifest.version}.0")]\n`,
  );
  const framework = join(
    process.env.WINDIR,
    'Microsoft.NET/Framework64/v4.0.30319',
  );
  await execute(join(framework, 'csc.exe'), [
    '/nologo',
    '/target:winexe',
    '/platform:x64',
    '/optimize+',
    '/warnaserror+',
    `/out:${output}`,
    `/win32icon:${resolve('assets/platform/app-icon.ico')}`,
    `/win32manifest:${resolve('apps/desktop/native/app.manifest')}`,
    ...[
      'System.Windows.Forms',
      'System.Drawing',
      'System.Web.Extensions',
      'System.IO.Compression',
      'System.IO.Compression.FileSystem',
    ].map((name) => `/reference:${join(framework, name + '.dll')}`),
    `/resource:${resolve(archivePath)},payload.zip`,
    `/resource:${resolve(manifestPath)},payload.json`,
    resolve('apps/desktop/release/Launcher.cs'),
    resolve('apps/desktop/native/StorageConfiguration.cs'),
    metadata,
  ]);
  const bytes = (await stat(output)).size;
  if (bytes >= 100000000)
    throw new Error('Single EXE must be strictly below 100,000,000 bytes');
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await rename(output, resolve(outputPath));
  return {
    path: resolve(outputPath),
    bytes,
    sha256: createHash('sha256')
      .update(await readFile(outputPath))
      .digest('hex'),
    payloadSha256: manifest.archive.sha256,
  };
}
