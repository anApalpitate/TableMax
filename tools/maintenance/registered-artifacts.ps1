# Uses cleanup-local.ps1's ZIP proof, path/tree checks, age, idle and mutex guards.
function Assert-RegisteredArtifact($Entry) {
  if ((Get-FileHash -LiteralPath $registeredPlanPath).Hash -ne $registeredPlanHash) { throw 'Registered artifact plan changed.' }
  $absolute = Assert-LocalPath (Join-Path $workspace $Entry.path)
  $actual = @(Read-Tree $absolute | Where-Object { -not $_.PSIsContainer })
  if ($actual.Count -ne $Entry.files.Count) { throw 'Registered artifact members changed.' }
  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in $Entry.files) {
    if ($file.path -match '\\|:|(^|/)\.\.?(?:/|$)' -or -not $file.path.StartsWith($Entry.path + '/', [StringComparison]::OrdinalIgnoreCase) -or
        -not $seen.Add($file.path) -or $file.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid registered member.' }
    $target = Assert-LocalPath (Join-Path $workspace $file.path)
    $item = Get-Item -LiteralPath $target -Force
    if ($item.PSIsContainer -or $item.Length -ne $file.bytes -or (Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $file.sha256) { throw 'Registered member changed.' }
    if ($Entry.kind -eq 'process-screenshots' -and $file.path -notmatch '\.(?:png|webp)$') { throw 'Only PNG/WebP process screenshots can be retired.' }
  }
  foreach ($evidence in $Entry.evidence) {
    $target = Assert-LocalPath (Join-Path $workspace $evidence.path)
    if ($target -eq $absolute -or $target.StartsWith($absolute + '\', [StringComparison]::OrdinalIgnoreCase) -or
        $evidence.sha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $evidence.sha256) { throw 'Retained evidence changed or overlaps artifact.' }
  }
  $result = Get-Content -LiteralPath (Join-Path $workspace $Entry.evidence[0].path) -Raw -Encoding utf8 | ConvertFrom-Json
  if ($result.result -ne 'passed' -and $result.status -ne 'passed') { throw 'Artifact has no passing retained result.' }
  $registry = Get-Content -LiteralPath (Join-Path $workspace $Entry.evidence[1].path) -Raw -Encoding utf8 | ConvertFrom-Json
  if ($registry.schemaVersion -ne 1 -or $registry.passed -ne $true -or
      $registry.evidence.path -ne $Entry.evidence[0].path -or $registry.evidence.sha256 -ne $Entry.evidence[0].sha256 -or
      @($registry.entries | Where-Object { $_.path -eq $Entry.path -and $_.kind -eq $Entry.kind }).Count -ne 1) { throw 'Artifact does not match registered successful run.' }
  foreach ($document in $registeredDocuments) {
    if ((Get-FileHash -LiteralPath $document.path).Hash -ne $document.sha256) { throw 'Documentation changed after reference audit.' }
  }
}
function Initialize-RegisteredArtifacts {
  $selectedPlanPath = if ([IO.Path]::IsPathRooted($RegisteredArtifactsManifest)) { $RegisteredArtifactsManifest } else { Join-Path $workspace $RegisteredArtifactsManifest }
  $script:registeredPlanPath = Assert-LocalPath $selectedPlanPath
  if (-not $registeredPlanPath.StartsWith($maintenance + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Registered artifact plan must be maintenance evidence.' }
  $script:registeredPlanHash = (Get-FileHash -LiteralPath $registeredPlanPath).Hash
  $plan = Get-Content -LiteralPath $registeredPlanPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($plan.schemaVersion -ne 1 -or $plan.currentArchiveSha256 -ne $archiveHash -or -not $plan.entries.Count) { throw 'Invalid artifact plan or current ZIP hash.' }
  $script:registeredDocuments = @()
  $documentText = ''
  $documentFiles = @((Read-Tree (Join-Path $workspace 'docs') | Where-Object { -not $_.PSIsContainer -and $_.Extension -eq '.md' })) + @(Get-Item -LiteralPath (Join-Path $workspace 'README.md'))
  foreach ($document in $documentFiles) {
    $script:registeredDocuments += [PSCustomObject]@{path=$document.FullName;sha256=(Get-FileHash -LiteralPath $document.FullName).Hash}
    $documentText += (Get-Content -LiteralPath $document.FullName -Raw -Encoding utf8).Replace('\', '/').ToLowerInvariant()
  }
  $paths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in $plan.entries) {
    if (-not $paths.Add($entry.path) -or
        ($entry.kind -eq 'temporary-directory' -and $entry.path -notmatch '^tmp/(?:game-review|box-layout|rummikub-ui)-[A-Za-z0-9]{6}$') -or
        ($entry.kind -eq 'process-screenshots' -and $entry.path -notmatch '^artifacts/(?:maintenance/v\d+\.\d+\.\d+/(?:box-seats/|debug-20261008/box/|screenshot-storage-implementation-20261010/rummikub/)|(?:uno|avalon)/validation/|rummikub/validation/ui-preview/)[A-Za-z0-9_-]+/process$') -or
        $entry.kind -notin @('temporary-directory', 'process-screenshots') -or $entry.evidence.Count -ne 2) { throw 'Invalid registered artifact target.' }
    if ($documentText.Contains($entry.path.ToLowerInvariant())) { throw 'Document-linked artifact directory remains protected.' }
    foreach ($file in $entry.files) {
      if ($documentText.Contains($file.path.ToLowerInvariant())) { throw 'Document-linked artifact remains protected.' }
    }
    Assert-RegisteredArtifact $entry
    $before = $candidates.Count
    Add-Candidate (Join-Path $workspace $entry.path) 'Registered completed verification artifact'
    if ($candidates.Count -gt $before) { $candidates[$candidates.Count - 1] | Add-Member NoteProperty registeredArtifact $entry }
  }
}
