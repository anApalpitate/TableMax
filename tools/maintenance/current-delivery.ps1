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
    $expectedExe = Join-Path $Root ('artifacts/releases/TableMax-' + $Version + '-win-x64-' + $delivery.edition + '.exe')
    if ([IO.Path]::GetFullPath($delivery.executable.path) -ne $expectedExe) { throw 'Unexpected EXE delivery path.' }
    $manifest = Get-Content -LiteralPath $delivery.manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
    $payloadHash = (Get-FileHash -LiteralPath $delivery.archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $exeHash = (Get-FileHash -LiteralPath $expectedExe -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($manifest.version -ne $Version -or $manifest.edition -ne $delivery.edition -or $manifest.archive.sha256 -ne $payloadHash -or $manifest.archive.bytes -ne (Get-Item -LiteralPath $delivery.archivePath).Length -or $delivery.executable.sha256 -ne $exeHash -or $delivery.executable.bytes -ne (Get-Item -LiteralPath $expectedExe).Length -or $delivery.executable.payloadSha256 -ne $payloadHash) { throw 'EXE or internal payload hash mismatch.' }
    $proofPath = Join-Path $Root ('artifacts/maintenance/v' + $Version + '/windows-editions/' + $index.snapshot + '/shipping-executable-checks-' + $delivery.edition + '.json')
    $cursor = $proofPath
    while ($cursor -and $cursor -ne $Root) {
      if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Delivery proof contains a link.' }
      $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
    try { $report = Get-Content -LiteralPath $proofPath -Raw -Encoding utf8 | ConvertFrom-Json } catch { throw ('No passing actual EXE evidence for ' + $delivery.edition + '; exact report missing or damaged.') }
    if ($report.result -ne 'passed' -or $report.executableSha256 -ne $exeHash -or $report.payloadSha256 -ne $payloadHash) { throw ('No passing actual EXE evidence for ' + $delivery.edition + '; exact report mismatches current bytes.') }
    $deliveryFiles += $proofPath
    $verified += [PSCustomObject]@{ delivery=$delivery; manifest=$manifest; proof=$proofPath; payloadHash=$payloadHash }
  }
  if ((Get-FileHash -LiteralPath $pointer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pointerHash) { throw 'Current delivery pointer changed during validation.' }
  return [PSCustomObject]@{files=$deliveryFiles; deliveries=$verified; pointer=$pointer; pointerHash=$pointerHash; historicalReportScans=0; durationMs=$clock.Elapsed.TotalMilliseconds}
}
