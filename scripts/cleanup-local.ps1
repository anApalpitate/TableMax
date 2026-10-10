[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('Releases', 'Intermediates', 'Maintenance')][string]$Kind,
  [switch]$Apply,
  [switch]$IncludeBuild,
  [switch]$KeepLatestOnly,
  [string]$ProjectRoot,
  [string[]]$TemporaryNames = @(),
  [string[]]$VerificationCopies = @(),
  [string]$DuplicateScreenshotsManifest,
  [string]$RetiredGeneratedManifest,
  [string]$HistoricalScreenshotsManifest,
  [string]$RegisteredArtifactsManifest,
  [ValidateRange(0, 10080)][int]$MinimumAgeMinutes = 30,
  [ValidateRange(0.001, 1024)][double]$HighWaterGiB = 10,
  [ValidateRange(0, 1024)][double]$LowWaterGiB = 8,
  [ValidatePattern('^\d+\.\d+\.\d+$')][string[]]$RetiredVersions = @()
)

$ErrorActionPreference = 'Stop'
$sourceWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$automatic = $Kind -eq 'Maintenance'
if ($PSBoundParameters.ContainsKey('RegisteredArtifactsManifest') -and ([string]::IsNullOrWhiteSpace($RegisteredArtifactsManifest) -or $Kind -ne 'Intermediates' -or $IncludeBuild -or $KeepLatestOnly -or $TemporaryNames.Count -or $VerificationCopies.Count -or $RetiredVersions.Count -or $DuplicateScreenshotsManifest -or $RetiredGeneratedManifest -or $HistoricalScreenshotsManifest -or $MinimumAgeMinutes -lt 30)) {
  throw 'RegisteredArtifactsManifest requires exclusive intermediate cleanup with at least 30 minutes protection.'
}
if ($PSBoundParameters.ContainsKey('HistoricalScreenshotsManifest') -and
    ([string]::IsNullOrWhiteSpace($HistoricalScreenshotsManifest) -or $Kind -ne 'Intermediates' -or $IncludeBuild -or $KeepLatestOnly -or $TemporaryNames.Count -or $VerificationCopies.Count -or $RetiredVersions.Count -or $DuplicateScreenshotsManifest -or $RetiredGeneratedManifest)) {
  throw 'HistoricalScreenshotsManifest requires an explicit manifest and exclusive manual intermediate cleanup.'
}
if ($PSBoundParameters.ContainsKey('RetiredGeneratedManifest') -and
    ([string]::IsNullOrWhiteSpace($RetiredGeneratedManifest) -or $Kind -ne 'Intermediates' -or $IncludeBuild -or $KeepLatestOnly -or $TemporaryNames.Count -or $VerificationCopies.Count -or $RetiredVersions.Count -or $DuplicateScreenshotsManifest)) {
  throw 'RetiredGeneratedManifest requires an explicit manifest and exclusive manual intermediate cleanup.'
}
if ($PSBoundParameters.ContainsKey('DuplicateScreenshotsManifest') -and
    ([string]::IsNullOrWhiteSpace($DuplicateScreenshotsManifest) -or $Kind -ne 'Intermediates' -or $IncludeBuild -or $KeepLatestOnly -or $TemporaryNames.Count -or $VerificationCopies.Count -or $RetiredVersions.Count)) {
  throw 'DuplicateScreenshotsManifest requires a nonempty manifest and manual intermediate cleanup without other modes.'
}
if ($KeepLatestOnly -and ($Kind -ne 'Releases' -or $IncludeBuild -or $RetiredVersions.Count -or $TemporaryNames.Count -or $VerificationCopies.Count)) {
  throw 'KeepLatestOnly is only supported by manual release cleanup without other cleanup modes.'
}
if ($PSBoundParameters.ContainsKey('VerificationCopies') -and -not $VerificationCopies.Count) {
  throw 'VerificationCopies requires a nonempty list of exact directory paths.'
}
if ($VerificationCopies.Count) {
  if ($Kind -ne 'Intermediates' -or $IncludeBuild -or $TemporaryNames.Count) {
    throw 'VerificationCopies is only supported by manual intermediate cleanup without TemporaryNames or IncludeBuild.'
  }
  $seenVerificationCopies = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $VerificationCopies = @($VerificationCopies | ForEach-Object {
    $relative = $_.Replace('\', '/')
    if ($relative -notmatch '^artifacts/maintenance/v1\.0\.2/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/native-audio/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/work-[A-Za-z0-9]{6}/(?:extracted|checkpoint-(?:bid|plant|fuel|build|run|end)/desktop)$') {
      throw 'VerificationCopies must contain exact native-audio extracted or checkpoint desktop directory paths under artifacts/maintenance/v1.0.2.'
    }
    if (-not $seenVerificationCopies.Add($relative)) { throw 'VerificationCopies contains duplicate paths.' }
    $relative
  })
}
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
$releaseManifest = Join-Path $releases ('TableMax-' + $project.version + '-win-x64-manifest.json')
$currentExtraction = Join-Path $releases ('TableMax-' + $project.version + '-win-x64')
$preservedFiles = @()
$cutoff = [DateTime]::UtcNow.AddMinutes(-$MinimumAgeMinutes)
$candidates = New-Object 'System.Collections.Generic.List[object]'
$skipped = New-Object 'System.Collections.Generic.List[object]'
$verificationProofs = New-Object 'System.Collections.Generic.List[object]'

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
  $absolute = Assert-LocalPath $Path
  if (-not ('TableMax.WorkspaceSnapshotV2' -as [type])) {
    Add-Type -Path (Join-Path $PSScriptRoot 'WorkspaceSnapshot.cs')
  }
  return [TableMax.WorkspaceSnapshotV2]::Read($absolute)
}

function Read-VerificationProof([string]$Relative) {
  $absolute = Assert-LocalPath (Join-Path $workspace $Relative)
  if (-not (Test-Path -LiteralPath $absolute -PathType Container)) {
    throw ('Selected verification copy directory does not exist: ' + $Relative)
  }
  # The run's results.json is a sibling of work-XXXXXX. Do not search any
  # unrelated evidence or sibling work directories in this explicit mode.
  $workRelative = $Relative -replace '/(?:extracted|checkpoint-(?:bid|plant|fuel|build|run|end)/desktop)$', ''
  $work = Assert-LocalPath (Join-Path $workspace $workRelative)
  $run = Split-Path $work -Parent
  $cursor = $absolute
  while ($cursor -and $cursor -ne $workspace) {
    if (Test-Path -LiteralPath (Join-Path $cursor '.git')) {
      throw ('Cleanup refuses nested repositories: ' + $cursor)
    }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  $evidencePath = Assert-LocalPath (Join-Path $run 'results.json')
  if (-not (Test-Path -LiteralPath $evidencePath -PathType Leaf)) {
    throw ('Selected verification copy has no parent portable evidence: ' + $Relative)
  }
  $record = Get-Content -LiteralPath $evidencePath -Raw -Encoding utf8 | ConvertFrom-Json
  if (-not ($record.portable -is [bool]) -or -not $record.portable -or $record.result -ne 'passed' -or $record.archiveSha256 -ne $archiveHash) {
    throw ('Selected verification copy parent evidence is not a passing portable result for the current ZIP: ' + $Relative)
  }
  if (-not ($record.work -is [string]) -or -not [IO.Path]::IsPathRooted($record.work) -or [IO.Path]::GetFullPath($record.work).TrimEnd('\') -ne $work) {
    throw ('Selected verification copy does not match the work directory recorded by its parent portable evidence: ' + $Relative)
  }
  return [PSCustomObject]@{
    relativePath = $Relative; path = $absolute; work = $work; evidencePath = $evidencePath
    portable = $true; result = 'passed'; archiveSha256 = $archiveHash
    evidenceSha256 = (Get-FileHash -LiteralPath $evidencePath -Algorithm SHA256).Hash.ToLowerInvariant()
    fingerprint = (Read-Snapshot $evidencePath).fingerprint
  }
}

function Measure-Workspace {
  Assert-LocalPath $workspace | Out-Null
  # Measure the full workspace before and after cleanup. Avoid a PowerShell
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

function Add-Candidate([string]$Path, [string]$Reason, $VerificationProof = $null) {
  try {
    $absolute = Assert-LocalPath $Path
    if ($absolute -eq $archive -or ($KeepLatestOnly -and $absolute -eq $releaseManifest)) {
      throw 'Current verified release file is protected.'
    }
    if (-not $KeepLatestOnly -and $absolute -eq $currentExtraction) {
      throw 'Current release extraction is protected outside KeepLatestOnly.'
    }
    $snapshot = Read-Snapshot $absolute
  }
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
    verificationProof = $VerificationProof
  })
}

. (Join-Path $PSScriptRoot 'cleanup-guard.ps1')

function Assert-PreservedRelease {
  foreach ($preserved in $preservedFiles) {
    Assert-LocalPath $preserved.path | Out-Null
    $current = Get-Item -LiteralPath $preserved.path -Force
    if ($current.PSIsContainer -or $current.Length -ne $preserved.bytes -or $current.LastWriteTimeUtc.Ticks -ne $preserved.lastWriteTimeUtcTicks -or
        (Get-FileHash -LiteralPath $preserved.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $preserved.sha256) {
      throw ('Preserved current release file changed during cleanup; stopped: ' + $preserved.path)
    }
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
  if ($VerificationCopies.Count) {
    foreach ($relative in $VerificationCopies) {
      $verificationProofs.Add((Read-VerificationProof $relative))
    }
    $proof = $verificationProofs[0].evidencePath
  }
  elseif (Test-Path -LiteralPath $maintenance -PathType Container) {
    Read-Snapshot (Join-Path $workspace 'package.json') | Out-Null
    foreach ($proofPath in [TableMax.WorkspaceSnapshotV2]::FindReports($maintenance)) {
      if (-not $proof) {
        $record = $null
        try { $record = Get-Content -LiteralPath $proofPath -Raw -Encoding utf8 | ConvertFrom-Json }
        catch { }
        if ($record -and $record.portable -eq $true -and (-not $KeepLatestOnly -or $record.portable -is [bool]) -and $record.result -eq 'passed' -and $record.archiveSha256 -eq $archiveHash) { $proof = $proofPath; break }
      }
    }
  }
  if (-not $proof) { throw 'No passing portable evidence matches the current ZIP; cleanup stopped.' }
  $preservedFiles = @([PSCustomObject]@{
    path = $archive; bytes = $archiveBefore.Length; lastWriteTimeUtcTicks = $archiveBefore.LastWriteTimeUtc.Ticks; sha256 = $archiveHash
  })
  if ($KeepLatestOnly) {
    Assert-LocalPath $releases | Out-Null
    $cursor = $releases
    while ($cursor -and $cursor -ne $workspace) {
      if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { throw ('Cleanup refuses nested repositories: ' + $cursor) }
      $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
    Assert-LocalPath $releaseManifest | Out-Null
    if (-not (Test-Path -LiteralPath $releaseManifest -PathType Leaf)) { throw 'Current release manifest is missing; KeepLatestOnly stopped.' }
    $manifestBefore = Get-Item -LiteralPath $releaseManifest -Force
    $manifestHash = (Get-FileHash -LiteralPath $releaseManifest -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifestRecord = Get-Content -LiteralPath $releaseManifest -Raw -Encoding utf8 | ConvertFrom-Json
    if ($manifestRecord.version -ne $project.version -or $manifestRecord.archive.name -ne [IO.Path]::GetFileName($archive) -or
        $manifestRecord.archive.bytes -ne $archiveBefore.Length -or -not ($manifestRecord.archive.sha256 -is [string]) -or
        $manifestRecord.archive.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $manifestRecord.archive.sha256 -ne $archiveHash) {
      throw 'Current release manifest does not match the current ZIP; KeepLatestOnly stopped.'
    }
    $preservedFiles += [PSCustomObject]@{
      path = $releaseManifest; bytes = $manifestBefore.Length; lastWriteTimeUtcTicks = $manifestBefore.LastWriteTimeUtc.Ticks
      sha256 = $manifestHash
    }
    foreach ($name in @(('TableMax-' + $project.version + '-win-x64.exe'), ('TableMax-' + $project.version + '-source.zip'))) {
      $publishedFile = Join-Path $releases $name
      if (Test-Path -LiteralPath $publishedFile -PathType Leaf) {
        Assert-LocalPath $publishedFile | Out-Null
        $publishedBefore = Get-Item -LiteralPath $publishedFile -Force
        $preservedFiles += [PSCustomObject]@{path=$publishedFile;bytes=$publishedBefore.Length;lastWriteTimeUtcTicks=$publishedBefore.LastWriteTimeUtc.Ticks;sha256=(Get-FileHash -LiteralPath $publishedFile -Algorithm SHA256).Hash.ToLowerInvariant()}
      }
    }
    Assert-PreservedRelease
  }
}
catch {
  if (-not $automatic) { throw }
  $summary.result = 'blocked'; $summary.reason = $_.Exception.Message
  Write-Host ('Maintenance preserved all files: ' + $summary.reason)
  return $summary
}

if ($KeepLatestOnly) {
  foreach ($entry in Get-ChildItem -LiteralPath $releases -Force) {
    if ($entry.FullName -notin $preservedFiles.path) {
      Add-Candidate $entry.FullName 'Explicit KeepLatestOnly release directory cleanup'
    }
  }
}
elseif ($Kind -eq 'Releases' -or $automatic) {
  foreach ($entry in Get-ChildItem -LiteralPath $releases -Force) {
    if ($entry.Name -match '^TableMax-(\d+\.\d+\.\d+)-(?:win-x64(?:\.zip|-manifest\.json)?|source\.zip|manifest\.json)$') {
      if ([version]$Matches[1] -lt $currentVersion -or $retired -contains [version]$Matches[1]) { Add-Candidate $entry.FullName 'Historical release archive or extraction' }
    }
    elseif ($entry.PSIsContainer -and $entry.Name -match '^package-(\d+\.\d+\.\d+)-[A-Za-z0-9]{6}$') {
      if ([version]$Matches[1] -lt $currentVersion -or $retired -contains [version]$Matches[1]) { Add-Candidate $entry.FullName 'Historical packaging stage' }
    }
  }
}
if ($RegisteredArtifactsManifest) {
  . (Join-Path $PSScriptRoot 'registered-artifacts.ps1')
  Initialize-RegisteredArtifacts
}
elseif ($HistoricalScreenshotsManifest) {
  . (Join-Path $PSScriptRoot 'historical-screenshots.ps1')
  Initialize-HistoricalScreenshots
}
elseif ($RetiredGeneratedManifest) {
  . (Join-Path $PSScriptRoot 'retired-generated.ps1')
  Initialize-RetiredGenerated
}
elseif ($DuplicateScreenshotsManifest) {
  $duplicateManifestPath = Assert-LocalPath (Join-Path $workspace $DuplicateScreenshotsManifest)
  if (-not $duplicateManifestPath.StartsWith($maintenance + '\', [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $duplicateManifestPath -PathType Leaf)) { throw 'Screenshot manifest must be a file inside artifacts/maintenance.' }
  $duplicateManifestSha256 = (Get-FileHash -LiteralPath $duplicateManifestPath).Hash
  $duplicatePlan = Get-Content -LiteralPath $duplicateManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($duplicatePlan.version -ne 1 -or -not $duplicatePlan.groups.Count) { throw 'Screenshot manifest has no groups or unsupported version.' }
  $duplicateDeletePaths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $duplicateGroupPaths = New-Object 'System.Collections.Generic.List[string]'
  foreach ($group in $duplicatePlan.groups) {
    if ($group.path -notmatch '^artifacts/maintenance/(v(\d+\.\d+\.\d+))/' -or -not $group.files.Count -or $group.path -match '(^|/)(\.\.?)(/|$)|\\|:') { throw 'Only explicit old-version screenshot groups are supported.' }
    $oldScreenshotRoot = Join-Path $maintenance $Matches[1]
    if ([version]$Matches[2] -ge $currentVersion) { throw 'Current and future version screenshots cannot be retired.' }
    $groupPath = Assert-LocalPath (Join-Path $workspace $group.path)
    if (-not $groupPath.StartsWith($oldScreenshotRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Screenshot group is outside the declared old version.' }
    $groupCursor = $groupPath
    while ($groupCursor -and $groupCursor -ne $workspace) {
      if (Test-Path -LiteralPath (Join-Path $groupCursor '.git')) { throw ('Screenshot cleanup refuses nested repositories: ' + $groupCursor) }
      $groupCursor = [IO.Path]::GetDirectoryName($groupCursor)
    }
    foreach ($priorGroup in $duplicateGroupPaths) {
      if ($groupPath -eq $priorGroup -or $groupPath.StartsWith($priorGroup + '\', [StringComparison]::OrdinalIgnoreCase) -or $priorGroup.StartsWith($groupPath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Screenshot groups cannot duplicate or overlap.' }
    }
    $duplicateGroupPaths.Add($groupPath)
    foreach ($file in $group.files) {
      $filePath = Assert-LocalPath (Join-Path $workspace $file.path)
      if ([IO.Path]::GetDirectoryName($filePath) -ne $groupPath -or [IO.Path]::GetExtension($filePath) -ne '.png' -or $file.sha256 -notmatch '^[a-f0-9]{64}$' -or -not $duplicateDeletePaths.Add($filePath)) { throw 'Screenshot manifest contains invalid or duplicate direct PNG paths.' }
    }
  }
  foreach ($group in $duplicatePlan.groups) {
    foreach ($file in $group.files) {
      $retainedPath = Assert-LocalPath (Join-Path $workspace $file.retainedPath)
      if (-not $retainedPath.StartsWith((Join-Path $workspace 'artifacts') + '\', [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($retainedPath) -ne '.png' -or $duplicateDeletePaths.Contains($retainedPath)) { throw 'Retained PNG must stay outside the deletion set inside artifacts.' }
      foreach ($relative in @($file.path, $file.retainedPath)) {
        $absolute = Assert-LocalPath (Join-Path $workspace $relative)
        $item = Get-Item -LiteralPath $absolute -Force
        if ($item.PSIsContainer -or $item.Length -ne $file.bytes -or (Get-FileHash -LiteralPath $absolute).Hash.ToLowerInvariant() -ne $file.sha256) { throw ('Duplicate screenshot content mismatch: ' + $relative) }
      }
    }
    $countBefore = $candidates.Count
    Add-Candidate (Join-Path $workspace $group.path) 'Explicit exact historical screenshot duplicates; retained PNG remains'
    if ($candidates.Count -gt $countBefore) {
      $candidate = $candidates[$candidates.Count - 1]
      $candidate.bytes = [long](($group.files | Measure-Object bytes -Sum).Sum)
      $candidate | Add-Member -NotePropertyName duplicateScreenshots -NotePropertyValue @($group.files)
      $candidate | Add-Member -NotePropertyName deletionScope -NotePropertyValue 'Listed direct PNG files only; parent directory retained'
    }
  }
  if ((Get-FileHash -LiteralPath $duplicateManifestPath).Hash -ne $duplicateManifestSha256) { throw 'Screenshot manifest changed during preview.' }
}
elseif ($VerificationCopies.Count) {
  foreach ($verificationProof in $verificationProofs) {
    Add-Candidate $verificationProof.path 'Explicitly selected regenerable native-audio extraction or WebView2 profile copy' $verificationProof
  }
}
elseif ($Kind -eq 'Intermediates' -or $automatic) {
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
      if ($entry.PSIsContainer -and ($entry.Name -match '^(app-icon-verify|root-entry|connection-entry|box-layout|debug-(portable|recovery|remote)|card-layout|countdown-crosslayer|desktop-verify|desktop-fullscreen|display(-portable)?|experience|game-prototype-verify|game-ui|game-review|modern-art-verify|modern-art-polish(-v2)?|modern-art-fullscreen|modern-art-audio-verify|party(-portable|-startup)?|play-presentation(-portable)?|pokemon-desktop|pokemon-verify|pokemon-ui-redesign|pokemon-expansion-(runtime|normal-play|effects)|portable-storage(-games)?|portable-extracted|portable-game|prototype-verify|room-levels(-portable)?|runtime-memory|shipping-executable|six-result-layout|tablemax-sqlite-migration)-[A-Za-z0-9]{6}$' -or $entry.Name -match '^fullscreen-portable-[a-f0-9]{8}$')) {
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
if ($KeepLatestOnly) { Write-Host ('Preserving matching release manifest: ' + $releaseManifest) }
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
  $logRoot = if ($RetiredGeneratedManifest -and $cleanupHistoryConsolidation) {
    Join-Path $maintenance ('cleanup-history/operations/' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '-' + $Kind.ToLowerInvariant())
  } else {
    Join-Path $maintenance ('local-cleanup-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '-' + $Kind.ToLowerInvariant())
  }
  Assert-LocalPath $logRoot | Out-Null
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
  $report = [PSCustomObject]@{
    startedAt = [DateTime]::UtcNow.ToString('o'); kind = $Kind; currentVersion = $project.version; retiredVersions = $RetiredVersions
    currentArchive = $archive; archiveSha256 = $archiveHash; portableProof = $proof
    minimumAgeMinutes = $MinimumAgeMinutes; includeBuild = [bool]$IncludeBuild; keepLatestOnly = [bool]$KeepLatestOnly; temporaryNames = $TemporaryNames
    preservedFiles = $preservedFiles
    verificationCopies = $VerificationCopies; verificationProofs = $verificationProofs.ToArray()
    duplicateScreenshotsManifest = $DuplicateScreenshotsManifest
    retiredGeneratedManifest = $RetiredGeneratedManifest
    historicalScreenshotsManifest = $HistoricalScreenshotsManifest
    registeredArtifactsManifest = $RegisteredArtifactsManifest
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
      $current = Get-Item -LiteralPath $archive
      if ($current.Length -ne $archiveBefore.Length -or $current.LastWriteTimeUtc -ne $archiveBefore.LastWriteTimeUtc) { throw 'Current ZIP changed during cleanup; stopped.' }
      $snapshot = $candidate
      if ($candidate.verificationProof) {
        $verified = Read-VerificationProof $candidate.verificationProof.relativePath
        if ($verified.fingerprint -ne $candidate.verificationProof.fingerprint -or $verified.evidenceSha256 -ne $candidate.verificationProof.evidenceSha256) {
          throw ('Parent portable evidence changed during cleanup; stopped: ' + $verified.evidencePath)
        }
      }
      if ($candidate.PSObject.Properties['retiredGenerated']) {
        Assert-RetiredGenerated $candidate.retiredGenerated
      }
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
      if ($candidate.PSObject.Properties['registeredArtifact']) { Assert-RegisteredArtifact $candidate.registeredArtifact }
      if ((Read-Snapshot $candidate.path).fingerprint -ne $candidate.fingerprint) {
        throw ('Candidate changed before deletion; stopped: ' + $candidate.path)
      }
      if ($KeepLatestOnly) { Assert-PreservedRelease }
      if ($candidate.PSObject.Properties['retiredGenerated']) {
        Assert-RetiredGenerated $candidate.retiredGenerated
      }
      if ($candidate.PSObject.Properties['historicalScreenshots']) {
        Assert-HistoricalScreenshots $candidate.historicalScreenshots
        if ((Read-Snapshot $candidate.path).fingerprint -ne $candidate.fingerprint) { throw 'Historical screenshot directory changed during verification.' }
        $selectedScreenshotPaths = @($candidate.historicalScreenshots.files | ForEach-Object { Join-Path $workspace $_.path })
        Remove-Item -LiteralPath $selectedScreenshotPaths -Force
      }
      elseif ($candidate.PSObject.Properties['duplicateScreenshots']) {
        if ((Get-FileHash -LiteralPath $duplicateManifestPath).Hash -ne $duplicateManifestSha256) { throw 'Screenshot manifest changed before deletion.' }
        foreach ($file in $candidate.duplicateScreenshots) {
          foreach ($relative in @($file.path, $file.retainedPath)) {
            $absolute = Assert-LocalPath (Join-Path $workspace $relative)
            $item = Get-Item -LiteralPath $absolute -Force
            if ($item.PSIsContainer -or $item.Length -ne $file.bytes -or (Get-FileHash -LiteralPath $absolute).Hash.ToLowerInvariant() -ne $file.sha256) { throw ('Duplicate screenshot changed before deletion: ' + $relative) }
          }
        }
        if ((Read-Snapshot $candidate.path).fingerprint -ne $candidate.fingerprint) { throw 'Screenshot directory changed during hash verification.' }
        $selectedPngPaths = @($candidate.duplicateScreenshots | ForEach-Object { Join-Path $workspace $_.path })
        Remove-Item -LiteralPath $selectedPngPaths -Force
      }
      else { Remove-Item -LiteralPath $candidate.path -Recurse -Force }
      $candidate.deleted = $true
      $report.deletedBytes += $candidate.bytes
      # Use validated deleted bytes for the stopping estimate. One final full
      # measurement reports actual capacity, including unrelated writes/archives.
      if ($automatic) { $report.bytesAfter = [Math]::Max(0L, $summary.bytesBefore - $report.deletedBytes) }
      Save-Report
    }
    if ($KeepLatestOnly) { Assert-PreservedRelease }
    elseif ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archiveHash) { throw 'Current release hash changed.' }
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
