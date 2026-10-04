# Dot-sourced by cleanup-local.ps1 only in an explicitly authorized manual mode.
function Assert-RetiredGenerated($Entry) {
  if ((Get-FileHash -LiteralPath $retiredManifestPath).Hash -ne $retiredManifestSha256) { throw 'Retirement manifest changed.' }
  $absolute = Assert-LocalPath (Join-Path $workspace $Entry.path)
  $actual = @(Read-Tree $absolute | Where-Object { -not $_.PSIsContainer })
  if ($actual.Count -ne $Entry.files.Count) { throw ('Retired content file count changed: ' + $Entry.path) }
  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in $Entry.files) {
    if (-not ($file.path -is [string]) -or $file.path -match '\\|(^|/)\.\.?(?:/|$)|:' -or
        -not $seen.Add($file.path) -or $file.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid retired file inventory.' }
    $target = Assert-LocalPath (Join-Path $workspace $file.path)
    if ($target -ne $absolute -and -not $target.StartsWith($absolute + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Retired file escapes its selected entry.' }
    $item = Get-Item -LiteralPath $target -Force
    if ($item.PSIsContainer -or $item.Length -ne $file.bytes -or (Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $file.sha256) { throw ('Retired content hash changed: ' + $file.path) }
  }
  foreach ($evidence in $Entry.evidence) {
    $target = Assert-LocalPath (Join-Path $workspace $evidence.path)
    if ($target -eq $absolute -or $target.StartsWith($absolute + '\', [StringComparison]::OrdinalIgnoreCase) -or
        $evidence.sha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $evidence.sha256) {
      throw 'Retirement evidence must be retained unchanged outside the deletion entry.'
    }
  }
}

function Initialize-RetiredGenerated {
  $script:retiredManifestPath = Assert-LocalPath (Join-Path $workspace $RetiredGeneratedManifest)
  if (-not $retiredManifestPath.StartsWith($maintenance + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Retirement manifest must be inside maintenance evidence.' }
  $script:retiredManifestSha256 = (Get-FileHash -LiteralPath $retiredManifestPath).Hash
  $plan = Get-Content -LiteralPath $retiredManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($plan.version -ne 1 -or -not $plan.entries.Count -or $plan.currentArchiveSha256 -ne $archiveHash) { throw 'Retirement plan must identify the current verified ZIP and a nonempty selection.' }
  $paths = New-Object 'System.Collections.Generic.List[string]'
  foreach ($entry in $plan.entries) {
    if ($entry.path -notmatch '^(?:artifacts/maintenance/v\d+\.\d+\.\d+/[A-Za-z0-9][A-Za-z0-9_./-]+|\.cache/electron(?:-builder)?)$' -or
        $entry.path -match '(^|/)\.\.?(?:/|$)' -or -not $entry.files.Count -or -not $entry.evidence.Count -or
        [string]::IsNullOrWhiteSpace($entry.reason)) { throw 'Invalid retirement path, inventory, reason or retained evidence.' }
    foreach ($other in $paths) {
      if ($entry.path.Equals($other, [StringComparison]::OrdinalIgnoreCase) -or $entry.path.StartsWith($other + '/', [StringComparison]::OrdinalIgnoreCase) -or $other.StartsWith($entry.path + '/', [StringComparison]::OrdinalIgnoreCase)) { throw 'Overlapping retirement entries.' }
    }
    $paths.Add($entry.path)
    $absolute = Assert-LocalPath (Join-Path $workspace $entry.path)
    foreach ($evidence in $entry.evidence) {
      $retained = Assert-LocalPath (Join-Path $workspace $evidence.path)
      foreach ($selected in $plan.entries) {
        $selectedPath = Assert-LocalPath (Join-Path $workspace $selected.path)
        if ($retained -eq $selectedPath -or $retained.StartsWith($selectedPath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Retained evidence cannot be inside any retirement selection.' }
      }
    }
    # Reuse the shared link/nested-repository checks, including ancestors.
    $cursor = $absolute
    while ($cursor -and $cursor -ne $workspace) {
      if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { throw 'Retirement refuses nested Git repositories.' }
      $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
    switch ($entry.kind) {
      'obsolete-tool-cache' {
        if ($entry.path -notmatch '^\.cache/electron(?:-builder)?$' -or
            (Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw) -match '"(?:electron|electron-builder)"\s*:') { throw 'Only unused historical Electron tool caches may be retired.' }
      }
      'runtime-copy' {
        if ($entry.path -notmatch '/(?:extracted|win-unpacked|TableMax-\d+\.\d+\.\d+-win-x64)$' -or
            -not (Test-Path -LiteralPath (Join-Path $absolute 'TableMax.exe')) -or -not (Test-Path -LiteralPath (Join-Path $absolute 'node.exe')) -or
            @($entry.files | Where-Object { $_.path -match '\.(?:sqlite|sqlite-wal|sqlite-shm|db|md|tsx?|ps1)$' }).Count) { throw 'Runtime copies must contain the program and no saves or source files.' }
      }
      'browser-profile' {
        if ($entry.path -notmatch '/(?:desktop|webview2|EBWebView)$' -or -not (Test-Path -LiteralPath $absolute -PathType Container) -or
            -not ((Test-Path -LiteralPath (Join-Path $absolute 'EBWebView')) -or (Test-Path -LiteralPath (Join-Path $absolute 'webview2/EBWebView')) -or (Test-Path -LiteralPath (Join-Path $absolute 'Local State'))) -or
            @($entry.files | Where-Object { $_.path -match '/(?:room|foundation)\.sqlite(?:-wal|-shm)?$' }).Count) { throw 'Browser profiles require Chromium markers and must not contain platform saves.' }
      }
      'retired-package' {
        if ($entry.path -notmatch '/TableMax-\d+\.\d+\.\d+-(?:win-x64|source)\.zip$' -or $entry.files.Count -ne 1 -or
            (Get-Item -LiteralPath $absolute).PSIsContainer) { throw 'Retired packages must be individual historical archives.' }
      }
      default { throw 'Only regenerable runtime copies, browser profiles, retired packages and obsolete Electron caches can be selected.' }
    }
    Assert-RetiredGenerated $entry
    $countBefore = $candidates.Count
    Add-Candidate $absolute ('Audited retired generated content: ' + $entry.reason)
    if ($candidates.Count -gt $countBefore) { $candidates[$candidates.Count - 1] | Add-Member -NotePropertyName retiredGenerated -NotePropertyValue $entry }
  }
}
