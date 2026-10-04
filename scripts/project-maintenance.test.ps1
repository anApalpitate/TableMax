param([string]$EvidenceDirectory)

$ErrorActionPreference = 'Stop'
$workspaceForTest = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$fixture = Join-Path $workspaceForTest ('tmp/maintenance-test-' + [Guid]::NewGuid().ToString('N'))
$primary = Join-Path $fixture 'primary'
$secondary = Join-Path $fixture 'secondary'
$foreign = Join-Path $fixture 'foreign'
$link = Join-Path $primary 'linked-copy'
$checks = New-Object 'System.Collections.Generic.List[string]'
$busyProcess = $null
$lockProcess = $null

function Check([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw ('FAILED: ' + $Message) }
  $checks.Add($Message)
}
function Fixture-File([string]$Relative, [long]$Bytes = 100, [int]$AgeHours = 2) {
  $path = Join-Path $primary $Relative
  New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
  $stream = [IO.File]::Open($path, [IO.FileMode]::Create, [IO.FileAccess]::Write)
  try { $stream.SetLength($Bytes) } finally { $stream.Dispose() }
  (Get-Item -LiteralPath $path).LastWriteTimeUtc = [DateTime]::UtcNow.AddHours(-$AgeHours)
  return $path
}
function Run-Maintenance([bool]$Apply = $false, [double]$High = 0.001, [double]$Low = 0.0005, [string]$ScriptRoot = $primary) {
  & (Join-Path $ScriptRoot 'Maintain-Project.ps1') -Apply:$Apply -HighWaterGiB $High -LowWaterGiB $Low
}
function Git-At([string]$Root, [string[]]$Arguments) {
  & git --no-optional-locks -C $Root @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw ('Fixture Git command failed: ' + ($Arguments -join ' ')) }
}

try {
  New-Item -ItemType Directory -Path (Join-Path $primary 'scripts') -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $primary 'package.json'), '{"name":"tablemax","version":"1.6.0"}')
  Copy-Item -LiteralPath (Join-Path $workspaceForTest 'Maintain-Project.ps1') -Destination $primary
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'cleanup-local.ps1') -Destination (Join-Path $primary 'scripts')
  Git-At $primary @('init', '--quiet')
  Git-At $primary @('add', '.')
  Git-At $primary @('-c', 'user.name=TableMax test', '-c', 'user.email=test@localhost', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Fixture only')
  Git-At $primary @('worktree', 'add', '--quiet', '--detach', $secondary)

  $initial = Run-Maintenance
  Check ($initial.result -eq 'below-threshold') 'Below threshold is a read-only no-op without a release ZIP'
  Check (-not (Test-Path -LiteralPath (Join-Path $primary 'artifacts'))) 'A no-op creates no logs or directories'
  $fromSecondary = Run-Maintenance $false 0.001 0.0005 $secondary
  Check ($fromSecondary.workspace -eq $primary -and $fromSecondary.bytesBefore -eq $initial.bytesBefore) 'Worktree invocation measures the main workspace once, not both checkouts'
  $explicit = & (Join-Path $secondary 'Maintain-Project.ps1') -ProjectRoot $secondary
  Check ($explicit.workspace -eq $secondary -and $explicit.result -eq 'below-threshold') 'Explicit same-repository checkout is supported'

  New-Item -ItemType Directory -Path $foreign -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $foreign 'package.json'), '{"name":"tablemax","version":"1.6.0"}')
  Git-At $foreign @('init', '--quiet')
  $refused = $false
  try { & (Join-Path $primary 'Maintain-Project.ps1') -ProjectRoot $foreign | Out-Null }
  catch { $refused = $_.Exception.Message -like '*unrelated projects*' }
  Check $refused 'An unrelated repository is rejected despite the same package name'

  $old = Fixture-File 'artifacts/releases/TableMax-1.4.0-win-x64.zip' 2MB 4
  $busyProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('-e', 'setInterval(()=>{},1000)', $primary) -WindowStyle Hidden -PassThru
  Start-Sleep -Milliseconds 250
  $busy = Run-Maintenance $true
  Check ($busy.result -eq 'blocked' -and $busy.reason -like '*Busy PIDs*' -and (Test-Path -LiteralPath $old)) 'Automatic maintenance preserves files while the runtime is active'
  $busyProcess.Kill(); $busyProcess.WaitForExit(); $busyProcess = $null
  $blocked = Run-Maintenance $true
  Check ($blocked.result -eq 'blocked' -and $blocked.reason -like '*ZIP is missing*' -and (Test-Path -LiteralPath $old)) 'Missing verified current ZIP preserves all candidates'
  $current = Fixture-File 'artifacts/releases/TableMax-1.6.0-win-x64.zip' 100
  $unverified = Run-Maintenance $true
  Check ($unverified.result -eq 'blocked' -and $unverified.reason -like '*No passing portable evidence*') 'An unverified ZIP also blocks automatic deletion'
  $hash = (Get-FileHash -LiteralPath $current -Algorithm SHA256).Hash.ToLowerInvariant()
  $proof = Fixture-File 'artifacts/maintenance/portable/results.json' 0
  [IO.File]::WriteAllText($proof, ('{"portable":true,"result":"passed","archiveSha256":"' + $hash + '"}'))
  $preview = Run-Maintenance
  Check ($preview.result -eq 'preview' -and $preview.candidateCount -eq 1 -and (Test-Path -LiteralPath $old)) 'Threshold preview discovers candidates without deleting'
  Check (@(Get-ChildItem -LiteralPath (Join-Path $primary 'artifacts/maintenance') -Directory).Count -eq 1) 'Threshold preview does not create cleanup evidence'

  $newer = Fixture-File 'artifacts/releases/TableMax-1.5.0-win-x64.zip' 2MB 3
  $lockDigest = [Security.Cryptography.SHA256]::Create()
  try { $lockId = [BitConverter]::ToString($lockDigest.ComputeHash([Text.Encoding]::UTF8.GetBytes($primary.ToLowerInvariant()))).Replace('-', '') }
  finally { $lockDigest.Dispose() }
  $marker = Join-Path $fixture 'lock-held'
  # The encoded command carries fixture-owned paths as PowerShell single-quoted
  # literals. No user or file content is interpolated as executable commands.
  $lockCommand = '$m = New-Object Threading.Mutex($false, ''Local\TableMax-Cleanup-' + $lockId + '''); $null = $m.WaitOne(); [IO.File]::WriteAllText(''' + $marker.Replace("'", "''") + ''', ''held''); Start-Sleep -Seconds 60'
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($lockCommand))
  $lockProcess = Start-Process -FilePath (Get-Command powershell.exe).Source -ArgumentList @('-NoProfile', '-EncodedCommand', $encoded) -WindowStyle Hidden -PassThru
  for ($attempt = 0; $attempt -lt 40 -and -not (Test-Path -LiteralPath $marker); $attempt++) { Start-Sleep -Milliseconds 100 }
  Check (Test-Path -LiteralPath $marker) 'The concurrency fixture acquires the workspace cleanup mutex'
  $refused = $false
  try { Run-Maintenance $true 0.003 0.0025 | Out-Null } catch { $refused = $_.Exception.Message -like '*Another cleanup*' }
  Check ($refused -and (Test-Path -LiteralPath $old)) 'A concurrent cleanup is refused before deleting candidates'
  $lockProcess.Kill(); $lockProcess.WaitForExit(); $lockProcess = $null
  $done = Run-Maintenance $true 0.003 0.0025
  $report = Get-Content -LiteralPath $done.reportPath -Raw | ConvertFrom-Json
  Check ($done.result -eq 'target-reached' -and -not (Test-Path -LiteralPath $old) -and (Test-Path -LiteralPath $newer)) 'Oldest candidate is removed first and cleanup stops below the low-water mark'
  Check ($report.candidates[0].path -eq $old -and $report.candidates[0].deleted -and -not $report.candidates[1].deleted) 'The audit report records ordered candidates and the unremoved remainder'
  Check ((Get-FileHash -LiteralPath $current -Algorithm SHA256).Hash.ToLowerInvariant() -eq $hash) 'The current verified archive remains byte-identical'
  $again = Run-Maintenance $true 0.003 0.0025
  Check ($again.result -eq 'below-threshold' -and (Test-Path -LiteralPath $newer)) 'High/low hysteresis avoids repeatedly clearing valid files'

  $protected = Fixture-File 'assets/original.bin' 2MB
  $build = Fixture-File 'build/desktop/main.cjs' 128
  $cache = Fixture-File '.cache/tool.bin' 128
  $dependencies = Fixture-File 'node_modules/tool.bin' 128
  $store = Fixture-File '.pnpm-store/tool.bin' 128
  $save = Fixture-File 'data/room.sqlite' 128
  $evidence = Fixture-File 'artifacts/maintenance/old-evidence/screenshot.png' 128
  $unknown = Fixture-File 'tmp/research/source.bin' 128
  $young = Fixture-File 'artifacts/releases/TableMax-1.3.0-win-x64.zip' 128 0
  $future = Fixture-File 'artifacts/releases/TableMax-2.0.0-win-x64.zip' 128
  $beforeHidden = Run-Maintenance
  $hidden = Fixture-File 'assets/hidden-capacity.bin' 384
  [IO.File]::SetAttributes($hidden, ([IO.FileAttributes]::Hidden -bor [IO.FileAttributes]::System))
  $baseline = Run-Maintenance
  Check ($baseline.bytesBefore -eq ($beforeHidden.bytesBefore + 384)) 'Capacity includes hidden and system files without relying on provider defaults'
  New-Item -ItemType Junction -Path $link -Value (Join-Path $primary 'assets') | Out-Null
  $withLink = Run-Maintenance
  Check ($withLink.bytesBefore -eq $baseline.bytesBefore -and $withLink.skippedLinks -eq 1) 'Capacity scanning skips links without double-counting their targets'
  $nested = Join-Path $primary 'nested-worktree'
  Git-At $primary @('worktree', 'add', '--quiet', '--detach', $nested)
  $nestedPayload = Fixture-File 'nested-worktree/not-counted.bin' 2MB
  $nestedResult = Run-Maintenance
  Check ($nestedResult.skippedRepositories -eq 1 -and $nestedResult.bytesBefore -lt ($withLink.bytesBefore + 1MB)) 'Nested checkouts are excluded from main-workspace capacity'

  $exhausted = Run-Maintenance $true
  Check ($exhausted.result -eq 'candidates-exhausted' -and -not (Test-Path -LiteralPath $newer)) 'Cleanup stops safely after all eligible candidates are exhausted'
  foreach ($path in @($protected, $hidden, $build, $cache, $dependencies, $store, $save, $evidence, $unknown, $young, $future, $nestedPayload)) {
    Check (Test-Path -LiteralPath $path) ('Protected content is retained: ' + $path.Substring($primary.Length + 1))
  }
  $empty = Run-Maintenance $true
  Check ($empty.result -eq 'no-candidates' -and $empty.bytesAfter -gt $empty.lowWaterBytes) 'Above threshold with no candidates is only reported'
  $refused = $false
  try { Run-Maintenance $false 1 1 | Out-Null } catch { $refused = $_.Exception.Message -like '*lower low-water*' }
  Check $refused 'Invalid high/low water marks are rejected'
  $evidenceRoot = if ($EvidenceDirectory) { [IO.Path]::GetFullPath($EvidenceDirectory) } else { Join-Path $workspaceForTest 'artifacts/maintenance/project-maintenance-tools' }
  New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
  [PSCustomObject]@{ verifiedAt = [DateTime]::UtcNow.ToString('o'); result = 'passed'; checks = $checks.ToArray(); runtime = $PSVersionTable.PSVersion.ToString() } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'tool-tests.json') -Encoding utf8
  Write-Host ('PASS: ' + $checks.Count + ' project-maintenance checks in isolated Git workspaces.')
}
finally {
  foreach ($process in @($busyProcess, $lockProcess)) { if ($process -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit() } }
  if (Test-Path -LiteralPath $link) {
    if (-not ((Get-Item -LiteralPath $link -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected test junction replacement; fixture retained.' }
    [IO.Directory]::Delete($link)
  }
  if (Test-Path -LiteralPath $fixture) {
    $resolvedFixture = (Resolve-Path -LiteralPath $fixture).Path
    if (-not $resolvedFixture.StartsWith($workspaceForTest + '\tmp\maintenance-test-', [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture cleanup path failed verification.' }
    if (Get-ChildItem -LiteralPath $resolvedFixture -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Unexpected test reparse point; fixture retained.' }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
  }
}
