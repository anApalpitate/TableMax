import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const source = readFileSync(
  new URL('../assemble.mjs', import.meta.url),
  'utf8',
);
const command = source.match(
  /const idleCommand = String\.raw`([\s\S]*?)`;/,
)?.[1];
assert.ok(command, 'Verify the PowerShell expression used by assertIdle');
const workspace = resolve('.');
const sourceWorkspace = 'E:\\Proj\\TableMax-source';
const externalPath = 'D:\\aLCYYDS\\IDM下载\\TableMax\\app\\TableMax.exe';
const buildPid = 91000;
const desktop = (ExecutablePath, CommandLine, ProcessId = 91001) => ({
  Name: 'TableMax.exe',
  ExecutablePath,
  CommandLine,
  ProcessId,
});
const cases = [
  {
    name: 'separate downloaded TableMax is allowed',
    process: desktop(externalPath, `"${externalPath}"`),
    busy: false,
  },
  {
    name: 'workspace TableMax remains protected',
    process: desktop(
      `${workspace}\\build\\desktop\\TableMax.exe`,
      'TableMax.exe',
    ),
    busy: true,
  },
  {
    name: 'source workspace TableMax remains protected',
    process: desktop(
      `${sourceWorkspace}\\build\\desktop\\TableMax.exe`,
      'TableMax.exe',
    ),
    busy: true,
  },
  {
    name: 'external executable with workspace arguments remains protected',
    process: desktop(
      externalPath,
      `"${externalPath}" --data="${workspace}\\tmp"`,
    ),
    busy: true,
  },
  {
    name: 'external executable with source workspace arguments remains protected',
    process: desktop(
      externalPath,
      `"${externalPath}" --data="${sourceWorkspace}\\tmp"`,
    ),
    busy: true,
  },
  {
    name: 'forward slash workspace arguments remain protected',
    process: desktop(
      externalPath,
      `"${externalPath}" --data="${workspace.replaceAll('\\', '/')}/tmp"`,
    ),
    busy: true,
  },
  {
    name: 'workspace executable with forward slashes remains protected',
    process: desktop(
      `${workspace.replaceAll('\\', '/')}/build/TableMax.exe`,
      'TableMax.exe',
    ),
    busy: true,
  },
  {
    name: 'unknown executable path remains protected',
    process: desktop(null, `"${externalPath}"`),
    busy: true,
  },
  {
    name: 'whitespace executable path remains protected',
    process: desktop('   ', `"${externalPath}"`),
    busy: true,
  },
  {
    name: 'relative executable path remains protected',
    process: desktop('TableMax\\app\\TableMax.exe', 'TableMax.exe'),
    busy: true,
  },
  {
    name: 'drive-relative executable path remains protected',
    process: desktop('D:TableMax\\app\\TableMax.exe', 'TableMax.exe'),
    busy: true,
  },
  {
    name: 'unknown command line remains protected',
    process: desktop(externalPath, null),
    busy: true,
  },
  {
    name: 'whitespace command line remains protected',
    process: desktop(externalPath, '   '),
    busy: true,
  },
  {
    name: 'external TableMax with verification arguments remains protected',
    process: desktop(
      externalPath,
      `"${externalPath}" scripts/verify-player-interaction-audio.mjs`,
    ),
    busy: true,
  },
  {
    name: 'actual verification Node remains protected',
    process: {
      Name: 'node.exe',
      ExecutablePath: 'D:\\node\\node.exe',
      CommandLine: 'node scripts/verify-player-interaction-audio.mjs',
      ProcessId: 91001,
    },
    busy: true,
  },
  {
    name: 'native verification dotnet remains protected',
    process: {
      Name: 'dotnet.exe',
      ExecutablePath: 'D:\\dotnet\\dotnet.exe',
      CommandLine: 'dotnet apps/desktop/native/TableMax.csproj',
      ProcessId: 91001,
    },
    busy: true,
  },
  {
    name: 'current build PID is ignored',
    process: desktop(
      `${workspace}\\build\\desktop\\TableMax.exe`,
      null,
      buildPid,
    ),
    busy: false,
  },
];

let results;
if (process.platform === 'win32') {
  const fixtures = Buffer.from(JSON.stringify(cases), 'utf8').toString(
    'base64',
  );
  // Replace only process inventory. Execute the production predicate unchanged.
  const script = `
    $cases = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${fixtures}')) | ConvertFrom-Json
    function Get-CimInstance { param($ClassName) $script:inventory }
    $predicate = [ScriptBlock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(command, 'utf8').toString('base64')}')))
    $results = foreach ($case in $cases) {
      $script:inventory = @($case.process)
      try {
        & $predicate | Out-Null
        [pscustomobject]@{ name = $case.name; busy = $false; error = $null }
      } catch {
        [pscustomobject]@{ name = $case.name; busy = $true; error = $_.Exception.Message }
      }
    }
    ConvertTo-Json -InputObject @($results) -Compress
  `;
  const run = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    env: {
      ...process.env,
      TABLEMAX_BUILD_PID: String(buildPid),
      TABLEMAX_BUILD_WORKSPACE: workspace,
      TABLEMAX_SOURCE_WORKSPACE: sourceWorkspace,
    },
  });
  assert.equal(run.status, 0, run.stderr || run.error?.message);
  results = JSON.parse(run.stdout.trim());
  assert.equal(results.length, cases.length);
}

for (const [index, item] of cases.entries()) {
  test(item.name, { skip: process.platform !== 'win32' }, () => {
    const result = results[index];
    assert.equal(result.name, item.name);
    assert.equal(result.busy, item.busy, result.error || item.name);
    if (item.busy) {
      assert.match(result.error, /Engineering process busy: 91001/);
    }
  });
}
