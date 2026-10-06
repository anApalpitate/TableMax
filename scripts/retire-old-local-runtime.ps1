[CmdletBinding()]
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$taskVersion = (Get-Content (Join-Path $taskWorkspace 'package.json') -Raw | ConvertFrom-Json).version
$taskProof = Get-Content (Join-Path $taskWorkspace "artifacts/maintenance/v$taskVersion/portable-storage/results.json") -Raw | ConvertFrom-Json
$taskManifest = Get-Content (Join-Path $taskWorkspace "artifacts/releases/TableMax-$taskVersion-win-x64-manifest.json") -Raw | ConvertFrom-Json
if ($taskProof.result -ne 'passed' -or $taskProof.archiveSha256 -ne $taskManifest.archive.sha256 -or -not $taskProof.legacy.originalUnchanged) { throw 'Verified current EXE and unchanged original save are required.' }
$taskData = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'TableMax')).TrimEnd('\')
$taskTarget = [IO.Path]::GetFullPath((Join-Path $taskData 'app')).TrimEnd('\')
if ([IO.Path]::GetDirectoryName($taskTarget) -ne $taskData -or [IO.Path]::GetFileName($taskTarget) -ne 'app') { throw 'Unexpected old runtime target.' }
if (-not (Test-Path -LiteralPath $taskTarget)) { Write-Host 'No old runtime directory.'; return }
$taskCursor = $taskTarget
while ($taskCursor) { if ((Test-Path -LiteralPath $taskCursor) -and ((Get-Item -LiteralPath $taskCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked runtime path retained.' }; $taskCursor = [IO.Path]::GetDirectoryName($taskCursor) }
$taskMarkerPath = Join-Path $taskTarget '.tablemax-release.json'
$taskOld = Get-Content -LiteralPath $taskMarkerPath -Raw | ConvertFrom-Json
if ([version]$taskOld.version -ge [version]$taskVersion -or -not $taskOld.files.Count) { throw 'Only an owned older runtime can be retired.' }
function Assert-OldRuntimeIdle {
  $taskBusy = @(Get-CimInstance Win32_Process | Where-Object { ([string]$_.ExecutablePath).StartsWith($taskTarget + '\', [StringComparison]::OrdinalIgnoreCase) -or ([string]$_.CommandLine).IndexOf($taskTarget, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
  if ($taskBusy.Count) { throw 'Old runtime still in use; preserved.' }
}
Assert-OldRuntimeIdle
$taskItems = @(Get-ChildItem -LiteralPath $taskTarget -Recurse -Force)
if ($taskItems | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Linked runtime content retained.' }
$taskAllowed = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
[void]$taskAllowed.Add($taskMarkerPath)
$taskRecords = @()
foreach ($taskFile in $taskOld.files) {
  $taskFilePath = [IO.Path]::GetFullPath((Join-Path $taskTarget $taskFile.path))
  if (-not $taskFilePath.StartsWith($taskTarget + '\', [StringComparison]::OrdinalIgnoreCase) -or -not $taskAllowed.Add($taskFilePath)) { throw 'Invalid owned runtime file path.' }
  $taskActual = Get-Item -LiteralPath $taskFilePath
  $taskHash = (Get-FileHash -LiteralPath $taskFilePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($taskActual.Length -ne $taskFile.bytes -or $taskHash -ne $taskFile.sha256) { throw 'Changed old runtime file retained.' }
  $taskRecords += [pscustomobject]@{path=$taskFile.path;bytes=$taskActual.Length;sha256=$taskHash}
}
if (@($taskItems | Where-Object { -not $_.PSIsContainer -and -not $taskAllowed.Contains($_.FullName) }).Count) { throw 'Unknown runtime files retained.' }
$taskOriginal = Join-Path $taskData 'room.sqlite'
if ((Get-FileHash -LiteralPath $taskOriginal -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskProof.legacy.originalSha256) { throw 'Original save changed since verification; preserved all files.' }
$taskEvidence = Join-Path $taskWorkspace "artifacts/maintenance/v$taskVersion/portable-storage"
Copy-Item -LiteralPath $taskMarkerPath -Destination (Join-Path $taskEvidence 'old-installed-runtime-manifest.json')
$taskBytes = ($taskRecords | Measure-Object bytes -Sum).Sum + (Get-Item -LiteralPath $taskMarkerPath).Length
$taskRecord = [pscustomobject]@{result='preview';target=$taskTarget;version=$taskOld.version;bytes=$taskBytes;files=$taskRecords;originalSaveSha256=$taskProof.legacy.originalSha256;originalSaveRetained=$true}
$taskReport = Join-Path $taskEvidence 'old-installed-runtime-retirement.json'
$taskRecord | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $taskReport -Encoding utf8
if ($Apply) {
  Assert-OldRuntimeIdle
  # The full tree is an exact hash-verified owned payload; the parent data directory is excluded.
  if ((Get-Item -LiteralPath $taskTarget).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Runtime path changed; retained.' }
  Remove-Item -LiteralPath $taskTarget -Recurse -Force
  if ((Get-FileHash -LiteralPath $taskOriginal -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskProof.legacy.originalSha256) { throw 'Original save verification failed.' }
  $taskRecord.result = 'deleted'
  $taskRecord | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $taskReport -Encoding utf8
}
Write-Host ($taskRecord.result + ': owned old runtime ' + $taskBytes + ' bytes; original save retained. Report: ' + $taskReport)
