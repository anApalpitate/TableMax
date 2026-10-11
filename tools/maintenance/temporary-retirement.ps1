# Explicit, single-use tmp file retirement. Never archive content or follow links.
if (-not ('TableMax.TmpRetirementGuardV1' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.IO;
namespace TableMax {
  public static class TmpRetirementGuardV1 {
    public static string Check(string root, string relative, long bytes, long ticks, long cutoff) {
      if (!relative.StartsWith("tmp/", StringComparison.Ordinal)
          || relative.IndexOfAny(new char[]{'\\', ':', '*', '?'}) >= 0) throw new IOException("Invalid tmp path.");
      foreach (var part in relative.Split('/'))
        if (part == "" || part == "." || part == ".." || part == ".git") throw new IOException("Invalid tmp path segment.");
      var path = Path.GetFullPath(Path.Combine(root, relative));
      if (!path.StartsWith(root + "\\tmp\\", StringComparison.OrdinalIgnoreCase)) throw new IOException("Path escapes tmp.");
      for (var cursor = path; cursor != null; cursor = Path.GetDirectoryName(cursor)) {
        var attributes = File.GetAttributes(cursor);
        if ((attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("Linked tmp path is protected.");
        if (String.Equals(cursor, root, StringComparison.OrdinalIgnoreCase)) break;
        if ((attributes & FileAttributes.Directory) != 0 && (Directory.Exists(Path.Combine(cursor, ".git")) || File.Exists(Path.Combine(cursor, ".git"))))
          throw new IOException("Nested repository is protected.");
      }
      var item = new FileInfo(path);
      if ((item.Attributes & FileAttributes.Directory) != 0 || item.Length != bytes || item.LastWriteTimeUtc.Ticks != ticks || item.LastWriteTimeUtc.Ticks > cutoff)
        throw new IOException("Temporary file changed or is recent: " + relative);
      return path;
    }
  }
}
'@
}
function Resolve-TmpRetirementPath([string]$Relative, [bool]$Manifest = $false) {
  $prefix = if ($Manifest) { 'artifacts/maintenance/' } else { 'tmp/' }
  if (-not $Relative.StartsWith($prefix, [StringComparison]::Ordinal) -or $Relative -match '[\\:*?]' -or
      @($Relative.Split('/') | Where-Object { $_ -in @('', '.', '..', '.git') }).Count) {
    throw ('Invalid retirement path: ' + $Relative)
  }
  $absolute = Assert-LocalPath (Join-Path $workspace $Relative)
  $cursor = Split-Path $absolute -Parent
  while ($cursor -and $cursor -ne $workspace) {
    if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { throw 'Nested repository is protected.' }
    $cursor = Split-Path $cursor -Parent
  }
  return $absolute
}

function Assert-TmpRetirementFile($File) {
  return [TableMax.TmpRetirementGuardV1]::Check($workspace, $File.path, [long]$File.bytes, [long]$File.lastWriteTimeUtcTicks, $cutoff.Ticks)
}

function Read-TmpRetirementProof {
  $manifestPath = [IO.Path]::GetFullPath($TemporaryManifest)
  Assert-LocalPath $manifestPath | Out-Null
  if (-not $manifestPath.StartsWith($maintenance + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Temporary manifest must be in maintenance.' }
  $plan = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
  $payload = Assert-LocalPath (Join-Path $workspace $plan.archivePath)
  $payloadPrefix = 'artifacts/package-payloads/v' + $project.version + '/'
  if ($plan.archivePath -ne ('artifacts/releases/TableMax-' + $project.version + '-win-x64.zip') -and
      -not $plan.archivePath.StartsWith($payloadPrefix, [StringComparison]::Ordinal)) { throw 'Temporary cleanup proof must bind a current-version delivery payload.' }
  if (-not $plan.proofPath.StartsWith('artifacts/maintenance/', [StringComparison]::Ordinal)) { throw 'Temporary delivery evidence must be in maintenance.' }
  $proofPath = Assert-LocalPath (Join-Path $workspace $plan.proofPath)
  $proof = Get-Content -LiteralPath $proofPath -Raw -Encoding utf8 | ConvertFrom-Json
  $hash = (Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $plan.archiveSha256 -or $proof.result -ne 'passed' -or
      -not (($proof.portable -eq $true -and $proof.archiveSha256 -eq $hash) -or
        ($proof.version -eq $project.version -and $proof.payloadSha256 -eq $hash -and $proof.executableSha256 -match '^[a-f0-9]{64}$'))) {
    throw 'No hash-matching actual current-version delivery proof for temporary cleanup.'
  }
  # tmp-only deletion can bind the already verified payload while a successor
  # candidate is awaiting acceptance. Preserve both; never scan either for deletion.
  $paths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $paths.Add($payload) | Out-Null
  $paths.Add($proofPath) | Out-Null
  foreach ($file in Get-ChildItem -LiteralPath $releases -File -Filter ('TableMax-' + $project.version + '-*')) { $paths.Add($file.FullName) | Out-Null }
  $pointer = Join-Path $workspace ('artifacts/package-payloads/v' + $project.version + '/current.json')
  if (Test-Path -LiteralPath $pointer) {
    Assert-LocalPath $pointer | Out-Null
    $paths.Add($pointer) | Out-Null
    $index = Get-Content -LiteralPath $pointer -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($delivery in $index.deliveries) {
      foreach ($file in @($delivery.archivePath,$delivery.manifestPath,$delivery.executable.path)) {
        $absolute = Assert-LocalPath $file
        if (-not $absolute.StartsWith($workspace+'\artifacts\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Delivery outside artifacts is protected.' }
        $paths.Add($absolute) | Out-Null
      }
    }
  }
  $files = @($paths | ForEach-Object {
    Assert-LocalPath $_ | Out-Null
    $item = Get-Item -LiteralPath $_ -Force
    [PSCustomObject]@{path=$item.FullName;bytes=$item.Length;lastWriteTimeUtcTicks=$item.LastWriteTimeUtc.Ticks;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()}
  })
  return [PSCustomObject]@{archive=$payload;archiveSha256=$hash;files=$files}
}

function Invoke-TemporaryRetirement {
  $manifestPath = [IO.Path]::GetFullPath($TemporaryManifest)
  $relativeManifest = $manifestPath.Substring($workspace.Length).TrimStart('\', '/').Replace('\', '/')
  if ((Resolve-TmpRetirementPath $relativeManifest $true) -ne $manifestPath) { throw 'Manifest escapes maintenance.' }
  $manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $plan = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($plan.version -ne 1 -or $plan.authorization -ne 'retire-reviewed-tmp-once' -or
      $plan.id -notmatch '^[a-z0-9][a-z0-9-]{0,80}$' -or $plan.currentVersion -ne $project.version -or
      $plan.archiveSha256 -ne $archiveHash -or -not $plan.entries.Count) { throw 'Invalid or unverified temporary retirement manifest.' }
  $journal = Assert-LocalPath (Join-Path $maintenance ('tmp-retirements/' + $plan.id + '.json'))
  if (Test-Path -LiteralPath $journal) { throw 'Temporary retirement was already consumed; no second cleanup is allowed.' }
  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $selections = New-Object 'System.Collections.Generic.List[object]'
  $skip = New-Object 'System.Collections.Generic.List[object]'
  foreach ($entry in $plan.entries) {
    if (-not $entry.reason -or -not $entry.files.Count) { throw 'Every temporary selection requires a reason and files.' }
    $name = [string]$entry.name
    if (-not $name -or $name -in @('.', '..', '.git') -or $name -match '[\\/:*?]') { throw 'Invalid immediate tmp child name.' }
    $top = Resolve-TmpRetirementPath ('tmp/' + $name)
    $paths = @()
    $failure = $null
    foreach ($file in $entry.files) {
      if ($file.path -ne ('tmp/' + $name) -and -not $file.path.StartsWith('tmp/' + $name + '/', [StringComparison]::Ordinal)) { throw 'Temporary file escapes selected child.' }
      if (-not $seen.Add($file.path) -or $file.bytes -lt 0 -or $file.lastWriteTimeUtcTicks -le 0) { throw 'Duplicate or invalid temporary file metadata.' }
      # Validate syntax even when the file has disappeared or was changed.
      if ($file.path -match '[\\:*?]' -or @($file.path.Split('/') | Where-Object { $_ -in @('', '.', '..', '.git') }).Count) { throw 'Invalid temporary file path.' }
      try { $paths += Assert-TmpRetirementFile $file }
      catch { $failure = $_.Exception.Message; break }
    }
    if ($failure) { $skip.Add([PSCustomObject]@{name=$name;reason=$failure}); continue }
    $selections.Add([PSCustomObject]@{name=$name;reason=$entry.reason;files=$entry.files;paths=$paths;bytes=[long](($entry.files | Measure-Object bytes -Sum).Sum)})
  }
  $bytes = [long](($selections | Measure-Object bytes -Sum).Sum)
  Write-Host ('Reviewed tmp: ' + $selections.Count + ' selections, ' + $bytes + ' bytes; ' + $skip.Count + ' skipped. No recovery archives.')
  if (-not $Apply) { return }
  Assert-Idle
  Assert-PreservedRelease
  $digest = [Security.Cryptography.SHA256]::Create()
  try { $lockId = [BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($workspace.ToLowerInvariant()))).Replace('-', '') }
  finally { $digest.Dispose() }
  $mutex = New-Object Threading.Mutex($false, ('Local\TableMax-Cleanup-' + $lockId))
  $held = $false
  try {
    try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { throw 'Another cleanup is already using this workspace.' }
    if (Test-Path -LiteralPath $journal) { throw 'Temporary retirement already consumed.' }
    if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifestHash) { throw 'Temporary manifest changed.' }
    # All applicable safety checks precede consumption. A partial failure stays consumed.
    New-Item -ItemType Directory -Path (Split-Path $journal -Parent) -Force | Out-Null
    $record = [PSCustomObject]@{id=$plan.id;startedAt=[DateTime]::UtcNow.ToString('o');manifest=$relativeManifest;manifestSha256=$manifestHash;archiveSha256=$archiveHash;preservedFiles=$preservedFiles;result='started';deletedBytes=[long]0;deletedFiles=0;deleted=@();skipped=$skip.ToArray();recoveryArchive=$false}
    function Save-TmpRetirement { $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $journal -Encoding utf8 }
    Save-TmpRetirement
    try {
      foreach ($selection in $selections) {
        Assert-Idle
        if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifestHash) { throw 'Temporary manifest changed during cleanup.' }
        foreach ($file in $selection.files) {
          $path = Assert-TmpRetirementFile $file
          Remove-Item -LiteralPath $path -Force
          $record.deletedBytes += [long]$file.bytes
          $record.deletedFiles++
        }
        $record.deleted += [PSCustomObject]@{name=$selection.name;files=$selection.files.Count;bytes=$selection.bytes;reason=$selection.reason}
        # Remove only empty normal directories below this exact tmp child.
        # Links and unlisted/new files remain. Never use recursive deletion here.
        $top = Resolve-TmpRetirementPath ('tmp/' + $selection.name)
        if (Test-Path -LiteralPath $top -PathType Container) {
          $pending = New-Object 'System.Collections.Generic.Stack[string]'
          $directories = New-Object 'System.Collections.Generic.List[string]'
          $pending.Push($top)
          while ($pending.Count) {
            $directory = $pending.Pop()
            Resolve-TmpRetirementPath $directory.Substring($workspace.Length+1).Replace('\','/') | Out-Null
            $directories.Add($directory)
            foreach ($child in [IO.Directory]::EnumerateDirectories($directory)) {
              if (([IO.File]::GetAttributes($child) -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and -not (Test-Path -LiteralPath (Join-Path $child '.git'))) { $pending.Push($child) }
            }
          }
          foreach ($directory in @($directories | Sort-Object Length -Descending)) {
            Resolve-TmpRetirementPath $directory.Substring($workspace.Length+1).Replace('\','/') | Out-Null
            if (-not @([IO.Directory]::EnumerateFileSystemEntries($directory)).Count) { Remove-Item -LiteralPath $directory -Force }
          }
        }
        Save-TmpRetirement
      }
      Assert-PreservedRelease
      $record.result = 'passed'
    }
    catch { $record.result='failed'; $record | Add-Member -NotePropertyName error -NotePropertyValue $_.Exception.Message; throw }
    finally { $record | Add-Member -NotePropertyName finishedAt -NotePropertyValue ([DateTime]::UtcNow.ToString('o')); Save-TmpRetirement }
    Write-Host ('Single tmp cleanup completed: ' + $record.deletedFiles + ' files, ' + $record.deletedBytes + ' bytes. Report: ' + $journal)
  }
  finally { if ($held) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
}
