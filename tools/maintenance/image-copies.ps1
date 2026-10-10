# Explicit reviewed files only. Never used by automatic maintenance or inferred
# from a version number. Current-version superseded candidates need this audit.
function Get-ImageAuditPath([string]$Relative) {
  if ([string]::IsNullOrWhiteSpace($Relative) -or $Relative -match '\\|:|//|/$|(^|/)\.\.?(?:/|$)' -or [IO.Path]::IsPathRooted($Relative)) { throw 'Invalid image audit path.' }
  $absolute = Assert-LocalPath (Join-Path $workspace $Relative)
  $cursor = Split-Path $absolute -Parent
  while ($cursor -ne $workspace) {
    if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { throw 'Nested repository remains protected.' }
    $cursor = Split-Path $cursor -Parent
  }
  return $absolute
}
function Assert-ImageAuditFile($File) {
  $target = Get-ImageAuditPath $File.path
  $item = Get-Item -LiteralPath $target -Force
  if ($item.PSIsContainer -or $File.sha256 -notmatch '^[a-f0-9]{64}$' -or $item.Length -ne $File.bytes -or
      (Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $File.sha256) { throw ('Image audit member changed: ' + $File.path) }
  return $target
}
function Assert-ImageCopies($Group) {
  if ((Get-FileHash -LiteralPath $imagePlanPath).Hash -ne $imagePlanHash) { throw 'Image copy manifest changed.' }
  # The retained set is shared by every group. Hash it in full when initialized,
  # once before deletion and once at completion. Between groups check frozen
  # metadata and every unique ancestor, avoiding repeated per-file parent walks.
  foreach ($parent in $imageProtectedParents) {
    if ([IO.File]::GetAttributes($parent) -band [IO.FileAttributes]::ReparsePoint -or
        ($parent.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase) -and
          ([IO.Directory]::Exists((Join-Path $parent '.git')) -or [IO.File]::Exists((Join-Path $parent '.git'))))) { throw 'Protected evidence ancestor changed.' }
  }
  foreach ($file in $imageProtected) {
    $frozen = $imageProtectedMetadata[$file.path]
    $item = [IO.FileInfo]::new($frozen.absolute)
    if (-not $item.Exists -or $item.Length -ne $file.bytes -or $item.LastWriteTimeUtc.Ticks -ne $frozen.ticks -or $item.Attributes -ne $frozen.attributes) { throw ('Protected evidence changed: ' + $file.path) }
  }
  foreach ($document in $imageDocuments) {
    if ((Get-FileHash -LiteralPath $document.path).Hash -ne $document.sha256) { throw 'Documentation changed after image reference audit.' }
  }
  foreach ($file in $Group.evidence) { Assert-ImageAuditFile $file | Out-Null }
  foreach ($file in $Group.files) {
    $target = Assert-ImageAuditFile $file
    if ((Get-Item -LiteralPath $target).LastWriteTimeUtc -gt $cutoff) { throw 'Recently modified image remains protected.' }
    if ($Group.kind -eq 'derived-asset-copies') {
      $source = @{path=$file.sourcePath; bytes=$file.bytes; sha256=$file.sha256}
      if ($file.sourcePath -notmatch '^assets/.+\.(?:png|webp|jpe?g)$') { throw 'Derived copies require a retained original product asset.' }
      Assert-ImageAuditFile $source | Out-Null
    }
  }
}
function Initialize-ImageCopies {
  $script:imagePlanPath = Get-ImageAuditPath $ImageCopiesManifest
  if (-not $imagePlanPath.StartsWith($maintenance + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Image copy audit must stay inside maintenance.' }
  $script:imagePlanHash = (Get-FileHash -LiteralPath $imagePlanPath).Hash
  $plan = Get-Content -LiteralPath $imagePlanPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($plan.schemaVersion -ne 1 -or $plan.authorization -ne 'retire-reviewed-image-copies' -or
      $plan.currentVersion -ne $project.version -or $plan.currentArchiveSha256 -ne $archiveHash -or
      -not $plan.groups.Count -or -not $plan.protectedFiles.Count) { throw 'Image copy audit requires reviewed files and the current verified ZIP.' }
  $script:imageProtected = @($plan.protectedFiles)
  $script:imageProtectedMetadata = @{}
  $script:imageProtectedParents = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $protectedPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in $imageProtected) {
    if (-not $protectedPaths.Add($file.path)) { throw 'Duplicate protected image audit member.' }
    $target = Assert-ImageAuditFile $file
    $item = Get-Item -LiteralPath $target -Force
    $script:imageProtectedMetadata[$file.path] = @{absolute=$target;ticks=$item.LastWriteTimeUtc.Ticks;attributes=$item.Attributes}
    $parent = [IO.Path]::GetDirectoryName($target)
    while ($parent) { $null = $script:imageProtectedParents.Add($parent); $parent = [IO.Path]::GetDirectoryName($parent) }
  }
  if (-not $protectedPaths.Contains('artifacts/releases/TableMax-' + $project.version + '-win-x64.zip')) { throw 'Current ZIP must be explicitly protected.' }
  $script:imageDocuments = @()
  $documentText = ''
  $documents = @((Read-Tree (Join-Path $workspace 'docs') | Where-Object { -not $_.PSIsContainer -and $_.Extension -eq '.md' })) + @(Get-Item -LiteralPath (Join-Path $workspace 'README.md'))
  foreach ($document in $documents) {
    $script:imageDocuments += [PSCustomObject]@{path=$document.FullName;sha256=(Get-FileHash -LiteralPath $document.FullName).Hash}
    $documentText += (Get-Content -LiteralPath $document.FullName -Raw -Encoding utf8).Replace('\', '/').ToLowerInvariant()
  }
  $roots = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $members = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($group in $plan.groups) {
    if (-not $group.files.Count -or -not $group.evidence.Count -or [string]::IsNullOrWhiteSpace($group.reason) -or -not $roots.Add($group.path)) { throw 'Image copy groups need unique scopes, reason and retained reports.' }
    if ($group.kind -eq 'superseded-screenshots') {
      if ($group.path -notmatch '^artifacts/uno/validation/(?:v106-portable-layout-[46]|v106-final-[46]|source-matrix-6-0[12])$' -and
          $group.path -notmatch '^artifacts/rummikub/validation/ui-preview/(?:candidate-0[1-6]|preview-0[67])$') { throw 'Current or unreviewed screenshot scope remains protected.' }
    } elseif ($group.kind -eq 'derived-asset-copies') {
      if ($group.path -notmatch '^artifacts/maintenance/v\d+\.\d+\.\d+/(?:[A-Za-z0-9_-]+/)*work-[A-Za-z0-9]{6}/bundle/assets(?:/[A-Za-z0-9_-]+)*$') { throw 'Only exact generated bundle asset scopes are allowed.' }
    } else { throw 'Unknown image copy kind.' }
    $absolute = Get-ImageAuditPath $group.path
    foreach ($evidence in $group.evidence) {
      if ($evidence.path -notmatch '^artifacts/.+\.(?:json|md|log)$') { throw 'Retained image copy reports are required.' }
      Assert-ImageAuditFile $evidence | Out-Null
    }
    foreach ($file in $group.files) {
      $target = Get-ImageAuditPath $file.path
      if (-not $target.StartsWith($absolute + '\', [StringComparison]::OrdinalIgnoreCase) -or
          $file.path -notmatch '\.(?:png|webp|jpe?g)$' -or $file.path -match '(?i)(?:^|/)[^/]*(?:failure|failed)[^/]*$' -or
          -not $members.Add($file.path) -or $protectedPaths.Contains($file.path)) { throw 'Duplicate, protected or invalid image copy member.' }
      foreach ($evidence in $group.evidence) { if ($evidence.path -eq $file.path) { throw 'Retained evidence overlaps deletion.' } }
      if ($documentText.Contains($file.path.ToLowerInvariant())) { throw 'Document-linked image remains protected.' }
    }
    Assert-ImageCopies $group
    $before = $candidates.Count
    Add-Candidate $absolute ('Reviewed image copies: ' + $group.reason)
    if ($candidates.Count -gt $before) {
      $candidate = $candidates[$candidates.Count - 1]
      $candidate.bytes = [long](($group.files | Measure-Object bytes -Sum).Sum)
      $candidate | Add-Member NoteProperty imageCopies $group
      $candidate | Add-Member NoteProperty deletionScope 'Listed image files only; reports, directories, sources and saves retained'
    }
  }
}
