[CmdletBinding()]
param([switch]$Preview, [switch]$Apply, [string]$PreviewSha256)
$ErrorActionPreference = 'Stop'
if ($Preview -and $Apply) { throw 'Preview and Apply are mutually exclusive.' }
$taskId = 'pokemon-small-seats-20261024-01'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..')).TrimEnd('\')
$taskRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot ('tmp/' + $taskId)))
$manifestPath = Join-Path $PSScriptRoot 'cleanup-manifest.json'
$confirmationPath = Join-Path $PSScriptRoot 'cleanup-confirmation.json'
$digest = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($PreviewSha256 -and $PreviewSha256 -ne $digest) { throw 'The preview manifest has changed.' }
$plan = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
if ($plan.id -ne $taskId -or $plan.taskRoot -ne ('tmp/' + $taskId) -or $plan.entries.Count -ne 1 -or $plan.entries[0].name -ne $taskId) { throw 'The manifest does not select this exact task.' }
foreach ($control in $plan.controlFiles) {
  if ($control.name -notin @('cleanup.ps1','cleanup.cmd')) { throw 'Unexpected cleanup control.' }
  if ((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $control.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $control.sha256) { throw 'Cleanup controls changed.' }
}
$expected = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($file in $plan.entries[0].files) {
  if (-not $file.path.StartsWith(('tmp/' + $taskId + '/'), [StringComparison]::Ordinal) -or $file.path -match '[\\:*?]' -or @($file.path.Split('/') | Where-Object { $_ -in @('', '.', '..', '.git') }).Count) { throw 'Foreign temporary path.' }
  $absolute = [IO.Path]::GetFullPath((Join-Path $repoRoot $file.path))
  if (-not $absolute.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or $expected.ContainsKey($absolute)) { throw 'Invalid or duplicate task path.' }
  $expected.Add($absolute, $file)
}
$pending = New-Object 'System.Collections.Generic.Stack[string]'
$pending.Push($taskRoot)
$recent = $false
$cutoff = [DateTime]::UtcNow.AddMinutes(-30)
while ($pending.Count) {
  $directory = $pending.Pop()
  $directoryInfo = Get-Item -LiteralPath $directory -Force
  if (($directoryInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Test-Path -LiteralPath (Join-Path $directory '.git'))) { throw 'Linked path or nested repository is protected.' }
  foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked task member is protected.' }
    if ($item.PSIsContainer) { $pending.Push($item.FullName); continue }
    if (-not $expected.ContainsKey($item.FullName)) { throw ('Unlisted task file: ' + $item.FullName) }
    $file = $expected[$item.FullName]
    if ($item.Length -ne [long]$file.bytes -or $item.LastWriteTimeUtc.Ticks -ne [long]$file.lastWriteTimeUtcTicks -or (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw ('Changed task file: ' + $file.path) }
    if ($item.LastWriteTimeUtc -gt $cutoff) { $recent = $true }
    $expected.Remove($item.FullName) | Out-Null
  }
}
if ($expected.Count) { throw 'Task inventory has missing members.' }
Write-Host ('Scope: ' + $taskRoot)
Write-Host ('Files: ' + $plan.entries[0].files.Count + '; bytes: ' + $plan.logicalBytes)
Write-Host ('Preview SHA-256: ' + $digest)
Write-Host 'This includes the review HTML and temporary screenshots. Source, original assets, saves, current EXE and formal reports are outside this selection.'
if ($Apply) {
  if (-not $PreviewSha256 -or -not (Test-Path -LiteralPath $confirmationPath)) { throw 'A matching interactive preview confirmation is required.' }
  $confirmation = Get-Content -LiteralPath $confirmationPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($confirmation.manifestSha256 -ne $digest -or $confirmation.phrase -ne ('DELETE ' + $taskId) -or [DateTime]::Parse($confirmation.atUtc).ToUniversalTime() -lt [DateTime]::UtcNow.AddMinutes(-15)) { throw 'Confirmation is stale or mismatched.' }
  if ($recent) { throw 'Recent task files remain protected for 30 minutes.' }
  & (Join-Path $repoRoot 'scripts/Clean-Intermediates.ps1') -ProjectRoot $repoRoot -TemporaryManifest $manifestPath -Apply
  return
}
# The existing guarded cleanup path performs a dry run and verifies the old
# accepted payload. It neither installs nor runs that EXE.
& (Join-Path $repoRoot 'scripts/Clean-Intermediates.ps1') -ProjectRoot $repoRoot -TemporaryManifest $manifestPath
if ($Preview) { return }
if ($recent) { Write-Host 'Recent files are protected. Review later after 30 minutes and after task processes have exited.'; return }
$phrase = Read-Host ('Type exactly DELETE ' + $taskId + ' to apply once, or Enter to cancel')
if ($phrase -ne ('DELETE ' + $taskId)) { Write-Host 'Cancelled; nothing was deleted.'; return }
@{manifestSha256=$digest;phrase=$phrase;atUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $confirmationPath -Encoding utf8
& $PSCommandPath -Apply -PreviewSha256 $digest
