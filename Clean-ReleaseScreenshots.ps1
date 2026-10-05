[CmdletBinding()]
param([switch]$Apply, [ValidateRange(0,10080)][int]$MinimumAgeMinutes = 30)
$ErrorActionPreference = 'Stop'
$workspace = $PSScriptRoot
$sourceWorkspace = $workspace
. (Join-Path $workspace 'scripts/cleanup-guard.ps1')
if (-not ('TableMax.WorkspaceSnapshotV2' -as [type])) { Add-Type -Path (Join-Path $workspace 'scripts/WorkspaceSnapshot.cs') }
$root = [IO.Path]::GetFullPath((Join-Path $workspace 'artifacts/releases')).TrimEnd('\')
$ancestor = $root
while ($ancestor) {
  if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Screenshot cleanup refuses linked paths.' }
  $ancestor = [IO.Path]::GetDirectoryName($ancestor)
}
$cutoff = [DateTime]::UtcNow.AddMinutes(-$MinimumAgeMinutes)
$items = @()
foreach ($entry in Get-ChildItem -LiteralPath $root -Force) {
  $selected = if ($entry.PSIsContainer) { $entry.Name -match '^(screenshots|captures|diagnostics|verify)-[a-zA-Z0-9_.-]+$' } else { $entry.Name -match '^(screenshot|capture|verify)[a-zA-Z0-9_.-]*\.(png|jpe?g|webp)$' }
  if (-not $selected) { continue }
  $path = [IO.Path]::GetFullPath($entry.FullName)
  if (-not $path.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Screenshot target escaped releases.' }
  $snapshot = [TableMax.WorkspaceSnapshotV2]::Read($path)
  if ($entry.PSIsContainer -and @([IO.Directory]::EnumerateFiles($path,'*',[IO.SearchOption]::AllDirectories) | Where-Object { $_ -notmatch '\.(png|jpe?g|webp)$' }).Count) { continue }
  if ($snapshot.Newest -gt $cutoff) { continue }
  $items += [PSCustomObject]@{path=$path;bytes=$snapshot.Bytes;fingerprint=$snapshot.Fingerprint;deleted=$false}
}
Write-Host ('Release process screenshot candidates: ' + $items.Count)
if ($Apply) {
  Assert-Idle
  $digest = [Security.Cryptography.SHA256]::Create()
  try { $lockId = [BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($workspace.ToLowerInvariant()))).Replace('-','') } finally { $digest.Dispose() }
  $mutex = New-Object Threading.Mutex($false, ('Local\TableMax-Cleanup-'+$lockId))
  $held = $false
  try {
    try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { throw 'Another workspace cleanup is active.' }
    foreach ($item in $items) {
      Assert-Idle
      if ([TableMax.WorkspaceSnapshotV2]::Read($item.path).Fingerprint -ne $item.fingerprint) { throw 'Screenshot changed; stopped.' }
      Remove-Item -LiteralPath $item.path -Recurse -Force
      $item.deleted = $true
    }
  } finally {
    if ($held) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
  }
}
$version = (Get-Content (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json).version
$evidence = Join-Path $workspace ('artifacts/maintenance/v'+$version+'/release-screenshots-cleanup')
New-Item -ItemType Directory -Force $evidence | Out-Null
@{mode=if($Apply){'apply'}else{'preview'};items=$items;scope='Only explicitly named process screenshots directly under releases; no runtime archives, source, assets, saves or maintenance evidence.'} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $evidence (([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff'))+'.json')) -Encoding utf8
