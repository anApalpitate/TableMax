import {
  readFile,
  writeFile,
  mkdir,
  rename,
  rm,
  copyFile,
  access,
} from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { json, inventory, lock, validateCached } from './module-build.mjs';
const run = promisify(execFile);
const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function assertIdle() {
  if (process.platform !== 'win32') return;
  const idleCommand = String.raw`
    $taskWorkspace = [IO.Path]::GetFullPath($env:TABLEMAX_BUILD_WORKSPACE).TrimEnd('\')
    $taskSourceWorkspace = [IO.Path]::GetFullPath($env:TABLEMAX_SOURCE_WORKSPACE).TrimEnd('\')
    $taskIdleCoordinators = @()
    if ($env:TABLEMAX_MAINTENANCE_COORDINATOR) {
      $workspace = $taskWorkspace; $sourceWorkspace = $taskSourceWorkspace
      . (Join-Path $taskSourceWorkspace 'scripts/cleanup-guard.ps1')
      $taskIdleCoordinators = @(Get-MaintenanceCoordinatorPids)
    }
    $taskBusy = @(Get-CimInstance Win32_Process | Where-Object {
      $taskExecutable = [string]$_.ExecutablePath
      $taskCommandLine = [string]$_.CommandLine
      $unrelatedDesktop = $false
      # A downloaded app uses its own runtime tree; unknown paths/arguments stay protected.
      if ($_.Name -eq 'TableMax.exe' -and
          -not [string]::IsNullOrWhiteSpace($taskExecutable) -and
          -not [string]::IsNullOrWhiteSpace($taskCommandLine) -and
          [IO.Path]::IsPathRooted($taskExecutable) -and
          $taskExecutable -match '^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+[\\/])') {
        try {
          $taskExecutable = [IO.Path]::GetFullPath($taskExecutable)
          $taskCommandLine = $taskCommandLine.Replace('/', '\')
          $unrelatedDesktop =
            -not $taskExecutable.StartsWith($taskWorkspace + '\', [StringComparison]::OrdinalIgnoreCase) -and
            -not $taskExecutable.StartsWith($taskSourceWorkspace + '\', [StringComparison]::OrdinalIgnoreCase) -and
            $taskCommandLine.IndexOf($taskWorkspace, [StringComparison]::OrdinalIgnoreCase) -lt 0 -and
            $taskCommandLine.IndexOf($taskSourceWorkspace, [StringComparison]::OrdinalIgnoreCase) -lt 0
        } catch { $unrelatedDesktop = $false }
      }
      $_.Name -match '^(TableMax|node|dotnet|MSBuild)\.exe$' -and
        $_.ProcessId -ne [int]$env:TABLEMAX_BUILD_PID -and $_.ProcessId -notin $taskIdleCoordinators -and (
          [string]::IsNullOrWhiteSpace($taskCommandLine) -or
          ($_.Name -eq 'TableMax.exe' -and -not $unrelatedDesktop) -or
          $taskCommandLine -match '(scripts[\\/](verify|dev|launch)|apps[\\/]desktop[\\/]native|vitest)'
        )
    })
    if ($taskBusy.Count) { throw ('Engineering process busy: ' + (($taskBusy.ProcessId) -join ',')) }
  `;
  const { stdout } = await run(
    'powershell.exe',
    ['-NoProfile', '-Command', idleCommand],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_BUILD_PID: String(process.pid),
        TABLEMAX_BUILD_WORKSPACE: resolve('.'),
        TABLEMAX_SOURCE_WORKSPACE: dirname(
          createRequire(import.meta.url).resolve('../package.json'),
        ),
      },
    },
  );
  return stdout;
}
export async function assemble(
  snapshotPath,
  output = resolve('build/desktop'),
) {
  if (output !== resolve('build/desktop'))
    throw new Error('Assembly output must be the fixed development directory');
  const started = performance.now();
  const snapshot = await json(snapshotPath);
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.version !== (await json('package.json')).version ||
    snapshot.assemblerSha256 !== hash(await readFile('scripts/assemble.mjs'))
  )
    throw new Error('Incompatible build snapshot');
  const expected = [
    'platform-runtime',
    'platform-box',
    'platform-server',
    'platform-worker',
    'platform-node',
    'platform-native',
    ...snapshot.modules.flatMap((item) =>
      ['rules', 'bot', 'web', 'metadata'].map(
        (part) => `game-${item.id}-${part}`,
      ),
    ),
  ];
  if (
    new Set(snapshot.units.map((unit) => unit.id)).size !== expected.length ||
    snapshot.units.length !== expected.length ||
    expected.some((id) => !snapshot.units.some((unit) => unit.id === id))
  )
    throw new Error('Incomplete build snapshot');
  for (const unit of snapshot.units)
    if (
      resolve(unit.directory) !==
      resolve('.cache/build-modules/v1', unit.id, unit.fingerprint)
    )
      throw new Error('Invalid snapshot cache path');
  return lock('assemble-' + output, async () => {
    await assertIdle();
    const staging = output + '.staging-' + process.pid,
      previous = output + '.previous-' + process.pid;
    await mkdir(staging, { recursive: true });
    const claims = new Set();
    const copy = async (from, to) => {
      const target = to.replaceAll('\\', '/');
      if (
        target.includes('..') ||
        target.startsWith('/') ||
        claims.has(target.toLowerCase())
      )
        throw new Error('Output collision or invalid path: ' + target);
      claims.add(target.toLowerCase());
      await mkdir(dirname(join(staging, target)), { recursive: true });
      await copyFile(from, join(staging, target));
    };
    try {
      for (const unit of snapshot.units) {
        const validated = await validateCached(unit.directory);
        if (
          validated.fingerprint !== unit.fingerprint ||
          JSON.stringify(validated.files) !== JSON.stringify(unit.files)
        )
          throw new Error('Snapshot changed: ' + unit.id);
        for (const file of unit.files) {
          let target = file.path;
          if (unit.id === 'platform-box') target = 'web/' + file.path;
          else if (unit.id === 'platform-runtime')
            target = 'web/runtime/v1/' + file.path;
          else if (unit.id.startsWith('game-')) {
            const game = snapshot.modules.find((item) =>
              ['rules', 'bot', 'web', 'metadata'].some(
                (part) => unit.id === `game-${item.id}-${part}`,
              ),
            );
            if (!game) throw new Error('Unknown game output');
            const part = unit.id.slice(('game-' + game.id + '-').length);
            if (part === 'metadata')
              target = `web/games/${game.id}/metadata/${file.path}`;
            else if (part === 'web')
              target = `web/games/${game.id}/web/${file.path}`;
            else target = `${part === 'rules' ? 'games' : 'bots'}/${file.path}`;
          }
          await copy(join(unit.directory, 'files', file.path), target);
        }
      }
      const modules = snapshot.modules.map((item) => {
        if (
          item.compatibility.sdk !== 1 ||
          item.compatibility.protocol !== 7 ||
          item.compatibility.webHost !== 1
        )
          throw new Error('Incompatible module ' + item.id);
        const web = snapshot.units.find(
          (unit) => unit.id === `game-${item.id}-web`,
        );
        if (!web) throw new Error('Missing web unit');
        return {
          ...item,
          cover: item.cover ? `/games/${item.id}/metadata/cover.webp` : null,
          entries: {
            rules: `games/${item.id}.cjs`,
            bot: `bots/${item.id}.cjs`,
            web: `/games/${item.id}/web/entry.js`,
          },
          styles: web.files
            .filter((file) => file.path.endsWith('.css'))
            .map((file) => `/games/${item.id}/web/${file.path}`),
        };
      });
      for (const item of snapshot.modules) {
        const metadata = await json(
          join(staging, `web/games/${item.id}/metadata/module.json`),
        );
        if (JSON.stringify(metadata) !== JSON.stringify(item))
          throw new Error('Snapshot metadata changed');
        const require = createRequire(import.meta.url);
        const rulesPath = join(staging, 'games', item.id + '.cjs'),
          botPath = join(staging, 'bots', item.id + '.cjs');
        delete require.cache[require.resolve(rulesPath)];
        delete require.cache[require.resolve(botPath)];
        const { rules } = require(rulesPath),
          { bot } = require(botPath),
          actual = rules.manifest;
        if (
          actual.id !== item.id ||
          actual.sdkVersion !== item.compatibility.sdk ||
          actual.rulesVersion !== item.compatibility.rulesVersion ||
          actual.gameVersion !== item.compatibility.gameVersion ||
          actual.stateVersion !== item.compatibility.stateVersion ||
          actual.players.min !== item.catalog.min ||
          actual.players.max !== item.catalog.max ||
          bot.version !== item.compatibility.strategyVersion ||
          bot.rulesVersion !== item.compatibility.rulesVersion
        )
          throw new Error('Incompatible compiled module ' + item.id);
      }
      await writeFile(
        join(staging, 'modules.json'),
        JSON.stringify(modules, null, 2) + '\n',
      );
      const catalog = modules.map(({ entries, ...item }) => ({
        ...item,
        entries: { web: entries.web },
      }));
      await writeFile(
        join(staging, 'web/catalog.json'),
        JSON.stringify(catalog) + '\n',
      );
      const runtime = snapshot.units.find(
        (unit) => unit.id === 'platform-runtime',
      );
      const links = runtime.files
        .filter((file) => file.path.endsWith('.css'))
        .map(
          (file) => `<link rel="stylesheet" href="/runtime/v1/${file.path}">`,
        )
        .join('');
      const index = join(staging, 'web/index.html');
      await writeFile(
        index,
        (await readFile(index, 'utf8')).replace('</head>', links + '</head>'),
      );
      await writeFile(
        join(staging, 'package.json'),
        JSON.stringify(
          {
            name: 'tablemax-desktop',
            version: snapshot.version,
            private: true,
            desktopRuntime: 'net48-webview2',
            nodeVersion: '22.14.0',
          },
          null,
          2,
        ) + '\n',
      );
      if (output === resolve('build/desktop'))
        await writeFile(
          join(staging, '.tablemax-development.json'),
          JSON.stringify({
            version: 1,
            repositoryRoot: resolve('.'),
            outputDirectory: output,
          }) + '\n',
        );
      for (const unit of snapshot.units) await validateCached(unit.directory);
      const payload = await inventory(staging);
      const warnings = [];
      for (const game of modules) {
        const bytes = payload
          .filter(
            (file) =>
              file.path === `games/${game.id}.cjs` ||
              file.path === `bots/${game.id}.cjs` ||
              file.path === `bots/${game.id}.cjs.br` ||
              file.path.startsWith(`web/games/${game.id}/`),
          )
          .reduce((sum, file) => sum + file.bytes, 0);
        if (!game.budgets.payloadBytes || bytes > game.budgets.payloadBytes)
          warnings.push({
            gameId: game.id,
            metric: 'payloadBytes',
            actual: bytes,
            budget: game.budgets.payloadBytes,
            action: 'Rectify; do not increase budget automatically.',
          });
      }
      await mkdir(resolve('build/snapshots'), { recursive: true });
      await writeFile(
        resolve('build/snapshots', snapshot.id + '-assembly.json'),
        JSON.stringify(
          {
            snapshot: snapshot.id,
            durationMs: Math.round(performance.now() - started),
            files: payload,
            sha256: hash(JSON.stringify(payload)),
            warnings,
          },
          null,
          2,
        ) + '\n',
      );
      try {
        await access(output);
        await rename(output, previous);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      try {
        await rename(staging, output);
      } catch (error) {
        try {
          await rename(previous, output);
        } catch {
          /* Nothing existed. */
        }
        throw error;
      }
      await rm(previous, { recursive: true, force: true });
      console.log(
        JSON.stringify({ assembled: output, snapshot: snapshot.id, warnings }),
      );
      return output;
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      throw error;
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve('scripts/assemble.mjs')
) {
  const path = process.argv
    .find((value) => value.startsWith('--snapshot='))
    ?.slice(11);
  if (!path)
    throw new Error('assemble:win requires --snapshot=<frozen manifest>');
  await assemble(resolve(path));
}
