param([string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$fixture = Join-Path $sourceRoot ('tmp/delivery-guard-' + [Guid]::NewGuid().ToString('N'))
$checks = New-Object 'System.Collections.Generic.List[string]'
function File([string]$Relative, [string]$Content) {
  $target = Join-Path $fixture $Relative
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
  [IO.File]::WriteAllText($target, $Content)
  return $target
}
function Json([string]$Relative, $Value) { return File $Relative ($Value | ConvertTo-Json -Depth 10) }
function Check([bool]$Value, [string]$Name) { if (-not $Value) { throw ('FAILED: ' + $Name) }; $checks.Add($Name) }
try {
  $null = Json 'package.json' @{name='tablemax';version='1.0.6'}
  New-Item -ItemType Directory -Path (Join-Path $fixture 'tools/maintenance') -Force | Out-Null
  foreach ($support in @('cleanup-local.ps1','cleanup-guard.ps1','current-delivery.ps1','WorkspaceSnapshot.cs')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $support) -Destination (Join-Path $fixture 'tools/maintenance') }
  $deliveries = @()
  foreach ($edition in @('full','box')) {
    $archivePath = File ('artifacts/package-payloads/v1.0.6/run/' + $edition + '/payload.zip') ('payload-' + $edition)
    $exePath = File ('artifacts/releases/TableMax-1.0.6-win-x64-' + $edition + '.exe') ('exe-' + $edition)
    $payloadHash = (Get-FileHash -LiteralPath $archivePath).Hash.ToLowerInvariant()
    $executable = @{path=$exePath;bytes=(Get-Item -LiteralPath $exePath).Length;sha256=(Get-FileHash -LiteralPath $exePath).Hash.ToLowerInvariant();payloadSha256=$payloadHash}
    $manifestPath = Json ('artifacts/package-payloads/v1.0.6/run/' + $edition + '/release-manifest.json') @{version='1.0.6';edition=$edition;archive=@{name='payload.zip';bytes=(Get-Item -LiteralPath $archivePath).Length;sha256=$payloadHash}}
    $null = Json ('artifacts/maintenance/v1.0.6/windows-editions/run/shipping-executable-checks-' + $edition + '.json') @{result='passed';executableSha256=$executable.sha256;payloadSha256=$payloadHash}
    $deliveries += @{edition=$edition;archivePath=$archivePath;manifestPath=$manifestPath;executable=$executable}
  }
  $null = Json 'artifacts/package-payloads/v1.0.6/current.json' @{version='1.0.6';deliveries=$deliveries}
  $old = File 'artifacts/releases/TableMax-1.0.5-win-x64.zip' 'expired-fixture'
  $cleanup = Join-Path $fixture 'tools/maintenance/cleanup-local.ps1'
  $null = . $cleanup -Kind Releases -ProjectRoot $fixture -Apply -MinimumAgeMinutes 0
  Check (-not (Test-Path -LiteralPath $old)) 'Actual Apply deletes only selected expired fixture'
  foreach ($entry in $deliveries) { Check ((Test-Path -LiteralPath $entry.archivePath) -and (Test-Path -LiteralPath $entry.executable.path)) ('Retains verified ' + $entry.edition + ' EXE and internal payload') }
  Add-Candidate (Join-Path $fixture 'artifacts/package-payloads') 'fixture'
  Check ($skipped[-1].reason -match 'protected') 'Internal payload directory cannot become cleanup candidate'
  $null = File 'artifacts/releases/TableMax-1.0.5-win-x64.zip' 'expired-fixture'
  $boxProof = 'artifacts/maintenance/v1.0.6/windows-editions/run/shipping-executable-checks-box.json'
  $null = Json $boxProof @{result='failed';executableSha256=$deliveries[1].executable.sha256;payloadSha256=$deliveries[1].executable.payloadSha256}
  $refused = $false
  try { $null = & $cleanup -Kind Releases -ProjectRoot $fixture -Apply -MinimumAgeMinutes 0 } catch { $refused = $_.Exception.Message -like '*No passing actual EXE evidence*' }
  Check ($refused -and (Test-Path -LiteralPath $old)) 'Missing actual EXE PASS rejects Apply and preserves candidate'
  $null = Json $boxProof @{result='passed';executableSha256=$deliveries[1].executable.sha256;payloadSha256=$deliveries[1].executable.payloadSha256}
  [IO.File]::WriteAllText($deliveries[1].archivePath,'tampered')
  $refused = $false
  try { $null = & $cleanup -Kind Releases -ProjectRoot $fixture -Apply -MinimumAgeMinutes 0 } catch { $refused = $_.Exception.Message -like '*hash mismatch*' }
  Check ($refused -and (Test-Path -LiteralPath $old)) 'Changed payload rejects Apply and preserves candidate'
  if ($EvidenceDirectory) {
    New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
    @{result='passed';checks=$checks.ToArray();fixtureOnly=$true} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'results.json') -Encoding utf8
  }
  Write-Host ('PASS: ' + $checks.Count + ' isolated dual-delivery cleanup checks.')
} finally {
  if (Test-Path -LiteralPath $fixture) {
    $resolved = (Resolve-Path -LiteralPath $fixture).Path
    if (-not $resolved.StartsWith($sourceRoot + '\tmp\delivery-guard-', [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture cleanup path escaped workspace.' }
    if (Get-ChildItem -LiteralPath $fixture -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Unexpected fixture link; preserve fixture.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
