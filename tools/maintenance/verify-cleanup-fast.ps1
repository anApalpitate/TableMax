$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Add-Type -Path (Join-Path $PSScriptRoot 'WorkspaceSnapshot.cs')
$work = Join-Path $workspace ('tmp/cleanup-fast-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $work | Out-Null
for ($index=0; $index -lt 1000; $index++) { [IO.File]::WriteAllText((Join-Path $work ('file-'+$index+'.txt')),'test metadata') }
$watch = [Diagnostics.Stopwatch]::StartNew()
$first = [TableMax.WorkspaceSnapshotV2]::Read($work)
$watch.Stop()
$fastMs = $watch.Elapsed.TotalMilliseconds
$watch.Restart()
$legacyBytes = 0L; $legacyCount = 1
Get-ChildItem -LiteralPath $work -Force -Recurse | ForEach-Object { $legacyCount++; if (-not $_.PSIsContainer) { $legacyBytes += $_.Length } }
$watch.Stop()
$legacyEnumerationMs = $watch.Elapsed.TotalMilliseconds
if ($first.Bytes -ne $legacyBytes -or $first.Entries -ne $legacyCount) { throw 'Snapshot counts differ from actual provider enumeration.' }
if ($first.Fingerprint -ne [TableMax.WorkspaceSnapshotV2]::Read($work).Fingerprint) { throw 'Unchanged metadata fingerprint is unstable.' }
[IO.File]::AppendAllText((Join-Path $work 'file-0.txt'),'changed')
if ($first.Fingerprint -eq [TableMax.WorkspaceSnapshotV2]::Read($work).Fingerprint) { throw 'Changed candidate was not detected.' }
$repository = Join-Path $work 'nested'
New-Item -ItemType Directory $repository | Out-Null
[IO.File]::WriteAllText((Join-Path $repository '.git'),'gitdir: elsewhere')
$rejected = $false
try { [TableMax.WorkspaceSnapshotV2]::Read($work) | Out-Null } catch { $rejected = $true }
if (-not $rejected) { throw 'Nested worktree metadata was accepted.' }
Remove-Item -LiteralPath (Join-Path $repository '.git') -Force
$outside = Join-Path $workspace ('tmp/cleanup-fast-sentinel-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $outside | Out-Null
[IO.File]::WriteAllText((Join-Path $outside 'save.db'),'preserved')
$link = Join-Path $work 'linked'
New-Item -ItemType Junction -Path $link -Target $outside | Out-Null
try {
  $rejected = $false
  try { [TableMax.WorkspaceSnapshotV2]::Read($work) | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'Linked directory was accepted.' }
  if ([IO.File]::ReadAllText((Join-Path $outside 'save.db')) -ne 'preserved') { throw 'Outside sentinel changed.' }
} finally { [IO.Directory]::Delete($link) }
$version = (Get-Content (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json).version
$output = Join-Path $workspace ('artifacts/maintenance/v'+$version+'/github-release-20261005')
New-Item -ItemType Directory -Force $output | Out-Null
@{result='passed';checks=5;files=1000;fastSnapshotMs=$fastMs;providerEnumerationMs=$legacyEnumerationMs;work=$work;scope='Actual metadata counts, deterministic reuse, modification, nested worktree and junction refusal; timing compares full hashed snapshot with provider enumeration only, not old complete cleanup.'} | ConvertTo-Json | Set-Content (Join-Path $output 'cleanup-fast-tests.json') -Encoding utf8
Write-Output '5 fast snapshot checks passed.'
