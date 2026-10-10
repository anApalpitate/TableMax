# Lossless consolidation proof for local-cleanup-*; called only by explicit retired-generated cleanup.
function script:Assert-ConsolidatedCleanupHistory($Entry) {
  $historyRoot = Join-Path $maintenance 'cleanup-history'
  $archive = Assert-LocalPath (Join-Path $workspace $Entry.archive.path)
  if (-not $archive.StartsWith($historyRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetExtension($archive) -ne '.zip' -or $Entry.archive.sha256 -notmatch '^[a-f0-9]{64}$' -or
      (Get-FileHash -LiteralPath $archive).Hash.ToLowerInvariant() -ne $Entry.archive.sha256) { throw 'Cleanup history requires an unchanged lossless archive outside the old folders.' }
  if (-not (Get-Variable -Name consolidatedArchiveMembers -Scope Script -ErrorAction SilentlyContinue)) {
    $script:consolidatedArchiveMembers = @{}
  }
  $archiveKey = $archive + '|' + $Entry.archive.sha256
  if (-not $consolidatedArchiveMembers.ContainsKey($archiveKey)) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $members = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
      foreach ($member in $zip.Entries) {
        if ($member.FullName.EndsWith('/')) { continue }
        if ($member.FullName -match '\\|(^|/)\.\.?(?:/|$)|:' -or $members.ContainsKey($member.FullName)) { throw 'Invalid or duplicate cleanup archive member.' }
        $stream = $member.Open()
        $digest = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($digest.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
        finally { $digest.Dispose(); $stream.Dispose() }
        $members.Add($member.FullName, [PSCustomObject]@{ bytes = $member.Length; sha256 = $hash })
      }
    }
    finally { $zip.Dispose() }
    $script:consolidatedArchiveMembers[$archiveKey] = $members
  }
  $members = $consolidatedArchiveMembers[$archiveKey]
  foreach ($file in $Entry.files) {
    if (-not $members.ContainsKey($file.path) -or $members[$file.path].bytes -ne $file.bytes -or $members[$file.path].sha256 -ne $file.sha256) {
      throw ('Cleanup archive does not retain exact original bytes: ' + $file.path)
    }
    if ($file.retainedPath) {
      $target = Assert-LocalPath (Join-Path $workspace $file.retainedPath)
      if (-not $target.StartsWith($historyRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or
          (Get-Item -LiteralPath $target).Length -ne $file.bytes -or (Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $file.sha256) { throw 'Retained readable cleanup record changed or escapes cleanup-history.' }
    }
  }
  $recordName = if ($Entry.path.EndsWith('-tools')) { 'tool-tests.json' } else { 'cleanup.json' }
  $record = @($Entry.files | Where-Object { $_.path -eq ($Entry.path + '/' + $recordName) })
  if ($record.Count -ne 1 -or -not $record[0].retainedPath) { throw 'A readable original cleanup record must remain after consolidation.' }
}
