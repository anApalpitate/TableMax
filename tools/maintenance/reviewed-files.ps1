# Manual, hash-bound single-use retirement of exact reviewed generated files.
# Dot-sourced only after cleanup-local has verified the current delivery.
if (-not ('TableMax.ReviewedFileGuardV1' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Security.Cryptography;
namespace TableMax {
  public static class ReviewedFileGuardV1 {
    public static string Check(string root, string relative, long bytes, long ticks, string sha256, long cutoff) {
      var path = Path.GetFullPath(Path.Combine(root, relative));
      if (!path.StartsWith(root + "\\", StringComparison.OrdinalIgnoreCase)) throw new IOException("Reviewed file escapes workspace.");
      for (var cursor = path; cursor != null; cursor = Path.GetDirectoryName(cursor)) {
        var attributes = File.GetAttributes(cursor);
        if ((attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("Reviewed file or ancestor is linked.");
        if (String.Equals(cursor, root, StringComparison.OrdinalIgnoreCase)) break;
        if ((attributes & FileAttributes.Directory) != 0 && (Directory.Exists(Path.Combine(cursor, ".git")) || File.Exists(Path.Combine(cursor, ".git"))))
          throw new IOException("Nested repository is protected.");
      }
      var item = new FileInfo(path);
      if ((item.Attributes & FileAttributes.Directory) != 0 || item.Length != bytes || item.LastWriteTimeUtc.Ticks != ticks || item.LastWriteTimeUtc.Ticks > cutoff)
        throw new IOException("Reviewed file changed or is recent: " + relative);
      string hash;
      using (var stream = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.Read))
      using (var digest = SHA256.Create()) hash = BitConverter.ToString(digest.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
      if (hash != sha256) throw new IOException("Reviewed file content hash changed: " + relative);
      item.Refresh();
      if (item.Length != bytes || item.LastWriteTimeUtc.Ticks != ticks) throw new IOException("Reviewed file changed while hashing.");
      return path;
    }
  }
}
'@
}

function Resolve-ReviewedPath([string]$Relative, [switch]$AnyRoot, [switch]$SyntaxOnly) {
  if ([string]::IsNullOrWhiteSpace($Relative) -or $Relative -match '[\\:*?]' -or
      @($Relative.Split('/') | Where-Object { $_ -in @('', '.', '..', '.git') }).Count -or
      (-not $AnyRoot -and $Relative -notmatch '^(tmp/|artifacts/|\.cache/build-modules/v1/|build/(?:desktop|native|native-obj|snapshots)(?:/|$))')) { throw ('Invalid reviewed path: ' + $Relative) }
  # The per-file compiled guard below checks every existing ancestor. Avoid
  # repeating PowerShell Get-Item calls for the same ancestors on large lists.
  if ($SyntaxOnly) {
    $absolute = [IO.Path]::GetFullPath((Join-Path $workspace $Relative))
    if (-not $absolute.StartsWith($workspace+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Reviewed path escapes workspace.' }
    return $absolute
  }
  $absolute = Assert-LocalPath (Join-Path $workspace $Relative)
  $cursor = Split-Path $absolute -Parent
  while ($cursor -and $cursor -ne $workspace) {
    if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { throw 'Nested repository is protected.' }
    $cursor = Split-Path $cursor -Parent
  }
  return $absolute
}

function Test-ReviewedPrefix([string]$Path, [string]$Prefix) {
  return $Path.Equals($Prefix, [StringComparison]::OrdinalIgnoreCase) -or $Path.StartsWith($Prefix.TrimEnd('/') + '/', [StringComparison]::OrdinalIgnoreCase)
}

function Assert-ReviewedRetainedCopy($File) {
  $copy = $File.retainedCopy
  if (-not $copy -or $copy.path -notmatch '^artifacts/game-packages/.+\.zip$' -or
      $copy.bytes -ne $File.bytes -or $copy.sha256 -ne $File.sha256 -or $copy.sha256 -notmatch '^[a-f0-9]{64}$') {
    throw 'Pages ZIP retirement requires an identical retained game-package ZIP.'
  }
  $path = Resolve-ReviewedPath $copy.path -AnyRoot
  $item = Get-Item -LiteralPath $path -Force
  if ($item.PSIsContainer) { throw 'Retained game package must be a regular ZIP file.' }
  [TableMax.ReviewedFileGuardV1]::Check($workspace, $copy.path, [long]$copy.bytes, $item.LastWriteTimeUtc.Ticks, $copy.sha256, [DateTime]::MaxValue.Ticks) | Out-Null
}

function Assert-ReviewedArchivedFile($File) {
  $copy = $File.preservedArchive
  $format = if ($copy -and $copy.PSObject.Properties['format']) { [string]$copy.format } else { 'zip' }
  if ($format -notin @('zip', 'ustar-xz-v1')) { throw 'Unknown preservation archive format.' }
  $archivePattern = if ($format -eq 'zip') { '^artifacts/maintenance/.+\.zip$' } else { '^artifacts/maintenance/.+\.tar\.xz$' }
  if (-not $copy -or $copy.path -notmatch $archivePattern -or
      -not [string]::Equals([string]$copy.entryPath, [string]$File.path, [StringComparison]::Ordinal) -or $copy.sha256 -notmatch '^[a-f0-9]{64}$' -or
      -not @($reviewedPlan.references | Where-Object { $_.path -eq $copy.path -and $_.sha256 -eq $copy.sha256 }).Count) {
    throw 'Archived content requires a permanent hash-bound archive and exact original member path.'
  }
  $archivePath = Resolve-ReviewedPath $copy.path -AnyRoot
  $key = $format + '|' + $archivePath + '|' + $copy.sha256
  if ($format -eq 'ustar-xz-v1') {
    if ($copy.tarSha256 -notmatch '^[a-f0-9]{64}$') { throw 'Preserved tar requires a fixed system-tar SHA-256 method binding.' }
    $key += '|' + $copy.tarSha256
    if (-not $reviewedArchivedMembers.ContainsKey($key)) {
      $verifier = Join-Path $PSScriptRoot 'verify-preserved-tar.mjs'
      $node = Join-Path $PSScriptRoot '../../.cache/node/22.14.0/runtime/node.exe'
      $output = & $node $verifier $format $archivePath $copy.sha256 $copy.tarSha256
      if ($LASTEXITCODE -ne 0) { throw 'Preserved tar verification failed.' }
      $verified = ($output -join "`n") | ConvertFrom-Json
      if ($verified.format -ne $format -or $verified.archiveSha256 -ne $copy.sha256 -or $verified.tarSha256 -ne $copy.tarSha256) { throw 'Preserved tar verification binding mismatch.' }
      $members = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
      foreach ($member in $verified.members.PSObject.Properties) { $members.Add($member.Name, $member.Value) }
      $reviewedArchivedMembers[$key] = $members
    }
    $members = $reviewedArchivedMembers[$key]
    if (-not $members.ContainsKey($File.path) -or $members[$File.path].bytes -ne $File.bytes -or $members[$File.path].sha256 -ne $File.sha256) { throw ('Archive does not retain complete original bytes: ' + $File.path) }
    return
  }
  if (-not $reviewedArchivedMembers.ContainsKey($key)) {
    if ((Get-FileHash -LiteralPath $archivePath).Hash.ToLowerInvariant() -ne $copy.sha256) { throw 'Preservation archive changed.' }
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $members = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
    $zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
      foreach ($member in $zip.Entries) {
        if ($member.FullName.EndsWith('/')) { continue }
        if ($member.FullName -match '[\\:]|(^|/)\.\.?(?:/|$)' -or $members.ContainsKey($member.FullName)) { throw 'Invalid or duplicate preserved archive member.' }
        $stream = $member.Open(); $digest = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($digest.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
        finally { $digest.Dispose(); $stream.Dispose() }
        $members.Add($member.FullName, [PSCustomObject]@{bytes=$member.Length;sha256=$hash})
      }
    }
    finally { $zip.Dispose() }
    $reviewedArchivedMembers[$key] = $members
  }
  $members = $reviewedArchivedMembers[$key]
  if (-not $members.ContainsKey($File.path) -or $members[$File.path].bytes -ne $File.bytes -or $members[$File.path].sha256 -ne $File.sha256) {
    throw ('Archive does not retain complete original bytes: ' + $File.path)
  }
}

function Assert-ReviewedAllowed($File, $Entry) {
  $absolute = Resolve-ReviewedPath $File.path -SyntaxOnly
  # A root may itself be one exact ordinary file. The compiled guard still
  # rejects directories, links, changed metadata and changed content.
  if (-not (Test-ReviewedPrefix $File.path $Entry.path)) { throw 'Reviewed file escapes its exact generated root.' }
  if ($File.path.StartsWith('build/snapshots/', [StringComparison]::OrdinalIgnoreCase)) {
    if ($File.path -notmatch '^build/snapshots/[a-f0-9]{64}(?:-assembly)?\.json$' -or -not $File.preservedArchive) { throw 'Frozen snapshots require full lossless preservation; pointers and unknown names stay protected.' }
  }
  if ($File.preservedArchive) {
    if ($Entry.origin -notin @('generated-copy','isolated-test')) { throw 'Only reviewed generated records or isolated tests may use archival preservation.' }
    Assert-ReviewedArchivedFile $File
  }
  if ($File.path.StartsWith('artifacts/pages/', [StringComparison]::OrdinalIgnoreCase)) {
    $pagesCopy = '^artifacts/pages/(?:(?:verification-[A-Za-z0-9_-]+|v\d+\.\d+\.\d+/(?:ready|published-history)-[A-Za-z0-9_-]+)/site/games/v\d+\.\d+\.\d+/packages/|v\d+\.\d+\.\d+/published-history-[A-Za-z0-9_-]+/packages/)TableMax-[A-Za-z0-9_.-]+\.zip$'
    if ($Entry.origin -ne 'generated-copy' -or $File.path -notmatch $pagesCopy) { throw 'Only audited duplicate Pages package ZIPs may be retired.' }
    Assert-ReviewedRetainedCopy $File
  }
  elseif ($File.PSObject.Properties['retainedCopy']) { throw 'Retained-copy exceptions apply only to duplicate Pages package ZIPs.' }
  if ($File.path -match '^(?:artifacts/game-packages|secrets|assets|data)(?:/|$)' -or
      ($File.path -match '^artifacts/author-toolkit/' -and ($Entry.origin -ne 'isolated-test' -or
        $Entry.path -notmatch '^artifacts/author-toolkit/v\d+\.\d+\.\d+/macro-[A-Za-z0-9_-]+/project-\d+/\.tablemax$')) -or
      $File.path -match '(?:^|/)(?:secrets|originals?|raw|research|references?|materials?|rules-originals|rule-sources)(?:/|$)' -or
      ($Entry.origin -ne 'isolated-test' -and $File.path -match '(?:^|/)(?:data|saves)(?:/|$)|\.(?:sqlite(?:-wal|-shm)?|db)$')) { throw ('Original material, secrets or save data is protected: ' + $File.path) }
  if ($reviewedTracked.Contains($File.path)) { throw 'Tracked source is protected.' }
  $ancestor = [string]$File.path
  while ($ancestor) {
    if ($reviewedProtected.Contains($ancestor)) { throw ('Reviewed file overlaps a protected path: ' + $ancestor) }
    $separator = $ancestor.LastIndexOf('/')
    $ancestor = if ($separator -lt 0) { '' } else { $ancestor.Substring(0,$separator) }
  }
  if ($File.bytes -lt 0 -or $File.lastWriteTimeUtcTicks -le 0 -or $File.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid reviewed file metadata.' }
  return [TableMax.ReviewedFileGuardV1]::Check($workspace, $File.path, [long]$File.bytes, [long]$File.lastWriteTimeUtcTicks, $File.sha256, $cutoff.Ticks)
}

function Get-ReviewedLinkTarget($Link) {
  if ([string]::IsNullOrWhiteSpace($Link.path) -or -not [IO.Path]::IsPathRooted($Link.target) -or
      $Link.path -match '[\\:*?]' -or @($Link.path.Split('/') | Where-Object { $_ -in @('', '.', '..', '.git') }).Count) { throw 'Invalid reviewed link record path.' }
  $absolute = [IO.Path]::GetFullPath((Join-Path $workspace $Link.path))
  if (-not $absolute.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Link record escapes workspace.' }
  $item = Get-Item -LiteralPath $absolute -Force
  $targets = @($item.Target)
  if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $targets.Count -ne 1) { throw 'Recorded link changed or disappeared.' }
  $target = [string]$targets[0]
  if ($target.StartsWith('\??\')) { $target = $target.Substring(4) }
  if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path $absolute -Parent) $target }
  $target = [IO.Path]::GetFullPath($target).TrimEnd('\')
  if (-not $target.Equals([IO.Path]::GetFullPath($Link.target).TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Recorded link target changed.' }
  return $target
}

function Assert-ReviewedBindings {
  if ((Get-FileHash -LiteralPath $reviewedManifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $reviewedManifestHash) { throw 'Reviewed manifest changed.' }
  foreach ($file in @($reviewedPlan.protectedFiles) + @($reviewedPlan.references)) {
    $path = Resolve-ReviewedPath $file.path -AnyRoot
    $item = Get-Item -LiteralPath $path -Force
    if ($item.PSIsContainer -or $file.sha256 -notmatch '^[a-f0-9]{64}$' -or
        ($file.PSObject.Properties['bytes'] -and $item.Length -ne $file.bytes) -or
        (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw 'Retained evidence or reference changed.' }
  }
  foreach ($link in $reviewedPlan.links) { Get-ReviewedLinkTarget $link | Out-Null }
  if ($reviewedHasCache) {
    $cacheRoot = Resolve-ReviewedPath '.cache/build-modules/v1' -AnyRoot
    if (@(Get-ChildItem -LiteralPath $cacheRoot -File -Filter '*.lock' -Force).Count) { throw 'Active or unresolved build cache lock is protected.' }
  }
  Assert-PreservedRelease
}

function Write-ReviewedJournal($Record, [string]$Path) {
  $Record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding utf8
}

function Invoke-ReviewedFilesRetirement {
  $selected = if ([IO.Path]::IsPathRooted($ReviewedFilesManifest)) { $ReviewedFilesManifest } else { Join-Path $workspace $ReviewedFilesManifest }
  $script:reviewedManifestPath = Assert-LocalPath $selected
  if (-not $reviewedManifestPath.StartsWith($maintenance + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Reviewed manifest must be maintenance evidence.' }
  $script:reviewedManifestHash = (Get-FileHash -LiteralPath $reviewedManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if (($ReviewedFilesManifestSha256 -and $ReviewedFilesManifestSha256 -ne $reviewedManifestHash) -or ($Apply -and -not $ReviewedFilesManifestSha256)) { throw 'Reviewed manifest must match its exact preview SHA-256.' }
  $script:reviewedPlan = Get-Content -LiteralPath $reviewedManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
  $script:reviewedArchivedMembers = @{}
  if ($reviewedPlan.version -ne 1 -or $reviewedPlan.authorization -ne 'retire-reviewed-generated-once' -or
      $reviewedPlan.id -notmatch '^[a-z0-9][a-z0-9-]{0,80}$' -or $reviewedPlan.currentVersion -ne $project.version -or
      $reviewedPlan.currentArchiveSha256 -ne $archiveHash -or -not $reviewedPlan.entries.Count -or
      -not $reviewedPlan.PSObject.Properties['protectedPrefixes'] -or -not $reviewedPlan.PSObject.Properties['protectedFiles'] -or
      -not $reviewedPlan.PSObject.Properties['links'] -or -not $reviewedPlan.PSObject.Properties['references']) { throw 'Invalid reviewed generated-file retirement manifest.' }
  $script:reviewedHasCache = @($reviewedPlan.entries | Where-Object { $_.path -like '.cache/build-modules/v1/*' }).Count -gt 0
  $script:reviewedHasBuild = @($reviewedPlan.entries | Where-Object { $_.path -like 'build/*' }).Count -gt 0
  if ($reviewedHasBuild -and
      (-not @($reviewedPlan.references | Where-Object { $_.path -eq 'build/snapshots/latest.json' }).Count -or
       -not @($reviewedPlan.references | Where-Object { $_.path -match '^build/snapshots/[a-f0-9]{64}\.json$' }).Count)) {
    throw 'Reviewed build outputs require unchanged latest and frozen snapshot references.'
  }
  $journal = Assert-LocalPath (Join-Path $maintenance ('reviewed-retirements/' + $reviewedPlan.id + '.json'))
  if (Test-Path -LiteralPath $journal) { throw 'Reviewed retirement was already consumed; a second cleanup is forbidden.' }
  $script:reviewedProtected = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($prefix in $reviewedPlan.protectedPrefixes) {
    Resolve-ReviewedPath $prefix -AnyRoot | Out-Null
    $reviewedProtected.Add([string]$prefix) | Out-Null
  }
  foreach ($retained in @($reviewedPlan.protectedFiles) + @($reviewedPlan.references)) {
    Resolve-ReviewedPath $retained.path -AnyRoot | Out-Null
    $reviewedProtected.Add([string]$retained.path) | Out-Null
  }
  foreach ($entry in $reviewedPlan.entries) {
    foreach ($file in $entry.files) {
      if ($file.PSObject.Properties['retainedCopy']) {
        Assert-ReviewedRetainedCopy $file
        $reviewedProtected.Add([string]$file.retainedCopy.path) | Out-Null
      }
    }
  }
  foreach ($preserved in $preservedFiles) {
    if (-not $preserved.path.StartsWith($workspace+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Current delivery escapes workspace.' }
    $reviewedProtected.Add($preserved.path.Substring($workspace.Length+1).Replace('\','/')) | Out-Null
  }
  $reviewedProtected.Add($reviewedManifestPath.Substring($workspace.Length+1).Replace('\','/')) | Out-Null
  foreach ($link in $reviewedPlan.links) {
    $target = Get-ReviewedLinkTarget $link
    if ($target.Equals($workspace, [StringComparison]::OrdinalIgnoreCase)) { throw 'A link targets the entire workspace; reviewed retirement is protected.' }
    if ($target.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { $reviewedProtected.Add($target.Substring($workspace.Length + 1).Replace('\','/')) | Out-Null }
  }
  $trackedOutput = & git --no-optional-locks -C $workspace -c core.quotePath=false ls-files
  if ($LASTEXITCODE -ne 0) { throw 'Cannot verify tracked source protection.' }
  $script:reviewedTracked = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($tracked in $trackedOutput) { $reviewedTracked.Add([string]$tracked) | Out-Null }
  Assert-ReviewedBindings
  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $roots = New-Object 'System.Collections.Generic.List[string]'
  $bytes = [long]0
  $count = 0
  foreach ($entry in $reviewedPlan.entries) {
    if ([string]::IsNullOrWhiteSpace($entry.reason) -or $entry.origin -notin @('generated-copy','isolated-test','retired-cache') -or -not $entry.files.Count) { throw 'Every reviewed root needs generated origin, reason and exact files.' }
    Resolve-ReviewedPath $entry.path | Out-Null
    foreach ($root in $roots) { if ((Test-ReviewedPrefix $root $entry.path) -or (Test-ReviewedPrefix $entry.path $root)) { throw 'Reviewed roots overlap.' } }
    $roots.Add($entry.path)
    if ($entry.path.StartsWith('.cache/build-modules/', [StringComparison]::OrdinalIgnoreCase) -and ($entry.origin -ne 'retired-cache' -or -not $reviewedPlan.references.Count)) { throw 'Retired module cache requires frozen retention references.' }
    if ($entry.path.StartsWith('build/', [StringComparison]::OrdinalIgnoreCase) -and $entry.origin -ne 'generated-copy') { throw 'Only generated build outputs may be retired.' }
    foreach ($file in $entry.files) {
      if (-not $seen.Add($file.path)) { throw 'Duplicate reviewed file.' }
      Assert-ReviewedAllowed $file $entry | Out-Null
      $bytes += [long]$file.bytes
      $count++
    }
  }
  Write-Host ('Reviewed generated files: ' + $count + ' files, ' + $bytes + ' bytes. Manifest SHA-256: ' + $reviewedManifestHash)
  if (-not $Apply) { Write-Host 'PREVIEW ONLY. Apply once with -ReviewedFilesManifestSha256 and this exact hash.'; return }
  Assert-Idle
  Assert-ReviewedBindings
  $digest = [Security.Cryptography.SHA256]::Create()
  try { $lockId = [BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($workspace.ToLowerInvariant()))).Replace('-', '') }
  finally { $digest.Dispose() }
  $mutex = New-Object Threading.Mutex($false, ('Local\TableMax-Cleanup-' + $lockId))
  $held = $false
  try {
    try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { throw 'Another cleanup is already using this workspace.' }
    Assert-Idle
    Assert-ReviewedBindings
    if (Test-Path -LiteralPath $journal) { throw 'Reviewed retirement already consumed.' }
    New-Item -ItemType Directory -Path (Split-Path $journal -Parent) -Force | Out-Null
    # CreateNew consumes the ID before any deletion, including journal write failure.
    $stream = [IO.File]::Open($journal, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    $stream.Dispose()
    $record = [PSCustomObject]@{id=$reviewedPlan.id;startedAt=[DateTime]::UtcNow.ToString('o');manifest=$reviewedManifestPath;manifestSha256=$reviewedManifestHash;currentArchiveSha256=$archiveHash;result='started';selectedBytes=$bytes;selectedFiles=$count;deletedBytes=[long]0;deletedFiles=0;deleted=@();recoveryArchive=$false}
    Write-ReviewedJournal $record $journal
    try {
      foreach ($entry in $reviewedPlan.entries) {
        Assert-Idle
        $parents = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
        foreach ($file in $entry.files) {
          # Bindings are shared by the entire file list. Recheck bounded batches,
          # rather than multiplying thousands of link/reference checks by roots.
          if ($record.deletedFiles % 1000 -eq 0) { Assert-Idle; Assert-ReviewedBindings }
          $path = Assert-ReviewedAllowed $file $entry
          Remove-Item -LiteralPath $path -Force
          $record.deletedBytes += [long]$file.bytes
          $record.deletedFiles++
          $parents.Add((Split-Path $path -Parent)) | Out-Null
        }
        $record.deleted += [PSCustomObject]@{path=$entry.path;files=$entry.files.Count;bytes=[long](($entry.files | Measure-Object bytes -Sum).Sum);reason=$entry.reason}
        # Traverse only listed file ancestors. Newly added or unlisted members survive.
        $rootPath = Resolve-ReviewedPath $entry.path
        foreach ($parent in @($parents | Sort-Object Length -Descending)) {
          $directory = $parent
          while ($directory -and (Test-Path -LiteralPath $directory -PathType Container) -and
              ($directory -eq $rootPath -or $directory.StartsWith($rootPath + '\', [StringComparison]::OrdinalIgnoreCase))) {
            Resolve-ReviewedPath $directory.Substring($workspace.Length + 1).Replace('\','/') | Out-Null
            if (@([IO.Directory]::EnumerateFileSystemEntries($directory)).Count) { break }
            Remove-Item -LiteralPath $directory -Force
            $directory = Split-Path $directory -Parent
          }
        }
        Write-ReviewedJournal $record $journal
      }
      Assert-ReviewedBindings
      $record.result = 'passed'
    }
    catch { $record.result='failed'; $record | Add-Member -NotePropertyName error -NotePropertyValue $_.Exception.Message; throw }
    finally { $record | Add-Member -NotePropertyName finishedAt -NotePropertyValue ([DateTime]::UtcNow.ToString('o')); Write-ReviewedJournal $record $journal }
    Write-Host ('Single reviewed cleanup completed: ' + $record.deletedFiles + ' files, ' + $record.deletedBytes + ' bytes. Report: ' + $journal)
  }
  finally { if ($held) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
}
