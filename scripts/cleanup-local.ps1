[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('Releases', 'Intermediates', 'Maintenance')][string]$Kind,
  [switch]$Apply,
  [switch]$IncludeBuild,
  [string]$ProjectRoot,
  [string[]]$TemporaryNames = @(),
  [ValidateRange(0, 10080)][int]$MinimumAgeMinutes = 30,
  [ValidateRange(0.001, 1024)][double]$HighWaterGiB = 5,
  [ValidateRange(0, 1024)][double]$LowWaterGiB = 4,
  [ValidatePattern('^\d+\.\d+\.\d+$')][string[]]$RetiredVersions = @()
)

$ErrorActionPreference = 'Stop'
$sourceWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$automatic = $Kind -eq 'Maintenance'
if ($TemporaryNames.Count) {
  if ($Kind -ne 'Intermediates' -or $IncludeBuild) {
    throw 'TemporaryNames is only supported by manual intermediate cleanup without IncludeBuild.'
  }
  $seenTemporaryNames = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($name in $TemporaryNames) {
    if ([string]::IsNullOrWhiteSpace($name) -or $name -in @('.', '..') -or $name -match '[\\/:]' -or $name.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0) {
      throw 'TemporaryNames must contain exact names of immediate tmp children.'
    }
    if (-not $seenTemporaryNames.Add($name)) { throw 'TemporaryNames contains duplicate names.' }
  }
}
if ($RetiredVersions.Count -and $Kind -ne 'Releases') {
  throw 'Explicit retired versions are only supported by manual release cleanup.'
}
if ($automatic -and ($LowWaterGiB -ge $HighWaterGiB -or $IncludeBuild -or $MinimumAgeMinutes -lt 30)) {
  throw 'Maintenance requires a lower low-water mark, protects build, and keeps at least 30 minutes of recent changes.'
}

function Read-Repository([string]$Path) {
  try {
    $top = & git --no-optional-locks -C $Path rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $common = & git --no-optional-locks -C $Path rev-parse --path-format=absolute --git-common-dir 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return [PSCustomObject]@{ top = [IO.Path]::GetFullPath([string]$top).TrimEnd('\'); common = [IO.Path]::GetFullPath([string]$common).TrimEnd('\') }
  }
  catch { return $null }
}

$sourceRepository = Read-Repository $sourceWorkspace
$workspace = $sourceWorkspace
if ($ProjectRoot) {
  $workspace = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
  if ($workspace -ne $sourceWorkspace) {
    $selectedRepository = Read-Repository $workspace
    if (-not $sourceRepository -or -not $selectedRepository -or $selectedRepository.top -ne $workspace -or $selectedRepository.common -ne $sourceRepository.common) {
      throw 'ProjectRoot must be a checkout of this same Git repository; unrelated projects are never maintained.'
    }
  }
}
elseif ($automatic) {
  if (-not $sourceRepository -or $sourceRepository.top -ne $sourceWorkspace) {
    throw 'Cannot discover the main Git workspace. Specify this script workspace explicitly with -ProjectRoot.'
  }
  $worktrees = @(& git --no-optional-locks -C $sourceWorkspace worktree list --porcelain)
  if ($LASTEXITCODE -ne 0 -or -not $worktrees.Count -or $worktrees[0] -notlike 'worktree *') { throw 'Cannot discover the main Git workspace.' }
  $workspace = [IO.Path]::GetFullPath($worktrees[0].Substring(9)).TrimEnd('\')
  $selectedRepository = Read-Repository $workspace
  if (-not $selectedRepository -or $selectedRepository.top -ne $workspace -or $selectedRepository.common -ne $sourceRepository.common) {
    throw 'Discovered main workspace does not belong to this repository.'
  }
}
$project = Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw -Encoding utf8 | ConvertFrom-Json
if ($project.name -ne 'tablemax' -or $project.version -notmatch '^\d+\.\d+\.\d+$') {
  throw 'This tool only operates inside the TableMax source workspace.'
}
$currentVersion = [version]$project.version
$retired = @($RetiredVersions | ForEach-Object { [version]$_ })
if ($retired -contains $currentVersion) { throw 'The current verified release cannot be retired.' }
$releases = Join-Path $workspace 'artifacts/releases'
$temporary = Join-Path $workspace 'tmp'
foreach ($name in $TemporaryNames) {
  if (-not (Test-Path -LiteralPath (Join-Path $temporary $name))) {
    throw ('Selected temporary entry does not exist: ' + $name)
  }
}
$archive = Join-Path $releases ('TableMax-' + $project.version + '-win-x64.zip')
$cutoff = [DateTime]::UtcNow.AddMinutes(-$MinimumAgeMinutes)
$candidates = New-Object 'System.Collections.Generic.List[object]'
$skipped = New-Object 'System.Collections.Generic.List[object]'

function Assert-LocalPath([string]$Path) {
  $absolute = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  if ($absolute -ne $workspace -and -not $absolute.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Cleanup target is outside the workspace.'
  }
  $cursor = $absolute
  while ($cursor) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw ('Cleanup refuses reparse points: ' + $cursor)
      }
    }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  return $absolute
}

function Read-Tree([string]$Path) {
  $absolute = Assert-LocalPath $Path
  $pending = New-Object 'System.Collections.Generic.Stack[string]'
  $pending.Push($absolute)
  while ($pending.Count -gt 0) {
    $item = Get-Item -LiteralPath $pending.Pop() -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw ('Cleanup refuses reparse points: ' + $item.FullName)
    }
    if ($item.PSIsContainer -and (Test-Path -LiteralPath (Join-Path $item.FullName '.git'))) {
      throw ('Cleanup refuses nested repositories: ' + $item.FullName)
    }
    $item
    if ($item.PSIsContainer) {
      foreach ($child in Get-ChildItem -LiteralPath $item.FullName -Force | Sort-Object Name) {
        if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) {
          throw ('Cleanup refuses reparse points: ' + $child.FullName)
        }
        if ($child.PSIsContainer) { $pending.Push($child.FullName) }
        else { $child }
      }
    }
  }
}

function Read-Snapshot([string]$Path) {
  $bytes = [long]0
  $entries = 0
  $newest = [DateTime]::MinValue
  $digest = [Security.Cryptography.SHA256]::Create()
  try {
    Read-Tree $Path | ForEach-Object {
      $entries++
      $length = 0
      if (-not $_.PSIsContainer) { $length = $_.Length; $bytes += $length }
      if ($_.LastWriteTimeUtc -gt $newest) { $newest = $_.LastWriteTimeUtc }
      $metadata = [Text.Encoding]::UTF8.GetBytes(($_.FullName + '|' + $length + '|' + $_.LastWriteTimeUtc.Ticks + '|' + $_.Attributes + "`n"))
      $null = $digest.TransformBlock($metadata, 0, $metadata.Length, $metadata, 0)
    }
    $null = $digest.TransformFinalBlock((New-Object byte[] 0), 0, 0)
    $fingerprint = [BitConverter]::ToString($digest.Hash)
  }
  finally { $digest.Dispose() }
  return [PSCustomObject]@{ bytes = $bytes; entries = $entries; newest = $newest; fingerprint = $fingerprint }
}

function Measure-Workspace {
  Assert-LocalPath $workspace | Out-Null
  # Keep a full streaming measurement after every removal. Avoid a PowerShell
  # provider/pipeline invocation for every directory in large dependency trees.
  if (-not ('TableMax.WorkspaceCapacityV1' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
namespace TableMax {
  public sealed class WorkspaceCapacityResult {
    public long Bytes;
    public long Files;
    public long SkippedLinks;
    public long SkippedRepositories;
  }
  public static class WorkspaceCapacityV1 {
    public static WorkspaceCapacityResult Measure(string root) {
      var result = new WorkspaceCapacityResult();
      var pending = new Stack<DirectoryInfo>();
      pending.Push(new DirectoryInfo(root));
      while (pending.Count > 0) {
        var directory = pending.Pop();
        // Enumeration caches metadata; refresh before deciding whether to enter
        // a directory that could have become a junction since it was queued.
        directory.Refresh();
        if ((directory.Attributes & FileAttributes.ReparsePoint) != 0) {
          result.SkippedLinks++;
          continue;
        }
        var git = Path.Combine(directory.FullName, ".git");
        if (!String.Equals(directory.FullName, root, StringComparison.OrdinalIgnoreCase)
            && (Directory.Exists(git) || File.Exists(git))) {
          result.SkippedRepositories++;
          continue;
        }
        foreach (var entry in directory.EnumerateFileSystemInfos()) {
          if ((entry.Attributes & FileAttributes.ReparsePoint) != 0) {
            result.SkippedLinks++;
          } else if ((entry.Attributes & FileAttributes.Directory) != 0) {
            pending.Push((DirectoryInfo)entry);
          } else {
            result.Bytes = checked(result.Bytes + ((FileInfo)entry).Length);
            result.Files++;
          }
        }
      }
      return result;
    }
  }
}
'@
  }
  $capacity = [TableMax.WorkspaceCapacityV1]::Measure($workspace)
  return [PSCustomObject]@{ bytes = $capacity.Bytes; files = $capacity.Files; skippedLinks = $capacity.SkippedLinks; skippedRepositories = $capacity.SkippedRepositories }
}

function Add-Candidate([string]$Path, [string]$Reason) {
  try { $absolute = Assert-LocalPath $Path; $snapshot = Read-Snapshot $absolute }
  catch {
    $skipped.Add([PSCustomObject]@{ path = $Path; reason = $_.Exception.Message })
    return
  }
  if ($snapshot.newest -gt $cutoff) {
    $skipped.Add([PSCustomObject]@{ path = $absolute; reason = 'Recently modified; protected by the minimum age.' })
    return
  }
  $candidates.Add([PSCustomObject]@{
    path = $absolute; reason = $Reason; bytes = $snapshot.bytes
    entries = $snapshot.entries; newest = $snapshot.newest; fingerprint = $snapshot.fingerprint; deleted = $false
  })
}

function Assert-Idle {
  # Relative node commands do not expose cwd; treat matching tools as busy too.
  $busy = @(Get-CimInstance -ClassName Win32_Process | Where-Object {
    $_.Name -match '^(node|electron|TableMax|dotnet|MSBuild|msedgewebview2|7za|7z)\.exe$' -and (
      -not $_.CommandLine -or $_.Name -eq 'TableMax.exe' -or
      ([string]$_.ExecutablePath).IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      ([string]$_.CommandLine).IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      $_.CommandLine -match '(scripts[\\/](verify|dev|build|package|launch)|apps[\\/]desktop[\\/]native|electron-builder|vitest|\b(pnpm|npm)\b.*\b(build|dev|test|check|package:win|verify:\w+)\b)'
    )
  })
  if ($busy.Count -gt 0) {
    throw ('Close TableMax and finish development/verification before cleanup. Busy PIDs: ' + (($busy | ForEach-Object { $_.ProcessId }) -join ', '))
  }
}

$maintenance = Join-Path $workspace 'artifacts/maintenance'
$usage = $null
$summary = [PSCustomObject]@{
  workspace = $workspace; kind = $Kind; result = 'preview'; reason = $null
  highWaterBytes = [long]($HighWaterGiB * 1GB); lowWaterBytes = [long]($LowWaterGiB * 1GB)
  bytesBefore = $null; bytesAfter = $null; deletedBytes = [long]0
  skippedLinks = 0; skippedRepositories = 0; candidateCount = 0; reportPath = $null
}
if ($automatic) {
  if ($Apply) {
    try { Assert-Idle }
    catch {
      $summary.result = 'blocked'; $summary.reason = $_.Exception.Message
      Write-Host ('Maintenance preserved all files: ' + $summary.reason)
      return $summary
    }
  }
  $usage = Measure-Workspace
  $summary.bytesBefore = $usage.bytes; $summary.bytesAfter = $usage.bytes
  $summary.skippedLinks = $usage.skippedLinks; $summary.skippedRepositories = $usage.skippedRepositories
  Write-Host ('Workspace: ' + $workspace + '; ' + [Math]::Round($usage.bytes / 1GB, 3) + ' GiB logical file bytes, links and nested checkouts excluded.')
  if ($usage.bytes -le $summary.highWaterBytes) {
    $summary.result = 'below-threshold'
    Write-Host ('Below high-water mark (' + $HighWaterGiB + ' GiB); no cleanup needed.')
    return $summary
  }
}

# Preserve the current archive only after a real portable PASS proves its hash.
try {
  Assert-LocalPath $archive | Out-Null
  if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw 'Current release ZIP is missing; cleanup stopped.' }
  $archiveBefore = Get-Item -LiteralPath $archive
  $archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  $proof = $null
  if (Test-Path -LiteralPath $maintenance -PathType Container) {
    Read-Tree $maintenance | Where-Object { -not $_.PSIsContainer -and $_.Name -eq 'results.json' } | ForEach-Object {
      if (-not $proof) {
        $record = $null
        try { $record = Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8 | ConvertFrom-Json }
        catch { }
        if ($record -and $record.portable -eq $true -and $record.result -eq 'passed' -and $record.archiveSha256 -eq $archiveHash) { $proof = $_.FullName }
      }
    }
  }
  if (-not $proof) { throw 'No passing portable evidence matches the current ZIP; cleanup stopped.' }
}
catch {
  if (-not $automatic) { throw }
  $summary.result = 'blocked'; $summary.reason = $_.Exception.Message
  Write-Host ('Maintenance preserved all files: ' + $summary.reason)
  return $summary
}

if ($Kind -eq 'Releases' -or $automatic) {
  foreach ($entry in Get-ChildItem -LiteralPath $releases -Force) {
    if ($entry.Name -match '^TableMax-(\d+\.\d+\.\d+)-(?:win-x64(?:\.zip|-manifest\.json)?|source\.zip|manifest\.json)$') {
      if ([version]$Matches[1] -lt $currentVersion -or $retired -contains [version]$Matches[1]) { Add-Candidate $entry.FullName 'Historical release archive or extraction' }
    }
    elseif ($entry.PSIsContainer -and $entry.Name -match '^package-(\d+\.\d+\.\d+)-[A-Za-z0-9]{6}$') {
      if ([version]$Matches[1] -lt $currentVersion -or $retired -contains [version]$Matches[1]) { Add-Candidate $entry.FullName 'Historical packaging stage' }
    }
  }
}
if ($Kind -eq 'Intermediates' -or $automatic) {
  foreach ($entry in @(if (-not $TemporaryNames.Count) { Get-ChildItem -LiteralPath $releases -Force })) {
    if (($entry.PSIsContainer -and $entry.Name -match '^package-(\d+\.\d+\.\d+)-[A-Za-z0-9]{6}$' -and [version]$Matches[1] -le $currentVersion) -or $entry.Name -eq 'builder-debug.yml') {
      if (-not ($candidates | Where-Object { $_.path -eq $entry.FullName })) {
        Add-Candidate $entry.FullName 'Regenerable packaging stage or builder diagnostic'
      }
    }
  }
  if (Test-Path -LiteralPath $temporary -PathType Container) {
    foreach ($entry in Get-ChildItem -LiteralPath $temporary -Force) {
      if ($TemporaryNames.Count -and $entry.Name -notin $TemporaryNames) { continue }
      if ($entry.PSIsContainer -and $entry.Name -match '^(app-icon-verify|card-layout|desktop-verify|display(-portable)?|experience|game-prototype-verify|game-ui|modern-art-verify|party(-portable|-startup)?|play-presentation(-portable)?|pokemon-desktop|pokemon-verify|portable-extracted|portable-game|prototype-verify|room-levels(-portable)?|runtime-memory|six-result-layout|tablemax-sqlite-migration)-[A-Za-z0-9]{6}$') {
        Add-Candidate $entry.FullName 'Known isolated verification data or portable extraction'
      }
      elseif (-not $entry.PSIsContainer -and $entry.Name -match '^(check-(display|party|phone-table|presentation|release-cleanup)-docs\.mjs|cleanup-display-staging\.ps1|display-(dialog|dpi)-probe\.mjs|finalize-presentation-evidence\.mjs|inspect-six-result\.mjs|update-presentation-docs\.mjs)$') {
        Add-Candidate $entry.FullName 'Known one-off script; archived in cleanup evidence before deletion'
      }
      elseif ($TemporaryNames.Count) {
        Add-Candidate $entry.FullName 'Explicitly reviewed temporary content; archived before deletion'
      }
      else { $skipped.Add([PSCustomObject]@{ path = $entry.FullName; reason = 'Unrecognized temporary content; preserved for manual review.' }) }
    }
  }
  if ($IncludeBuild -and (Test-Path -LiteralPath (Join-Path $workspace 'build'))) {
    Add-Candidate (Join-Path $workspace 'build') 'Explicitly requested regenerable build; pnpm build needed before pnpm start'
  }
}

$total = [long](($candidates | Measure-Object -Property bytes -Sum).Sum)
$ordered = @($candidates | Sort-Object newest, path)
$summary.candidateCount = $ordered.Count
Write-Host ('Preserving current verified ZIP: ' + $archive)
Write-Host ($Kind + ': ' + $candidates.Count + ' candidates, ' + [Math]::Round($total / 1GB, 2) + ' GiB; ' + $skipped.Count + ' skipped.')
$candidates | Select-Object path, reason, bytes | Format-Table -AutoSize | Out-Host
if (-not $Apply) {
  Write-Host 'PREVIEW ONLY. Add -Apply to delete the listed candidates. Default minimum age is 30 minutes.'
  if ($automatic) { return $summary }
  return
}
if (-not $ordered.Count) {
  Write-Host 'No eligible candidates. Protected files remain in place, even above the size threshold.'
  if ($automatic) { $summary.result = 'no-candidates'; return $summary }
  return
}
Assert-Idle
$lockDigest = [Security.Cryptography.SHA256]::Create()
try { $lockId = [BitConverter]::ToString($lockDigest.ComputeHash([Text.Encoding]::UTF8.GetBytes($workspace.ToLowerInvariant()))).Replace('-', '') }
finally { $lockDigest.Dispose() }
$cleanupMutex = New-Object Threading.Mutex($false, ('Local\TableMax-Cleanup-' + $lockId))
$lockHeld = $false
try {
  try { $lockHeld = $cleanupMutex.WaitOne(0) }
  catch [Threading.AbandonedMutexException] { $lockHeld = $true }
  if (-not $lockHeld) { throw 'Another cleanup is already using this workspace; all files preserved.' }
  $logRoot = Join-Path $maintenance ('local-cleanup-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '-' + $Kind.ToLowerInvariant())
  Assert-LocalPath $logRoot | Out-Null
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
  $report = [PSCustomObject]@{
    startedAt = [DateTime]::UtcNow.ToString('o'); kind = $Kind; currentVersion = $project.version; retiredVersions = $RetiredVersions
    currentArchive = $archive; archiveSha256 = $archiveHash; portableProof = $proof
    minimumAgeMinutes = $MinimumAgeMinutes; includeBuild = [bool]$IncludeBuild; temporaryNames = $TemporaryNames
    workspace = $workspace; highWaterBytes = $summary.highWaterBytes; lowWaterBytes = $summary.lowWaterBytes
    bytesBefore = $summary.bytesBefore; bytesAfter = $summary.bytesAfter
    candidates = $ordered; skipped = $skipped.ToArray(); deletedBytes = [long]0; result = 'started'
  }
  $reportPath = Join-Path $logRoot 'cleanup.json'
  function Save-Report { $report | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $reportPath -Encoding utf8 }
  Save-Report
  try {
    foreach ($candidate in $ordered) {
      if ($automatic -and $report.bytesAfter -le $summary.lowWaterBytes) { break }
      Assert-Idle
      $current = Get-Item -LiteralPath $archive
      if ($current.Length -ne $archiveBefore.Length -or $current.LastWriteTimeUtc -ne $archiveBefore.LastWriteTimeUtc) { throw 'Current ZIP changed during cleanup; stopped.' }
      $snapshot = Read-Snapshot $candidate.path
      if ($snapshot.fingerprint -ne $candidate.fingerprint) { throw ('Candidate changed during cleanup; stopped: ' + $candidate.path) }
      if ($candidate.reason -like 'Known one-off script*') {
        $scriptArchive = Join-Path $logRoot 'temporary-scripts'
        New-Item -ItemType Directory -Path $scriptArchive -Force | Out-Null
        Copy-Item -LiteralPath $candidate.path -Destination $scriptArchive
      }
      if ($candidate.reason -like 'Explicitly reviewed temporary content*') {
        $temporaryArchive = Join-Path $logRoot 'reviewed-temporary-content'
        New-Item -ItemType Directory -Path $temporaryArchive -Force | Out-Null
        Copy-Item -LiteralPath $candidate.path -Destination $temporaryArchive -Recurse -Force
        $archivedPath = Join-Path $temporaryArchive ([IO.Path]::GetFileName($candidate.path))
        $archivedSnapshot = Read-Snapshot $archivedPath
        if ($archivedSnapshot.bytes -ne $snapshot.bytes -or $archivedSnapshot.entries -ne $snapshot.entries) {
          throw ('Temporary archive does not match the selected entry: ' + $candidate.path)
        }
        Read-Tree $candidate.path | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
          $copyPath = if ($_.FullName -eq $candidate.path) { $archivedPath } else { Join-Path $archivedPath $_.FullName.Substring($candidate.path.Length + 1) }
          if ((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $copyPath -Algorithm SHA256).Hash) {
            throw ('Temporary archive hash mismatch: ' + $_.FullName)
          }
        }
        if ((Read-Snapshot $candidate.path).fingerprint -ne $candidate.fingerprint) {
          throw ('Candidate changed while archiving; stopped: ' + $candidate.path)
        }
      }
      Assert-Idle
      if ((Read-Snapshot $candidate.path).fingerprint -ne $candidate.fingerprint) {
        throw ('Candidate changed before deletion; stopped: ' + $candidate.path)
      }
      Remove-Item -LiteralPath $candidate.path -Recurse -Force
      $candidate.deleted = $true
      $report.deletedBytes += $candidate.bytes
      # Re-measure after each removal: new unrelated files and archived scripts must
      # not be mistaken for reclaimed capacity. No file list is retained in memory.
      if ($automatic) { $report.bytesAfter = (Measure-Workspace).bytes }
      Save-Report
    }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archiveHash) { throw 'Current release hash changed.' }
    $report.result = 'passed'
  }
  catch { $report.result = 'failed'; $report | Add-Member -NotePropertyName error -NotePropertyValue $_.Exception.Message; throw }
  finally { Save-Report; Write-Host ('Cleanup report: ' + $reportPath) }
  Write-Host ('Deleted ' + [Math]::Round($report.deletedBytes / 1GB, 2) + ' GiB. Current verified ZIP and historical evidence retained.')
  if ($automatic) {
    $summary.bytesAfter = (Measure-Workspace).bytes
    $summary.deletedBytes = $report.deletedBytes
    $summary.reportPath = $reportPath
    $summary.result = if ($summary.bytesAfter -le $summary.lowWaterBytes) { 'target-reached' } else { 'candidates-exhausted' }
    if ($summary.result -eq 'candidates-exhausted') { Write-Host 'Eligible candidates exhausted; remaining protected files are preserved.' }
    return $summary
  }
}
finally {
  if ($lockHeld) { $cleanupMutex.ReleaseMutex() }
  $cleanupMutex.Dispose()
}
