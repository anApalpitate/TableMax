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
  if ($Entry.kind -eq 'consolidated-cleanup-history') { Assert-ConsolidatedCleanupHistory $Entry }
}

function Initialize-RetiredGenerated {
  $script:retiredManifestPath = Assert-LocalPath (Join-Path $workspace $RetiredGeneratedManifest)
  if (-not $retiredManifestPath.StartsWith($maintenance + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Retirement manifest must be inside maintenance evidence.' }
  $script:retiredManifestSha256 = (Get-FileHash -LiteralPath $retiredManifestPath).Hash
  $plan = Get-Content -LiteralPath $retiredManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($plan.version -ne 1 -or -not $plan.entries.Count -or $plan.currentArchiveSha256 -ne $archiveHash) { throw 'Retirement plan must identify the current verified ZIP and a nonempty selection.' }
  $paths = New-Object 'System.Collections.Generic.List[string]'
  $script:cleanupHistoryConsolidation = $false
  foreach ($entry in $plan.entries) {
    if ($entry.path -notmatch '^(?:artifacts/maintenance/v\d+\.\d+\.\d+/[A-Za-z0-9][A-Za-z0-9_./-]+|artifacts/maintenance/local-cleanup-(?:\d{8}-\d{6}-\d{3}-(?:releases|intermediates|maintenance)|tools)|\.cache/electron(?:-builder)?)$' -or
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
      'consolidated-cleanup-history' {
        if ($entry.path -notmatch '^artifacts/maintenance/local-cleanup-(?:\d{8}-\d{6}-\d{3}-(?:releases|intermediates|maintenance)|tools)$' -or
            -not (Test-Path -LiteralPath (Join-Path $absolute $(if ($entry.path.EndsWith('-tools')) { 'tool-tests.json' } else { 'cleanup.json' })))) { throw 'Only completed local cleanup records and their fully preserved payload may be consolidated.' }
        . (Join-Path $PSScriptRoot 'cleanup-history.ps1')
        Assert-ConsolidatedCleanupHistory $entry
        $script:cleanupHistoryConsolidation = $true
      }
      'obsolete-tool-cache' {
        if ($entry.path -notmatch '^\.cache/electron(?:-builder)?$' -or
            (Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw) -match '"(?:electron|electron-builder)"\s*:') { throw 'Only unused historical Electron tool caches may be retired.' }
      }
      'runtime-copy' {
        $retiredSizeCheck = $entry.path -match '/retained-(?:release-staging|package-stage)/package-\d+\.\d+\.\d+-[A-Za-z0-9]{6}/size-verification$'
        if (($entry.path -notmatch '/(?:extracted|win-unpacked|TableMax-\d+\.\d+\.\d+-win-x64)$' -and -not $retiredSizeCheck) -or
            -not (Test-Path -LiteralPath (Join-Path $absolute 'TableMax.exe')) -or -not (Test-Path -LiteralPath (Join-Path $absolute 'node.exe')) -or
            @($entry.files | Where-Object { $_.path -match '\.(?:sqlite|sqlite-wal|sqlite-shm|db|md|tsx?|ps1)$' }).Count) { throw 'Runtime copies must contain the program and no saves or source files.' }
      }
      'browser-profile' {
        if ($entry.path -notmatch '/(?:desktop|webview2|EBWebView)$' -or -not (Test-Path -LiteralPath $absolute -PathType Container) -or
            -not ((Test-Path -LiteralPath (Join-Path $absolute 'EBWebView')) -or (Test-Path -LiteralPath (Join-Path $absolute 'webview2/EBWebView')) -or (Test-Path -LiteralPath (Join-Path $absolute 'Local State'))) -or
            @($entry.files | Where-Object { $_.path -match '/(?:room|foundation)\.sqlite(?:-wal|-shm)?$' }).Count) { throw 'Browser profiles require Chromium markers and must not contain platform saves.' }
      }
      'retired-package' {
        if ($entry.path -notmatch '/(?:TableMax-\d+\.\d+\.\d+-(?:win-x64|source)|previous-delivery)\.zip$' -or $entry.files.Count -ne 1 -or
            $entry.files[0].sha256 -eq $archiveHash -or
            (Get-Item -LiteralPath $absolute).PSIsContainer) { throw 'Retired packages must be individual historical archives.' }
      }
      'isolated-test-database' {
        $fixtureDir = $entry.path -replace '/room\.sqlite$',''
        $singleDatabase = $entry.path.EndsWith('/room.sqlite')
        if ($fixtureDir -notmatch '^artifacts/maintenance/v\d+\.\d+\.\d+/pokemon-expansion-verification/integration/run-\d+-[a-f0-9]{8}/worker-mixed$' -or
            (Get-Item -LiteralPath $absolute).PSIsContainer -eq $singleDatabase -or
            ($singleDatabase -and $entry.files.Count -ne 1) -or
            @($entry.files | Where-Object { $_.path -notmatch ('^'+[regex]::Escape($fixtureDir)+'/room\.sqlite(?:-wal|-shm)?$') }).Count -or
            -not @($entry.files | Where-Object { $_.path -eq ($fixtureDir+'/room.sqlite') }).Count) { throw 'Only explicitly audited mixed-worker fixture databases may be retired.' }
        if ($singleDatabase) {
          foreach ($suffix in @('-wal','-shm')) {
            $sidecarRelative=$entry.path+$suffix
            if ((Test-Path -LiteralPath ($absolute+$suffix)) -and -not @($entry.evidence | Where-Object { $_.path -eq $sidecarRelative }).Count) { throw 'A separately retained SQLite sidecar must be hash-bound evidence.' }
          }
        }
        $auditPath = Assert-LocalPath (Join-Path $workspace $entry.audit.path)
        if (-not @($entry.evidence | Where-Object { $_.path -eq $entry.audit.path -and $_.sha256 -eq $entry.audit.sha256 }).Count) { throw 'Test database audit must be retained and hash-bound.' }
        $audit = Get-Content -LiteralPath $auditPath -Raw -Encoding utf8 | ConvertFrom-Json
        $resultRelative = $fixtureDir -replace '/worker-mixed$','/results.json'
        $database = @($entry.files | Where-Object { $_.path -eq ($fixtureDir+'/room.sqlite') })[0]
        if ($audit.databasePath -ne $database.path -or $audit.origin -ne 'expansion-integration.test.ts Repository(worker-mixed)' -or
            $audit.databaseSha256 -ne $database.sha256 -or $audit.userVersion -notin @(1,2) -or $audit.journalRows -lt 1 -or
            -not @($entry.evidence | Where-Object { $_.path -eq $resultRelative }).Count) { throw 'Fixture origin, database summary and retained integration result are required.' }
      }
      default { throw 'Only audited generated copies, isolated fixture databases, retired packages and verified cleanup history can be selected.' }
    }
    Assert-RetiredGenerated $entry
    $countBefore = $candidates.Count
    Add-Candidate $absolute ('Audited retired generated content: ' + $entry.reason)
    if ($candidates.Count -gt $countBefore) { $candidates[$candidates.Count - 1] | Add-Member -NotePropertyName retiredGenerated -NotePropertyValue $entry }
  }
}
