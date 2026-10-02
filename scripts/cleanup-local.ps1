[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('Releases', 'Intermediates')][string]$Kind,
  [switch]$Apply,
  [switch]$IncludeBuild,
  [ValidateRange(0, 10080)][int]$MinimumAgeMinutes = 30
)

$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$project = Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw -Encoding utf8 | ConvertFrom-Json
if ($project.name -ne 'tablemax' -or $project.version -notmatch '^\d+\.\d+\.\d+$') {
  throw 'This tool only operates inside the TableMax source workspace.'
}
$currentVersion = [version]$project.version
$releases = Join-Path $workspace 'artifacts/releases'
$temporary = Join-Path $workspace 'tmp'
$archive = Join-Path $releases ('TableMax-' + $project.version + '-win-x64.zip')
$cutoff = [DateTime]::UtcNow.AddMinutes(-$MinimumAgeMinutes)
$candidates = New-Object 'System.Collections.Generic.List[object]'
$skipped = New-Object 'System.Collections.Generic.List[object]'

function Assert-LocalPath([string]$Path) {
  $absolute = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  if (-not $absolute.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Cleanup target is outside the workspace.'
  }
  $cursor = $absolute
  while ($cursor -ne $workspace) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw ('Cleanup refuses reparse points: ' + $cursor)
      }
    }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  if ((Get-Item -LiteralPath $workspace -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'Cleanup refuses a redirected workspace.'
  }
  return $absolute
}

function Read-Tree([string]$Path) {
  $absolute = Assert-LocalPath $Path
  $items = New-Object 'System.Collections.Generic.List[object]'
  $pending = New-Object 'System.Collections.Generic.Stack[string]'
  $pending.Push($absolute)
  while ($pending.Count -gt 0) {
    $item = Get-Item -LiteralPath $pending.Pop() -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw ('Cleanup refuses reparse points: ' + $item.FullName)
    }
    $items.Add($item)
    if ($item.PSIsContainer) {
      foreach ($child in Get-ChildItem -LiteralPath $item.FullName -Force) {
        if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) {
          throw ('Cleanup refuses reparse points: ' + $child.FullName)
        }
        if ($child.PSIsContainer) { $pending.Push($child.FullName) }
        else { $items.Add($child) }
      }
    }
  }
  return $items.ToArray()
}

function Read-Snapshot([string]$Path) {
  $items = @(Read-Tree $Path)
  $bytes = ($items | Where-Object { -not $_.PSIsContainer } | Measure-Object -Property Length -Sum).Sum
  $newest = ($items | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
  return [PSCustomObject]@{ bytes = [long]$bytes; entries = $items.Count; newest = $newest }
}

function Add-Candidate([string]$Path, [string]$Reason) {
  $absolute = Assert-LocalPath $Path
  try { $snapshot = Read-Snapshot $absolute }
  catch {
    $skipped.Add([PSCustomObject]@{ path = $absolute; reason = $_.Exception.Message })
    return
  }
  if ($snapshot.newest -gt $cutoff) {
    $skipped.Add([PSCustomObject]@{ path = $absolute; reason = 'Recently modified; protected by the minimum age.' })
    return
  }
  $candidates.Add([PSCustomObject]@{
    path = $absolute; reason = $Reason; bytes = $snapshot.bytes
    entries = $snapshot.entries; newest = $snapshot.newest; deleted = $false
  })
}

function Assert-Idle {
  # Relative node commands do not expose cwd; treat matching tools as busy too.
  $busy = @(Get-CimInstance -ClassName Win32_Process | Where-Object {
    $_.Name -match '^(node|electron|TableMax|7za|7z)\.exe$' -and (
      -not $_.CommandLine -or $_.Name -eq 'TableMax.exe' -or
      ([string]$_.ExecutablePath).IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      ([string]$_.CommandLine).IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      $_.CommandLine -match '(scripts[\\/](verify|dev|build|package|launch)|electron-builder|vitest|\b(pnpm|npm)\b.*\b(build|dev|test|check|package:win|verify:\w+)\b)'
    )
  })
  if ($busy.Count -gt 0) {
    throw ('Close TableMax and finish development/verification before cleanup. Busy PIDs: ' + (($busy | ForEach-Object { $_.ProcessId }) -join ', '))
  }
}

# Preserve the current archive only after a real portable PASS proves its hash.
Assert-LocalPath $archive | Out-Null
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw 'Current release ZIP is missing; cleanup stopped.' }
$archiveBefore = Get-Item -LiteralPath $archive
$archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
$proof = $null
$maintenance = Join-Path $workspace 'artifacts/maintenance'
if (Test-Path -LiteralPath $maintenance -PathType Container) {
  foreach ($file in @(Read-Tree $maintenance | Where-Object { -not $_.PSIsContainer -and $_.Name -eq 'results.json' })) {
    try { $record = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8 | ConvertFrom-Json }
    catch { continue }
    if ($record.portable -eq $true -and $record.result -eq 'passed' -and $record.archiveSha256 -eq $archiveHash) {
      $proof = $file.FullName
      break
    }
  }
}
if (-not $proof) { throw 'No passing portable evidence matches the current ZIP; cleanup stopped.' }

if ($Kind -eq 'Releases') {
  foreach ($entry in Get-ChildItem -LiteralPath $releases -Force) {
    if ($entry.Name -match '^TableMax-(\d+\.\d+\.\d+)-win-x64(?:\.zip)?$') {
      if ([version]$Matches[1] -lt $currentVersion) { Add-Candidate $entry.FullName 'Historical release archive or extraction' }
    }
    elseif ($entry.PSIsContainer -and $entry.Name -match '^package-(\d+\.\d+\.\d+)-[A-Za-z0-9]{6}$') {
      if ([version]$Matches[1] -lt $currentVersion) { Add-Candidate $entry.FullName 'Historical packaging stage' }
    }
  }
}
else {
  foreach ($entry in Get-ChildItem -LiteralPath $releases -Force) {
    if (($entry.PSIsContainer -and $entry.Name -match '^package-(\d+\.\d+\.\d+)-[A-Za-z0-9]{6}$' -and [version]$Matches[1] -le $currentVersion) -or $entry.Name -eq 'builder-debug.yml') {
      Add-Candidate $entry.FullName 'Regenerable packaging stage or builder diagnostic'
    }
  }
  if (Test-Path -LiteralPath $temporary -PathType Container) {
    foreach ($entry in Get-ChildItem -LiteralPath $temporary -Force) {
      if ($entry.PSIsContainer -and $entry.Name -match '^(card-layout|desktop-verify|display(-portable)?|game-prototype-verify|game-ui|party(-portable|-startup)?|play-presentation(-portable)?|pokemon-desktop|pokemon-verify|portable-extracted|portable-game|prototype-verify|room-levels(-portable)?|six-result-layout)-[A-Za-z0-9]{6}$') {
        Add-Candidate $entry.FullName 'Known isolated verification data or portable extraction'
      }
      elseif (-not $entry.PSIsContainer -and $entry.Name -match '^(check-(display|party|phone-table|presentation|release-cleanup)-docs\.mjs|cleanup-display-staging\.ps1|display-(dialog|dpi)-probe\.mjs|finalize-presentation-evidence\.mjs|inspect-six-result\.mjs|update-presentation-docs\.mjs)$') {
        Add-Candidate $entry.FullName 'Known one-off script; archived in cleanup evidence before deletion'
      }
      else { $skipped.Add([PSCustomObject]@{ path = $entry.FullName; reason = 'Unrecognized temporary content; preserved for manual review.' }) }
    }
  }
  if ($IncludeBuild -and (Test-Path -LiteralPath (Join-Path $workspace 'build'))) {
    Add-Candidate (Join-Path $workspace 'build') 'Explicitly requested regenerable build; pnpm build needed before pnpm start'
  }
}

$total = [long](($candidates | Measure-Object -Property bytes -Sum).Sum)
Write-Host ('Preserving current verified ZIP: ' + $archive)
Write-Host ($Kind + ': ' + $candidates.Count + ' candidates, ' + [Math]::Round($total / 1GB, 2) + ' GiB; ' + $skipped.Count + ' skipped.')
$candidates | Select-Object path, reason, bytes | Format-Table -AutoSize | Out-Host
if (-not $Apply) {
  Write-Host 'PREVIEW ONLY. Add -Apply to delete the listed candidates. Default minimum age is 30 minutes.'
  return
}
Assert-Idle
$logRoot = Join-Path $maintenance ('local-cleanup-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '-' + $Kind.ToLowerInvariant())
Assert-LocalPath $logRoot | Out-Null
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$report = [PSCustomObject]@{
  startedAt = [DateTime]::UtcNow.ToString('o'); kind = $Kind; currentVersion = $project.version
  currentArchive = $archive; archiveSha256 = $archiveHash; portableProof = $proof
  minimumAgeMinutes = $MinimumAgeMinutes; includeBuild = [bool]$IncludeBuild
  candidates = $candidates.ToArray(); skipped = $skipped.ToArray(); deletedBytes = 0; result = 'started'
}
$reportPath = Join-Path $logRoot 'cleanup.json'
function Save-Report { $report | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $reportPath -Encoding utf8 }
Save-Report
try {
  foreach ($candidate in $candidates) {
    Assert-Idle
    $current = Get-Item -LiteralPath $archive
    if ($current.Length -ne $archiveBefore.Length -or $current.LastWriteTimeUtc -ne $archiveBefore.LastWriteTimeUtc) { throw 'Current ZIP changed during cleanup; stopped.' }
    $snapshot = Read-Snapshot $candidate.path
    if ($snapshot.bytes -ne $candidate.bytes -or $snapshot.entries -ne $candidate.entries -or $snapshot.newest -ne $candidate.newest) { throw ('Candidate changed during cleanup; stopped: ' + $candidate.path) }
    if ($candidate.reason -like 'Known one-off script*') {
      $scriptArchive = Join-Path $logRoot 'temporary-scripts'
      New-Item -ItemType Directory -Path $scriptArchive -Force | Out-Null
      Copy-Item -LiteralPath $candidate.path -Destination $scriptArchive
    }
    Remove-Item -LiteralPath $candidate.path -Recurse -Force
    $candidate.deleted = $true
    $report.deletedBytes += $candidate.bytes
    Save-Report
  }
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archiveHash) { throw 'Current release hash changed.' }
  $report.result = 'passed'
}
catch { $report.result = 'failed'; $report | Add-Member -NotePropertyName error -NotePropertyValue $_.Exception.Message; throw }
finally { Save-Report; Write-Host ('Cleanup report: ' + $reportPath) }
Write-Host ('Deleted ' + [Math]::Round($report.deletedBytes / 1GB, 2) + ' GiB. Current verified ZIP and historical evidence retained.')
