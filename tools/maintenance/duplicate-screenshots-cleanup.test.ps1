param([string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$fixture = Join-Path $projectRoot ('tmp/screenshot-cleanup-test-' + [Guid]::NewGuid().ToString('N'))
$checks = New-Object 'System.Collections.Generic.List[string]'
function File([string]$Path, [string]$Text) {
  $full = Join-Path $fixture $Path
  New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($full, $Text)
  (Get-Item -LiteralPath $full).LastWriteTimeUtc = [DateTime]::UtcNow.AddHours(-2)
}
function Check([bool]$Value, [string]$Message) { if (-not $Value) { throw $Message }; $checks.Add($Message) }
function Run([switch]$Apply, [int]$Age = 30, [string]$Kind = 'Intermediates') {
  & (Join-Path $fixture 'tools/maintenance/cleanup-local.ps1') -Kind $Kind -DuplicateScreenshotsManifest 'artifacts/maintenance/plan.json' -Apply:$Apply -MinimumAgeMinutes $Age
}
function Plan($Groups) { File 'artifacts/maintenance/plan.json' (@{version=1;groups=@($Groups)} | ConvertTo-Json -Depth 8) }
function Reject([scriptblock]$Action, [string]$Message) { $failed=$false; try { & $Action | Out-Null } catch { $failed=$true }; Check $failed $Message }
$started=[Diagnostics.Stopwatch]::StartNew()
try {
  File 'package.json' '{"name":"tablemax","version":"1.0.2"}'
  File 'artifacts/releases/TableMax-1.0.2-win-x64.zip' 'current-runtime'
  $archiveHash=(Get-FileHash (Join-Path $fixture 'artifacts/releases/TableMax-1.0.2-win-x64.zip')).Hash.ToLowerInvariant()
  File 'artifacts/maintenance/proof/results.json' (@{portable=$true;result='passed';archiveSha256=$archiveHash} | ConvertTo-Json)
  New-Item -ItemType Directory -Path (Join-Path $fixture 'tools/maintenance') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'cleanup-local.ps1') -Destination (Join-Path $fixture 'tools/maintenance/cleanup-local.ps1')
  foreach ($support in @('cleanup-guard.ps1','WorkspaceSnapshot.cs')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $support) -Destination (Join-Path $fixture 'tools/maintenance') }
  File 'artifacts/maintenance/v1.0.1/old/copy.png' 'identical-image'
  File 'artifacts/maintenance/v1.0.2/final/keep.png' 'identical-image'
  File 'artifacts/maintenance/v1.0.1/old/unique.png' 'unique-frame'
  File 'artifacts/maintenance/v1.0.1/old/results.json' 'historical-result'
  $sha=(Get-FileHash (Join-Path $fixture 'artifacts/maintenance/v1.0.1/old/copy.png')).Hash.ToLowerInvariant()
  $item=@{path='artifacts/maintenance/v1.0.1/old/copy.png';retainedPath='artifacts/maintenance/v1.0.2/final/keep.png';bytes=15;sha256=$sha}
  $group=@{path='artifacts/maintenance/v1.0.1/old';files=@($item)}
  Plan @($group)
  Get-ChildItem -LiteralPath $fixture -Directory -Recurse -Force | ForEach-Object { $_.LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2) }
  $beforeLogs=@(Get-ChildItem (Join-Path $fixture 'artifacts/maintenance') -Directory -Filter 'local-cleanup-*').Count
  Run | Out-Null
  Check (Test-Path (Join-Path $fixture $item.path)) 'Preview retains duplicate'
  Check (@(Get-ChildItem (Join-Path $fixture 'artifacts/maintenance') -Directory -Filter 'local-cleanup-*').Count -eq $beforeLogs) 'Preview creates no cleanup log'
  Reject { Run -Kind Maintenance } 'Automatic mode rejects screenshot manifest'
  Plan @(); Reject { Run } 'Empty manifest rejected'
  Plan @($group,$group); Reject { Run } 'Duplicate groups rejected'
  $savedPath=$item.retainedPath; $item.retainedPath=$item.path; Plan @($group); Reject { Run } 'Retained PNG in deletion set rejected'; $item.retainedPath=$savedPath
  $savedSha=$item.sha256; $item.sha256='0'*64; Plan @($group); Reject { Run -Apply } 'Content mismatch prevents deletion'; $item.sha256=$savedSha
  $savedBytes=$item.bytes; $item.bytes=999; Plan @($group); Reject { Run } 'Size mismatch rejected'; $item.bytes=$savedBytes
  $savedGroup=$group.path; $group.path='artifacts/maintenance/v1.0.2/final'; Plan @($group); Reject { Run } 'Current version group rejected'; $group.path=$savedGroup
  $group.path='artifacts/maintenance/v1.0.1/../v1.0.2/final'; Plan @($group); Reject { Run } 'Traversal group rejected'; $group.path=$savedGroup
  $savedFile=$item.path; $item.path='artifacts/maintenance/v1.0.1/old/results.json'; Plan @($group); Reject { Run } 'Non PNG rejected'; $item.path=$savedFile
  Plan @($group)
  (Get-Item (Join-Path $fixture $item.path)).LastWriteTimeUtc=[DateTime]::UtcNow
  $nestedMarker=Join-Path $fixture 'artifacts/maintenance/v1.0.1/.git'
  New-Item -ItemType Directory -Path $nestedMarker | Out-Null
  Reject { Run } 'Ancestor nested Git repository rejected'
  Remove-Item -LiteralPath $nestedMarker -Force
  Run -Apply | Out-Null
  Check (Test-Path (Join-Path $fixture $item.path)) 'Recent PNG is preserved by default'
  (Get-Item (Join-Path $fixture $item.path)).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)
  Run -Apply | Out-Null
  Check (-not (Test-Path (Join-Path $fixture $item.path))) 'Apply deletes exact duplicate only'
  foreach($path in @($savedPath,'artifacts/maintenance/v1.0.1/old/unique.png','artifacts/maintenance/v1.0.1/old/results.json','artifacts/releases/TableMax-1.0.2-win-x64.zip')) { Check (Test-Path (Join-Path $fixture $path)) ('Preserved '+$path) }
  $latest=Get-ChildItem (Join-Path $fixture 'artifacts/maintenance') -Directory -Filter 'local-cleanup-*' | Sort-Object Name | Select-Object -Last 1
  $record=Get-Content (Join-Path $latest.FullName 'cleanup.json') -Raw | ConvertFrom-Json
  Check ($record.result -eq 'passed' -and $record.deletedBytes -eq 15 -and $record.candidates[0].duplicateScreenshots[0].sha256 -eq $sha -and $record.candidates[0].deletionScope -like '*parent directory retained*') 'Report records selected-file scope, deleted bytes, original SHA and retained path'
  File 'package.json' '{"name":"tablemax","version":"1.0.3"}'
  File 'artifacts/releases/TableMax-1.0.3-win-x64.zip' 'current-runtime'
  File 'artifacts/maintenance/v1.0.2/old/copy.png' 'identical-image'
  $item.path='artifacts/maintenance/v1.0.2/old/copy.png'; $group.path='artifacts/maintenance/v1.0.2/old'; Plan @($group)
  Get-ChildItem -LiteralPath $fixture -Directory -Recurse -Force | ForEach-Object { $_.LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2) }
  Run | Out-Null
  Check (Test-Path (Join-Path $fixture $item.path)) 'Preview supports v1.0.2 history after v1.0.3 delivery'
  $group.path='artifacts/maintenance/v1.0.3/final'; Plan @($group); Reject { Run } 'Current v1.0.3 group rejected'
  $group.path='artifacts/maintenance/v1.6.0/final'; Plan @($group); Reject { Run } 'Higher version group rejected'
  $group.path='artifacts/maintenance/v1.0.2/old'; Plan @($group)
  Run -Apply | Out-Null
  Check (-not (Test-Path (Join-Path $fixture $item.path)) -and (Test-Path (Join-Path $fixture $item.retainedPath))) 'Historical v1.0.2 duplicate retired while retained PNG survives'
  if (-not $EvidenceDirectory) { $EvidenceDirectory=Join-Path $projectRoot 'artifacts/maintenance/screenshot-cleanup-tools' }
  New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
  @{result='passed';checks=$checks.ToArray();count=$checks.Count;seconds=$started.Elapsed.TotalSeconds} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $EvidenceDirectory 'results.json') -Encoding utf8
  Write-Host ($checks.Count.ToString()+' screenshot cleanup checks passed.')
}
finally {
  if (Test-Path -LiteralPath $fixture) {
    $absolute=[IO.Path]::GetFullPath($fixture)
    if (-not $absolute.StartsWith((Join-Path $projectRoot 'tmp')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture is outside project tmp.' }
    Remove-Item -LiteralPath $absolute -Recurse -Force
  }
}
