# Read only hash-bound, verified delivery metadata. No cleanup happens here.
function Get-VerifiedCurrentDeliveries([string]$Root, [string]$Version) {
  $clock = [Diagnostics.Stopwatch]::StartNew()
  $pointer = Join-Path $Root ('artifacts/package-payloads/v' + $Version + '/current.json')
  if (-not (Test-Path -LiteralPath $pointer -PathType Leaf)) { return $null }
  $pointerHash = (Get-FileHash -LiteralPath $pointer -Algorithm SHA256).Hash.ToLowerInvariant()
  $index = Get-Content -LiteralPath $pointer -Raw -Encoding utf8 | ConvertFrom-Json
  if ($index.version -ne $Version -or -not $index.deliveries.Count) { throw 'Invalid current EXE delivery index.' }
  $deliveryFiles = @($pointer)
  $verified = @()
  $seen = @{}
  if ($index.snapshot -notmatch '^[a-zA-Z0-9_-]{1,128}$') { throw 'Invalid delivery snapshot path.' }
  foreach ($delivery in $index.deliveries) {
    if ($delivery.edition -notin @('full', 'box') -or $seen.ContainsKey($delivery.edition)) { throw 'Invalid or duplicate delivery edition.' }
    $seen[$delivery.edition] = $true
    foreach ($path in @($delivery.archivePath, $delivery.manifestPath, $delivery.executable.path)) {
      $absolute = [IO.Path]::GetFullPath($path)
      if (-not $absolute.StartsWith($Root.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Delivery escapes workspace.' }
      $cursor = $absolute
      while ($cursor -and $cursor -ne $Root) {
        if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Delivery contains a link.' }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
      }
      $deliveryFiles += $absolute
    }
    $payloadPrefix = [IO.Path]::GetFullPath((Join-Path $Root ('artifacts/package-payloads/v' + $Version))).TrimEnd('\') + '\'
    if (-not $delivery.archivePath.StartsWith($payloadPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not $delivery.manifestPath.StartsWith($payloadPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Internal payload outside version directory.' }
    $editionSuffix = if ($delivery.edition -eq 'box') { '-box' } else { '' }
    $localVersion = if ($index.buildVersion) { $index.buildVersion } else { $Version }
    if ($index.buildVersion -and $index.buildVersion -notmatch ('^' + [regex]::Escape($Version) + '\.\d+$')) { throw 'Invalid local build version.' }
    $taskPathNode = Join-Path $PSScriptRoot '../../.cache/node/22.14.0/runtime/node.exe'
    $taskPathModule = Join-Path $PSScriptRoot '../release/delivery-paths.mjs'
    $taskPathResult = & $taskPathNode $taskPathModule "--root=$Root" "--version=$Version" "--build-version=$localVersion" "--edition=$($delivery.edition)" "--path=$($delivery.executable.path)"
    if ($LASTEXITCODE -ne 0) { throw 'Unexpected EXE delivery path.' }
    $expectedExe = $taskPathResult | ConvertFrom-Json
    $manifest = Get-Content -LiteralPath $delivery.manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
    $payloadHash = (Get-FileHash -LiteralPath $delivery.archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $exeHash = (Get-FileHash -LiteralPath $expectedExe -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($manifest.version -ne $Version -or $manifest.buildVersion -ne $index.buildVersion -or $manifest.edition -ne $delivery.edition -or $manifest.archive.sha256 -ne $payloadHash -or $manifest.archive.bytes -ne (Get-Item -LiteralPath $delivery.archivePath).Length -or $delivery.executable.sha256 -ne $exeHash -or $delivery.executable.bytes -ne (Get-Item -LiteralPath $expectedExe).Length -or $delivery.executable.payloadSha256 -ne $payloadHash) { throw 'EXE or internal payload hash mismatch.' }
    $proofPath = Join-Path $Root ('artifacts/maintenance/v' + $Version + '/windows-editions/' + $index.snapshot + '/shipping-executable-checks-' + $delivery.edition + '.json')
    $cursor = $proofPath
    while ($cursor -and $cursor -ne $Root) {
      if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Delivery proof contains a link.' }
      $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
    try { $report = Get-Content -LiteralPath $proofPath -Raw -Encoding utf8 | ConvertFrom-Json } catch { throw ('No passing actual EXE evidence for ' + $delivery.edition + '; exact report missing or damaged.') }
    if ($report.result -ne 'passed' -or $report.executableSha256 -ne $exeHash -or $report.payloadSha256 -ne $payloadHash) { throw ('No passing actual EXE evidence for ' + $delivery.edition + '; exact report mismatches current bytes.') }
    if ($delivery.deliveryType -eq 'installer' -or $delivery.executable.type -eq 'installer') {
      $installation = $delivery.executable.installation
      $installationPath = [IO.Path]::GetFullPath($installation.manifestPath)
      if ($delivery.edition -ne 'full' -or $installation.productId -ne '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}' -or -not $installationPath.StartsWith($payloadPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid production installer identity or manifest path.' }
      for ($cursor = $installationPath; $cursor -and $cursor -ne $Root; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Installation manifest contains a link.' }
      }
      $installationHash = (Get-FileHash -LiteralPath $installationPath -Algorithm SHA256).Hash.ToLowerInvariant()
      $installationManifest = Get-Content -LiteralPath $installationPath -Raw -Encoding utf8 | ConvertFrom-Json
      $payloadManifestHash = (Get-FileHash -LiteralPath $delivery.manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($installationHash -ne $installation.manifestSha256 -or $installationManifest.productId -ne $installation.productId -or $installationManifest.buildVersion -ne $index.buildVersion -or $installationManifest.releaseVersion -ne $Version -or $installationManifest.payloadManifestSha256 -ne $payloadManifestHash) { throw 'Installation manifest hash or identity mismatch.' }
      if ($report.deliveryType -ne 'installer' -or $report.fixture -ne $false -or $report.isolatedWindows -ne $true -or $report.productId -ne $installation.productId -or $report.installationManifestSha256 -ne $installationHash -or -not $report.installationId -or $report.firstStartupBytes -le 0 -or $report.firstStartupBytes -ge 120000000) { throw 'No passing isolated production installer evidence for current bytes.' }
      $deliveryFiles += $installationPath
    }
    $deliveryFiles += $proofPath
    $verified += [PSCustomObject]@{ delivery=$delivery; manifest=$manifest; proof=$proofPath; payloadHash=$payloadHash }
  }
  if ((Get-FileHash -LiteralPath $pointer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pointerHash) { throw 'Current delivery pointer changed during validation.' }
  return [PSCustomObject]@{files=$deliveryFiles; deliveries=$verified; pointer=$pointer; pointerHash=$pointerHash; historicalReportScans=0; durationMs=$clock.Elapsed.TotalMilliseconds}
}
