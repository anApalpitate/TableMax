param([string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
$projectForTest = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$fixture = Join-Path $projectForTest ('tmp/retirement-test-' + [Guid]::NewGuid().ToString('N'))
$checks = New-Object 'System.Collections.Generic.List[string]'
function File([string]$Path, [string]$Text) {
  $target = Join-Path $fixture $Path
  New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($target, $Text)
  (Get-Item -LiteralPath $target).LastWriteTimeUtc = [DateTime]::UtcNow.AddHours(-2)
}
function Check([bool]$Value, [string]$Message) { if (-not $Value) { throw $Message }; $checks.Add($Message) }
function Reject([scriptblock]$Action, [string]$Message) { $rejected = $false; try { & $Action | Out-Null } catch { $rejected = $true }; Check $rejected $Message }
function Inventory([string]$Path) {
  $target = Join-Path $fixture $Path
  @(Get-ChildItem -LiteralPath $target -File -Recurse -Force | ForEach-Object {
    @{path=$_.FullName.Substring($fixture.Length+1).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}
  })
}
function Plan {
  File 'artifacts/maintenance/plan.json' (@{version=1;currentArchiveSha256=$archiveHash;entries=@($entry)} | ConvertTo-Json -Depth 8)
}
function Run([switch]$Apply) {
  & (Join-Path $fixture 'scripts/cleanup-local.ps1') -Kind Intermediates -RetiredGeneratedManifest 'artifacts/maintenance/plan.json' -Apply:$Apply
}
try {
  File 'package.json' '{"name":"tablemax","version":"1.0.2"}'
  File 'artifacts/releases/TableMax-1.0.2-win-x64.zip' 'current'
  $archiveHash = (Get-FileHash -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.0.2-win-x64.zip')).Hash.ToLowerInvariant()
  File 'artifacts/maintenance/proof/results.json' (@{portable=$true;result='passed';archiveSha256=$archiveHash} | ConvertTo-Json)
  File 'artifacts/maintenance/v1.0.1/test/results.json' '{"result":"failed","reason":"historical failure preserved"}'
  File 'artifacts/maintenance/v1.0.1/test/extracted/TableMax.exe' 'exe'
  File 'artifacts/maintenance/v1.0.1/test/extracted/node.exe' 'node'
  File 'artifacts/maintenance/v1.0.1/test/unique.png' 'unique'
  New-Item -ItemType Directory -Path (Join-Path $fixture 'scripts') -Force | Out-Null
  foreach ($script in @('cleanup-local.ps1','retired-generated.ps1')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $fixture ('scripts/'+$script)) }
  $entry = @{path='artifacts/maintenance/v1.0.1/test/extracted';kind='runtime-copy';reason='Retired isolated extraction';files=@(Inventory 'artifacts/maintenance/v1.0.1/test/extracted');evidence=@(@{path='artifacts/maintenance/v1.0.1/test/results.json';sha256=(Get-FileHash -LiteralPath (Join-Path $fixture 'artifacts/maintenance/v1.0.1/test/results.json')).Hash.ToLowerInvariant()})}
  Plan
  Get-ChildItem -LiteralPath $fixture -Directory -Recurse -Force | ForEach-Object { $_.LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2) }
  Run | Out-Null
  Check (Test-Path -LiteralPath (Join-Path $fixture $entry.path)) 'Preview preserves the exact extraction'
  Reject { & (Join-Path $fixture 'scripts/cleanup-local.ps1') -Kind Maintenance -RetiredGeneratedManifest 'artifacts/maintenance/plan.json' } 'Automatic cleanup cannot retire evidence'
  $saved=$entry.path; $entry.path='artifacts/maintenance/v1.0.1/test/../test/extracted'; Plan; Reject { Run } 'Traversal rejected'; $entry.path=$saved
  $savedHash=$entry.files[0].sha256; $entry.files[0].sha256='0'*64; Plan; Reject { Run -Apply } 'Changed source hash blocks deletion'; $entry.files[0].sha256=$savedHash
  File 'artifacts/maintenance/v1.0.1/test/extracted/room.sqlite' 'saved'; $entry.files=@(Inventory $entry.path); Plan; Reject { Run } 'Runtime copy containing platform saves rejected'
  Remove-Item -LiteralPath (Join-Path $fixture 'artifacts/maintenance/v1.0.1/test/extracted/room.sqlite'); $entry.files=@(Inventory $entry.path)
  $entry.kind='browser-profile'; Plan; Reject { Run } 'Arbitrary evidence directory cannot be treated as a browser profile'; $entry.kind='runtime-copy'
  $entry.evidence[0].sha256='0'*64; Plan; Reject { Run } 'Changed retained evidence blocks deletion'
  $entry.evidence[0].sha256=(Get-FileHash -LiteralPath (Join-Path $fixture $entry.evidence[0].path)).Hash.ToLowerInvariant()
  $retainedEvidence=$entry.evidence
  $entry.evidence=@(@{path=$entry.files[0].path;sha256=$entry.files[0].sha256}); Plan; Reject { Run } 'Evidence inside deletion selection rejected'; $entry.evidence=$retainedEvidence
  $entry.kind='unrecognized'; Plan; Reject { Run } 'Unrecognized retirement category rejected'; $entry.kind='runtime-copy'
  Plan
  Get-ChildItem -LiteralPath (Join-Path $fixture $entry.path) -Force | ForEach-Object { $_.LastWriteTimeUtc=[DateTime]::UtcNow }
  Run -Apply | Out-Null
  Check (Test-Path -LiteralPath (Join-Path $fixture $entry.path)) 'Recent generated content remains protected'
  Get-ChildItem -LiteralPath (Join-Path $fixture $entry.path) -Force | ForEach-Object { $_.LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2) }
  (Get-Item -LiteralPath (Join-Path $fixture $entry.path)).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)
  Run -Apply | Out-Null
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture $entry.path))) 'Apply retires only the selected extraction'
  foreach ($path in @('artifacts/maintenance/v1.0.1/test/results.json','artifacts/maintenance/v1.0.1/test/unique.png','artifacts/releases/TableMax-1.0.2-win-x64.zip')) { Check (Test-Path -LiteralPath (Join-Path $fixture $path)) ('Preserved '+$path) }
  $report=Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Filter 'cleanup.json' -Recurse | Sort-Object FullName | Select-Object -Last 1
  $data=Get-Content -LiteralPath $report.FullName -Raw | ConvertFrom-Json
  Check ($data.result -eq 'passed' -and $data.candidates[0].retiredGenerated.files.Count -eq 2) 'Report preserves per-file hashes and retained failure evidence'
  File 'artifacts/maintenance/v1.0.1/test/desktop/webview2/EBWebView/Local State' 'generated Chromium metadata'
  $entry.path='artifacts/maintenance/v1.0.1/test/desktop'; $entry.kind='browser-profile'; $entry.files=@(Inventory $entry.path); Plan
  File 'artifacts/maintenance/v1.0.1/test/desktop/room.sqlite' 'platform save'; $entry.files=@(Inventory $entry.path); Plan; Reject { Run } 'Browser profile cannot swallow platform saves'
  Remove-Item -LiteralPath (Join-Path $fixture 'artifacts/maintenance/v1.0.1/test/desktop/room.sqlite'); $entry.files=@(Inventory $entry.path); Plan
  Get-ChildItem -LiteralPath (Join-Path $fixture $entry.path) -Force -Recurse | ForEach-Object { $_.LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2) }
  (Get-Item -LiteralPath (Join-Path $fixture $entry.path)).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)
  Run -Apply | Out-Null
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture $entry.path))) 'Chromium profile with retained evidence can be retired'
  File '.cache/electron/archive.zip' 'obsolete tool cache'
  $entry.path='.cache/electron'; $entry.kind='obsolete-tool-cache'; $entry.files=@(Inventory $entry.path); Plan
  File 'package.json' '{"name":"tablemax","version":"1.0.2","devDependencies":{"electron":"1.0.0"}}'
  Reject { Run } 'Active Electron dependency protects the cache'
  File 'package.json' '{"name":"tablemax","version":"1.0.2"}'
  (Get-Item -LiteralPath (Join-Path $fixture $entry.path)).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)
  Run -Apply | Out-Null
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture $entry.path))) 'Unused exact Electron cache can be retired'
  if (-not $EvidenceDirectory) { $EvidenceDirectory=Join-Path $projectForTest 'artifacts/maintenance/retirement-tools' }
  New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
  @{result='passed';checks=$checks.ToArray();count=$checks.Count} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'results.json') -Encoding utf8
  Write-Host ($checks.Count.ToString()+' retirement checks passed.')
}
finally {
  if (Test-Path -LiteralPath $fixture) {
    if (-not [IO.Path]::GetFullPath($fixture).StartsWith($projectForTest+'\tmp\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture escapes workspace tmp.' }
    Remove-Item -LiteralPath $fixture -Recurse -Force
  }
}
