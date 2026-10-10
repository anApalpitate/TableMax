import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test(
  'idle coordinator requires identity and real ancestry; active siblings and unknown owners remain protected',
  { skip: process.platform !== 'win32' },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'tablemax-coordinator-test-'));
    try {
      await mkdir(join(root, 'tools/build'), { recursive: true });
      await writeFile(
        join(root, 'tools/build/build.mjs'),
        '// test entrypoint',
      );
      const record = join(
        root,
        'artifacts/maintenance/v1.0.6/automatic-maintenance/test/coordinator.json',
      );
      await mkdir(join(record, '..'), { recursive: true });
      const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
      const harness = join(root, 'coordinator-test.ps1');
      await writeFile(
        harness,
        `
$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath
$workspace=${quote(root)}; $sourceWorkspace=$workspace
$env:TABLEMAX_MAINTENANCE_COORDINATOR=${quote(record)}
$owner=[PSCustomObject]@{Name='node.exe';ProcessId=99101;ParentProcessId=99102;CommandLine='node.exe tools/build/build.mjs';ExecutablePath='E:\\Data\\nodejs\\node.exe';CreationDate=[DateTime]::UtcNow.AddMinutes(-1)}
$parent=[PSCustomObject]@{Name='node.exe';ProcessId=99102;ParentProcessId=99104;CommandLine='node.exe E:\\Data\\pnpm\\pnpm.cjs build';ExecutablePath='E:\\Data\\nodejs\\node.exe'}
$active=[PSCustomObject]@{Name='node.exe';ProcessId=99103;ParentProcessId=99104;CommandLine='node.exe tools/test/games/uno/verify-uno.mjs';ExecutablePath='E:\\Data\\nodejs\\node.exe'}
$current=[PSCustomObject]@{ProcessId=$PID;ParentProcessId=99101}
$testProcesses=@($owner,$parent,$active)
function Get-CimInstance {
  param($ClassName,$Filter)
  if($Filter -eq ('ProcessId='+$PID)){return $current}
  if($Filter){return @($testProcesses|Where-Object {('ProcessId='+$_.ProcessId) -eq $Filter})}
  return @($testProcesses)+@($current)
}
. ${quote(resolve('tools/maintenance/cleanup-guard.ps1'))}
$record=[ordered]@{schemaVersion=1;phase='idle';pid=99101;entrypoint=(Join-Path $workspace 'tools/build/build.mjs');startedAtMs=$owner.CreationDate.Subtract([DateTime]'1970-01-01').TotalMilliseconds}
$record|ConvertTo-Json|Set-Content -LiteralPath $env:TABLEMAX_MAINTENANCE_COORDINATOR
$allowed=@(Get-MaintenanceCoordinatorPids)
if($allowed.Count -ne 2 -or 99103 -in $allowed){throw 'Exemption includes active sibling'}
$blocked=$false;try{Assert-Idle}catch{$blocked=$true};if(-not $blocked){throw 'Active verifier not protected'}
$testProcesses=@($owner,$parent);Assert-Idle
$current.ParentProcessId=99999
$blocked=$false;try{Get-MaintenanceCoordinatorPids}catch{$blocked=$true};if(-not $blocked){throw 'Unrelated parent not blocked'}
$current.ParentProcessId=99101
$owner.CreationDate=$owner.CreationDate.AddMinutes(-10)
$blocked=$false;try{Get-MaintenanceCoordinatorPids}catch{$blocked=$true};if(-not $blocked){throw 'PID reuse not blocked'}
$owner.CreationDate=$owner.CreationDate.AddMinutes(10)
$owner.CommandLine='node.exe unrelated.mjs'
$blocked=$false;try{Get-MaintenanceCoordinatorPids}catch{$blocked=$true};if(-not $blocked){throw 'Unknown command not blocked'}
Write-Output 'Coordinator identity, ancestry and active-process protection passed'
`,
      );
      const result = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harness],
        { encoding: 'utf8', windowsHide: true },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
    } finally {
      assert.ok(root.startsWith(join(tmpdir(), 'tablemax-coordinator-test-')));
      await rm(root, { recursive: true, force: true });
    }
  },
);
