param([string]$EvidenceDirectory)

$ErrorActionPreference = 'Stop'
$workspaceForTest = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$fixture = Join-Path $workspaceForTest ('tmp/cleanup-test-' + [Guid]::NewGuid().ToString('N'))
$checks = New-Object 'System.Collections.Generic.List[string]'
$busyProcess = $null
$lockProcess = $null
$junction = Join-Path $fixture 'artifacts/releases/package-1.4.0-Linked/link'
$temporaryJunction = Join-Path $fixture 'tmp/review-linked/link'
$verificationRun = 'artifacts/maintenance/v1.0.2/audio-test-20261004/native-audio/portable-final'
$verificationWork = $verificationRun + '/work-AUD123'
$verificationJunction = Join-Path $fixture ($verificationWork + '/checkpoint-run/desktop/link')
$latestJunction = Join-Path $fixture 'artifacts/releases/latest-linked-copy'

function Check([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw ('FAILED: ' + $Message) }
  $checks.Add($Message)
}
function Fixture-File([string]$Relative, [string]$Content) {
  $path = Join-Path $fixture $Relative
  New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($path, $Content, (New-Object Text.UTF8Encoding($false)))
}
function Run-Cleanup([string]$Kind, [bool]$Apply, [int]$Age = 30, [bool]$Build = $false, [string[]]$Retired = @(), [string[]]$TemporaryNames = @(), [string[]]$VerificationCopies = @(), [bool]$KeepLatestOnly = $false) {
  $cleanupOptions = @{ Kind = $Kind; Apply = $Apply; MinimumAgeMinutes = $Age; IncludeBuild = $Build; RetiredVersions = $Retired; TemporaryNames = $TemporaryNames; KeepLatestOnly = $KeepLatestOnly }
  if ($PSBoundParameters.ContainsKey('VerificationCopies')) { $cleanupOptions.VerificationCopies = $VerificationCopies }
  & (Join-Path $fixture 'scripts/cleanup-local.ps1') @cleanupOptions
}

try {
  Fixture-File 'package.json' '{"name":"tablemax","version":"1.5.0"}'
  Fixture-File 'artifacts/releases/TableMax-1.5.0-win-x64.zip' 'verified-current-fixture'
  Fixture-File 'artifacts/releases/TableMax-1.4.0-win-x64.zip' 'old-fixture'
  Fixture-File 'artifacts/releases/TableMax-1.4.0-source.zip' 'old-source'
  Fixture-File 'artifacts/releases/TableMax-1.4.0-manifest.json' 'old-delivery-manifest'
  Fixture-File 'artifacts/releases/TableMax-1.4.0-win-x64-manifest.json' 'old-file-manifest'
  Fixture-File 'artifacts/releases/TableMax-1.5.0-source.zip' 'current-source'
  Fixture-File 'artifacts/releases/TableMax-1.5.0-manifest.json' 'current-manifest'
  Fixture-File 'artifacts/releases/TableMax-1.5.0-win-x64-manifest.json' 'current-file-manifest'
  Fixture-File 'artifacts/releases/TableMax-2.0.0-source.zip' 'future-source'
  Fixture-File 'artifacts/releases/TableMax-1.4.0-notes.json' 'unknown-release-content'
  Fixture-File 'artifacts/releases/TableMax-1.4.0-win-x64/TableMax.exe' 'old-extraction'
  Fixture-File 'artifacts/releases/TableMax-1.5.0-win-x64/TableMax.exe' 'same-version-old-extraction'
  Fixture-File 'artifacts/releases/package-1.4.0-ABC123/win-unpacked/TableMax.exe' 'old-stage'
  Fixture-File 'artifacts/releases/package-1.5.0-ABC123/win-unpacked/TableMax.exe' 'current-stage'
  Fixture-File 'artifacts/releases/TableMax-2.0.0-win-x64.zip' 'future-fixture'
  Fixture-File 'artifacts/releases/TableMax-1.6.0-win-x64.zip' 'retired-label-fixture'
  Fixture-File 'artifacts/releases/package-1.6.0-OLD123/win-unpacked/TableMax.exe' 'retired-label-stage'
  Fixture-File 'artifacts/releases/builder-debug.yml' 'diagnostic'
  Fixture-File 'tmp/display-ABC123/data/room.sqlite' 'isolated-test-data'
  Fixture-File 'tmp/experience-EXP123/data/room.sqlite' 'isolated-experience-data'
  Fixture-File 'tmp/runtime-memory-MEM123/save.json' 'isolated-memory-fixture'
  Fixture-File 'tmp/modern-art-verify-ART123/data/room.sqlite' 'isolated-modern-art-data'
  Fixture-File 'tmp/modern-art-polish-POL123/data/room.sqlite' 'isolated-modern-art-polish-data'
  Fixture-File 'tmp/modern-art-audio-verify-AUD123/data/room.sqlite' 'isolated-modern-art-audio-data'
  Fixture-File 'tmp/countdown-crosslayer-CLK123/data/room.sqlite' 'isolated-countdown-data'
  Fixture-File 'tmp/modern-art-polish-reference/notes.md' 'unknown-polish-reference'
  Fixture-File 'tmp/modern-art-verify-research/notes.md' 'unknown-modern-art-research'
  Fixture-File 'tmp/app-icon-verify-ICO123/icons.png' 'isolated-icon-verification'
  Fixture-File 'tmp/tablemax-sqlite-migration-SQL123/data/room.sqlite' 'isolated-migration-verification'
  Fixture-File 'tmp/app-icon-verify-reference/notes.md' 'unrecognized-icon-research'
  Fixture-File 'tmp/tablemax-sqlite-migration-reference/notes.md' 'unrecognized-migration-research'
  Fixture-File 'tmp/game-ui-Young1/data/room.sqlite' 'young-isolated-test-data'
  Fixture-File 'tmp/check-display-docs.mjs' 'temporary-script-to-archive'
  Fixture-File 'tmp/preserve-me/notes.md' 'unknown-research'
  Fixture-File 'tmp/display-SEL123/data/room.sqlite' 'explicitly-selected-verification'
  Fixture-File 'tmp/display-KEP123/data/room.sqlite' 'unselected-recognized-verification'
  Fixture-File 'tmp/reviewed-content/notes.md' 'explicitly-reviewed-content'
  Fixture-File 'tmp/reviewed-content/nested/中文.txt' 'nested-reviewed-content-with-unicode'
  Fixture-File 'tmp/reviewed-notes.txt' 'explicitly-reviewed-single-file'
  Fixture-File 'tmp/review-young/notes.md' 'recent-reviewed-content'
  $screenshotNames = @('L6-1920x1080.png', 'V03-before-360.png', 'V03-step-2-mew-other-phone-targets.png', 'V03-public.png')
  foreach ($name in $screenshotNames) { Fixture-File ('tmp/pokemon-screenshots-5a6f7893/' + $name) ('preserved-screenshot-' + $name) }
  New-Item -ItemType Directory -Path (Join-Path $fixture 'tmp/reviewed-content/empty') -Force | Out-Null
  Fixture-File 'build/desktop/main.cjs' 'current-build'
  Fixture-File 'protected/marker.txt' 'protected-junction-target'
  New-Item -ItemType Directory -Path (Split-Path $junction -Parent) -Force | Out-Null
  New-Item -ItemType Junction -Path $junction -Value (Join-Path $fixture 'protected') | Out-Null
  New-Item -ItemType Directory -Path (Split-Path $temporaryJunction -Parent) -Force | Out-Null
  New-Item -ItemType Junction -Path $temporaryJunction -Value (Join-Path $fixture 'protected') | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $fixture 'scripts') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'cleanup-local.ps1') -Destination (Join-Path $fixture 'scripts/cleanup-local.ps1')
  Copy-Item -LiteralPath (Join-Path $workspaceForTest 'Clean-Intermediates.ps1') -Destination $fixture
  Copy-Item -LiteralPath (Join-Path $workspaceForTest 'Clean-Releases.ps1') -Destination $fixture
  $currentZip = Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-win-x64.zip'
  $hash = (Get-FileHash -LiteralPath $currentZip -Algorithm SHA256).Hash.ToLowerInvariant()
  Fixture-File 'artifacts/maintenance/portable/results.json' ('{"portable":true,"result":"passed","archiveSha256":"' + $hash + '","note":"中文编码"}')
  Fixture-File ($verificationRun + '/results.json') ([PSCustomObject]@{ portable = $true; result = 'passed'; archiveSha256 = $hash; work = (Join-Path $fixture $verificationWork) } | ConvertTo-Json)
  Fixture-File ($verificationRun + '/prepare-fixtures.ts') 'prepared-source-evidence'
  Fixture-File ($verificationRun + '/saved-frame.png') 'actual-screenshot-evidence'
  Fixture-File ($verificationWork + '/prepare.cjs') 'compiled-source-evidence'
  Fixture-File ($verificationWork + '/extracted/node.exe') 'regenerable-packaged-runtime'
  foreach ($checkpoint in @('bid', 'plant', 'fuel', 'build', 'run', 'end')) {
    Fixture-File ($verificationWork + '/checkpoint-' + $checkpoint + '/desktop/Default/Cache/cache.bin') 'regenerable-profile-copy'
    Fixture-File ($verificationWork + '/checkpoint-' + $checkpoint + '/room.sqlite') ('saved-command-fixture-' + $checkpoint)
    Fixture-File ($verificationWork + '/checkpoint-' + $checkpoint + '/foundation.sqlite') 'foundation-fixture'
    Fixture-File ($verificationWork + '/checkpoint-' + $checkpoint + '/logs/native.json') 'native-observation-evidence'
  }
  Fixture-File ($verificationRun + '/work-KEP123/extracted/node.exe') 'unselected-runtime-copy'
  $missingProofCopy = 'artifacts/maintenance/v1.0.2/audio-test-20261004/native-audio/missing-proof/work-MIS123/extracted'
  Fixture-File ($missingProofCopy + '/node.exe') 'unproven-runtime-copy'
  $wrongProofRun = 'artifacts/maintenance/v1.0.2/audio-test-20261004/native-audio/wrong-proof'
  $wrongProofCopy = $wrongProofRun + '/work-BAD123/extracted'
  Fixture-File ($wrongProofCopy + '/node.exe') 'wrong-proof-runtime-copy'
  Fixture-File ($wrongProofRun + '/results.json') ([PSCustomObject]@{ portable = $true; result = 'passed'; archiveSha256 = ('0' * 64); work = (Join-Path $fixture ($wrongProofRun + '/work-BAD123')) } | ConvertTo-Json)
  $singleFileCopy = 'artifacts/maintenance/v1.0.2/audio-test-20261004/native-audio/portable-final/work-FIL123/extracted'
  Fixture-File $singleFileCopy 'a-file-is-not-an-extraction-directory'
  # Age only ordinary entries: never follow the junction into its target.
  $old = [DateTime]::UtcNow.AddHours(-2)
  $pending = New-Object 'System.Collections.Generic.Stack[string]'
  $pending.Push($fixture)
  while ($pending.Count) {
    $directory = $pending.Pop()
    foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
      $entry.LastWriteTimeUtc = $old
      if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
    }
  }
  (Get-Item -LiteralPath (Join-Path $fixture 'tmp/game-ui-Young1/data/room.sqlite')).LastWriteTimeUtc = [DateTime]::UtcNow
  (Get-Item -LiteralPath (Join-Path $fixture 'tmp/review-young/notes.md')).LastWriteTimeUtc = [DateTime]::UtcNow

  $initialMaintenanceDirectories = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Directory).Count
  Run-Cleanup Releases $false
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-win-x64.zip')) 'Preview never deletes old releases'
  Check (@(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Directory).Count -eq $initialMaintenanceDirectories) 'Preview writes no cleanup evidence or workspace files'
  $busyProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('-e', 'setInterval(()=>{},1000)', $fixture) -WindowStyle Hidden -PassThru
  Start-Sleep -Milliseconds 250
  $refused = $false
  $refusalReason = $null
  try { Run-Cleanup Releases $true } catch { $refusalReason = $_.Exception.Message; $refused = $refusalReason -like '*Busy PIDs*' }
  Check $refused ('Active workspace runtime blocks Apply before deletion; refusal: ' + $refusalReason)
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-win-x64.zip')) 'Busy process refusal preserves candidates'
  $busyProcess.Kill()
  $busyProcess.WaitForExit()
  $busyProcess = $null

  Run-Cleanup Releases $true
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-win-x64.zip'))) 'Old ZIP is removed after verified current release'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-source.zip'))) 'Old source ZIP is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-manifest.json'))) 'Old delivery manifest is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-win-x64-manifest.json'))) 'Old file manifest is removed'
  Check ((Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-source.zip')) -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-manifest.json')) -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-win-x64-manifest.json'))) 'Current source and both manifests are preserved'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-2.0.0-source.zip')) 'Future source ZIP is preserved'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-notes.json')) 'Unknown historical release file is preserved'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-win-x64'))) 'Old extraction is removed'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-win-x64/TableMax.exe')) 'Default release cleanup preserves the same-version formal extraction'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.4.0-ABC123'))) 'Old package stage is removed'
  Check (Test-Path -LiteralPath $junction) 'Junction candidate is skipped'
  Check ((Get-Content -LiteralPath (Join-Path $fixture 'protected/marker.txt') -Raw) -eq 'protected-junction-target') 'Junction target is untouched'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-2.0.0-win-x64.zip')) 'Future version is preserved'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.6.0-win-x64.zip')) 'Higher retired label is preserved without explicit selection'
  Run-Cleanup Releases $false 30 $false @('1.6.0')
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.6.0-win-x64.zip')) 'Explicit retirement preview never deletes'
  $refused = $false
  try { Run-Cleanup Releases $true 30 $false @('1.5.0') } catch { $refused = $_.Exception.Message -like '*cannot be retired*' }
  Check $refused 'Explicit retirement rejects the current verified version'
  $refused = $false
  try { Run-Cleanup Maintenance $true 30 $false @('1.6.0') } catch { $refused = $_.Exception.Message -like '*only supported by manual*' }
  Check $refused 'Automatic maintenance refuses explicit retirement'
  Run-Cleanup Releases $true 30 $false @('1.6.0')
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.6.0-win-x64.zip'))) 'Explicit retirement removes an old higher version label'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.6.0-OLD123'))) 'Explicit retirement removes its regenerable packaging stage'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-2.0.0-win-x64.zip')) 'Explicit retirement preserves unrelated future releases'

  $selectedNames = @('display-SEL123', 'reviewed-content', 'reviewed-notes.txt')
  $selectedArchiveHashes = @{}
  foreach ($relative in @('reviewed-content/notes.md', 'reviewed-content/nested/中文.txt', 'reviewed-notes.txt')) {
    $selectedArchiveHashes[$relative] = (Get-FileHash -LiteralPath (Join-Path $fixture ('tmp/' + $relative)) -Algorithm SHA256).Hash
  }
  $screenshotHashes = @{}
  foreach ($name in $screenshotNames) {
    $screenshotHashes[$name] = (Get-FileHash -LiteralPath (Join-Path $fixture ('tmp/pokemon-screenshots-5a6f7893/' + $name)) -Algorithm SHA256).Hash
  }
  $cleanupLogsBefore = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Directory).Count
  Run-Cleanup -Kind Intermediates -Apply $false -TemporaryNames $selectedNames
  Check ((Test-Path -LiteralPath (Join-Path $fixture 'tmp/display-SEL123')) -and (Test-Path -LiteralPath (Join-Path $fixture 'tmp/reviewed-content')) -and (Test-Path -LiteralPath (Join-Path $fixture 'tmp/reviewed-notes.txt'))) 'Explicit temporary selection preview preserves all selected entries'
  Check (@(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Directory).Count -eq $cleanupLogsBefore) 'Explicit temporary selection preview writes no archive or cleanup evidence'
  foreach ($names in @(@(''), @('   '), @('.'), @('..'), @('reviewed-content/notes.md'), @('reviewed-content\notes.md'), @('C:reviewed-content'), @('missing-entry'), @('reviewed-content', 'REVIEWED-CONTENT'), @('reviewed-content', 'missing-entry'))) {
    $refused = $false
    try { Run-Cleanup -Kind Intermediates -Apply $true -TemporaryNames $names } catch { $refused = $true }
    Check $refused ('Explicit temporary selection rejects invalid or duplicate names: ' + ($names -join ', '))
  }
  foreach ($kind in @('Releases', 'Maintenance')) {
    $refused = $false
    try { Run-Cleanup -Kind $kind -Apply $true -TemporaryNames @('reviewed-content') } catch { $refused = $true }
    Check $refused ($kind + ' refuses explicit temporary selection')
  }
  $refused = $false
  try { Run-Cleanup -Kind Intermediates -Apply $true -Build $true -TemporaryNames @('reviewed-content') } catch { $refused = $true }
  Check $refused 'Explicit temporary selection refuses IncludeBuild'
  Check ((Test-Path -LiteralPath (Join-Path $fixture 'tmp/reviewed-content')) -and (Test-Path -LiteralPath (Join-Path $fixture 'tmp/display-SEL123')) -and (Test-Path -LiteralPath (Join-Path $fixture 'build/desktop/main.cjs')) -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.5.0-ABC123'))) 'Rejected temporary selections preserve candidates, build and release stages'
  Run-Cleanup -Kind Intermediates -Apply $true -TemporaryNames $selectedNames
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/display-SEL123'))) 'Explicit temporary selection removes a selected recognized directory'
  Check ((-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/reviewed-content'))) -and (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/reviewed-notes.txt')))) 'Explicit temporary selection removes selected reviewed directory and single file'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/display-KEP123/data/room.sqlite')) 'Explicit temporary selection preserves unselected recognized verification data'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/preserve-me/notes.md')) 'Explicit temporary selection preserves unselected unknown research'
  Check ((Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.5.0-ABC123'))) 'Explicit temporary selection never scans regenerable release stages'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/builder-debug.yml')) 'Explicit temporary selection preserves release diagnostics'
  $reviewArchives = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Directory -Filter reviewed-temporary-content -Recurse)
  Check ($reviewArchives.Count -eq 1) 'Selected unknown temporary content is archived in one reviewed-content evidence directory'
  foreach ($relative in $selectedArchiveHashes.Keys) {
    $archivedPath = Join-Path $reviewArchives[0].FullName $relative
    Check ((Test-Path -LiteralPath $archivedPath -PathType Leaf) -and (Get-FileHash -LiteralPath $archivedPath -Algorithm SHA256).Hash -eq $selectedArchiveHashes[$relative]) ('Reviewed temporary archive preserves original path and SHA256: ' + $relative)
  }
  Check (Test-Path -LiteralPath (Join-Path $reviewArchives[0].FullName 'reviewed-content/empty') -PathType Container) 'Reviewed temporary archive preserves empty directories'
  foreach ($name in $screenshotNames) {
    $screenshotPath = Join-Path $fixture ('tmp/pokemon-screenshots-5a6f7893/' + $name)
    Check ((Test-Path -LiteralPath $screenshotPath) -and (Get-FileHash -LiteralPath $screenshotPath -Algorithm SHA256).Hash -eq $screenshotHashes[$name]) ('Explicit temporary selection keeps requested screenshot byte-identical: ' + $name)
  }
  Run-Cleanup -Kind Intermediates -Apply $true -TemporaryNames @('review-young', 'review-linked')
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/review-young/notes.md')) 'Explicit temporary selection still protects recently modified content'
  Check (Test-Path -LiteralPath $temporaryJunction) 'Explicit temporary selection still refuses linked content'
  Check ((Get-Content -LiteralPath (Join-Path $fixture 'protected/marker.txt') -Raw) -eq 'protected-junction-target') 'Selected temporary link target remains untouched'

  $verificationCopies = @($verificationWork + '/extracted') + @('bid', 'plant', 'fuel', 'build', 'run', 'end' | ForEach-Object { $verificationWork + '/checkpoint-' + $_ + '/desktop' })
  $preservedEvidence = @(($verificationRun + '/results.json'), ($verificationRun + '/prepare-fixtures.ts'), ($verificationRun + '/saved-frame.png'), ($verificationWork + '/prepare.cjs'))
  foreach ($checkpoint in @('bid', 'plant', 'fuel', 'build', 'run', 'end')) {
    $preservedEvidence += @(($verificationWork + '/checkpoint-' + $checkpoint + '/room.sqlite'), ($verificationWork + '/checkpoint-' + $checkpoint + '/foundation.sqlite'), ($verificationWork + '/checkpoint-' + $checkpoint + '/logs/native.json'))
  }
  $preservedHashes = @{}
  foreach ($relative in $preservedEvidence) { $preservedHashes[$relative] = (Get-FileHash -LiteralPath (Join-Path $fixture $relative) -Algorithm SHA256).Hash }
  $previewBefore = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Recurse -Force | ForEach-Object { $_.FullName + '|' + $_.LastWriteTimeUtc.Ticks }) -join "`n"
  $defaultPreview = @(& (Join-Path $fixture 'Clean-Intermediates.ps1') 6>&1)
  Check (($defaultPreview -join "`n") -match 'Intermediates: [1-9][0-9]* candidates' -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.5.0-ABC123'))) 'Root intermediate wrapper without VerificationCopies still previews default candidates'
  & (Join-Path $fixture 'Clean-Intermediates.ps1') -VerificationCopies $verificationCopies
  $previewAfter = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Recurse -Force | ForEach-Object { $_.FullName + '|' + $_.LastWriteTimeUtc.Ticks }) -join "`n"
  Check ($previewBefore -eq $previewAfter) 'Verification copy preview writes no evidence and changes no paths or timestamps'
  Check (@($verificationCopies | Where-Object { Test-Path -LiteralPath (Join-Path $fixture $_) -PathType Container }).Count -eq 7) 'Verification copy preview preserves all seven selected directories'
  foreach ($emptySelection in @(@(), $null)) {
    $refused = $false
    try { & (Join-Path $fixture 'Clean-Intermediates.ps1') -Apply -VerificationCopies $emptySelection } catch { $refused = $_.Exception.Message -like '*nonempty list*' }
    Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.5.0-ABC123'))) 'Explicit empty or null verification selection never falls back to default scanning'
    $refused = $false
    try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies $emptySelection } catch { $refused = $_.Exception.Message -like '*nonempty list*' }
    Check $refused 'Cleanup helper and implementation reject explicitly bound empty or null verification selection'
  }
  $invalidCopies = @('', ' ', $verificationWork, ($verificationWork + '/checkpoint-bid'), ($verificationWork + '/checkpoint-bid/room.sqlite'), ($verificationWork + '/prepare.cjs'), ($verificationWork + '/extracted/node.exe'), ($verificationWork + '/checkpoint-unknown/desktop'), ($verificationWork + '/extracted/../extracted'), 'artifacts/maintenance/v1.0.2/audio-test-20261004/native-audio/portable-final/work-SHORT/extracted', 'artifacts/maintenance/v1.0.2/audio_test/native-audio/portable-final/work-AUD123/extracted', 'artifacts/maintenance/v1.0.2/audio-test-20261004/native-audio/portable-final/work-AUD123/*', (Join-Path $fixture ($verificationWork + '/extracted')), ($verificationRun + '/work-NON123/extracted'), $singleFileCopy)
  foreach ($relative in $invalidCopies) {
    $refused = $false
    try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @($relative) } catch { $refused = $true }
    Check $refused ('Verification selection rejects nonexact, protected, missing or nondirectory paths: ' + $relative)
  }
  $refused = $false
  try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @(($verificationWork + '/extracted'), ($verificationWork + '/extracted').ToUpperInvariant().Replace('/', '\')) } catch { $refused = $_.Exception.Message -like '*duplicate paths*' }
  Check $refused 'Verification selection rejects duplicate paths across slash styles and case'
  $refused = $false
  try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @(($verificationWork + '/extracted'), $verificationWork) } catch { $refused = $true }
  Check $refused 'Verification selection refuses an overlapping parent work directory'
  foreach ($kind in @('Releases', 'Maintenance')) {
    $refused = $false
    try { Run-Cleanup -Kind $kind -Apply $true -VerificationCopies @($verificationWork + '/extracted') } catch { $refused = $true }
    Check $refused ($kind + ' refuses explicit verification copies')
  }
  foreach ($combination in @('build', 'temporary', 'retired')) {
    $refused = $false
    try { Run-Cleanup -Kind Intermediates -Apply $true -Build ($combination -eq 'build') -TemporaryNames @(if ($combination -eq 'temporary') { 'preserve-me' }) -Retired @(if ($combination -eq 'retired') { '1.6.0' }) -VerificationCopies @($verificationWork + '/extracted') } catch { $refused = $true }
    Check $refused ('Verification selection refuses combined cleanup mode: ' + $combination)
  }
  foreach ($relative in @($missingProofCopy, $wrongProofCopy)) {
    $refused = $false
    try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @(($verificationWork + '/extracted'), $relative) } catch { $refused = $true }
    Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture ($verificationWork + '/extracted')))) ('Missing or wrong-hash parent proof refuses the entire selection: ' + $relative)
  }
  $refused = $false
  try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @($verificationRun + '/work-KEP123/extracted') } catch { $refused = $_.Exception.Message -like '*work directory recorded*' }
  Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture ($verificationRun + '/work-KEP123/extracted/node.exe')))) 'A sibling old or failed work directory cannot borrow the current run portable proof'
  foreach ($invalidRecord in @('{"portable":false,"result":"passed"}', '{"portable":"true","result":"passed"}', '{"portable":true,"result":"failed"}', 'not-json')) {
    Fixture-File ($wrongProofRun + '/results.json') $invalidRecord
    $refused = $false
    try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @($wrongProofCopy) } catch { $refused = $true }
    Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture $wrongProofCopy))) ('Verification selection rejects nonpassing or malformed proof: ' + $invalidRecord)
  }
  $recentCache = Join-Path $fixture ($verificationWork + '/checkpoint-end/desktop/Default/Cache/cache.bin')
  (Get-Item -LiteralPath $recentCache).LastWriteTimeUtc = [DateTime]::UtcNow
  Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @($verificationWork + '/checkpoint-end/desktop')
  Check (Test-Path -LiteralPath $recentCache) 'Verification selection preserves recently modified profile content'
  (Get-Item -LiteralPath $recentCache).LastWriteTimeUtc = $old
  New-Item -ItemType Junction -Path $verificationJunction -Value (Join-Path $fixture 'protected') | Out-Null
  $previewSucceeded = $false
  try { Run-Cleanup -Kind Intermediates -Apply $false -VerificationCopies @($verificationWork + '/extracted'); $previewSucceeded = $true } catch { }
  Check ($previewSucceeded -and (Test-Path -LiteralPath $verificationJunction)) 'Explicit verification mode never traverses an unselected sibling profile or its link'
  Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @($verificationWork + '/checkpoint-run/desktop')
  Check ((Test-Path -LiteralPath $verificationJunction) -and (Get-Content -LiteralPath (Join-Path $fixture 'protected/marker.txt') -Raw) -eq 'protected-junction-target') 'Verification selection refuses descendant links and preserves their target'
  [IO.Directory]::Delete($verificationJunction)
  (Get-Item -LiteralPath (Split-Path $verificationJunction -Parent)).LastWriteTimeUtc = $old
  $nestedMarker = $verificationWork + '/checkpoint-run/desktop/.git'
  Fixture-File $nestedMarker 'nested-repository-marker'
  $refused = $false
  try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @($verificationWork + '/checkpoint-run/desktop') } catch { $refused = $_.Exception.Message -like '*nested repositories*' }
  Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture $nestedMarker))) 'Verification selection refuses nested repositories'
  Remove-Item -LiteralPath (Join-Path $fixture $nestedMarker) -Force
  (Get-Item -LiteralPath (Join-Path $fixture ($verificationWork + '/checkpoint-run/desktop'))).LastWriteTimeUtc = $old
  $busyProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('-e', 'setInterval(()=>{},1000)', $fixture) -WindowStyle Hidden -PassThru
  Start-Sleep -Milliseconds 250
  $refused = $false
  try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies $verificationCopies } catch { $refused = $_.Exception.Message -like '*Busy PIDs*' }
  Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture ($verificationWork + '/extracted')))) 'Verification copies retain the active runtime protection'
  $busyProcess.Kill(); $busyProcess.WaitForExit(); $busyProcess = $null
  $cleanupPath = Join-Path $fixture 'scripts/cleanup-local.ps1'
  $cleanupSource = [IO.File]::ReadAllText($cleanupPath)
  $mutationHook = '$lockDigest = [Security.Cryptography.SHA256]::Create()'
  $runtimePath = Join-Path $fixture ($verificationWork + '/extracted/node.exe')
  $proofPath = Join-Path $fixture ($verificationRun + '/results.json')
  foreach ($mutation in @('candidate', 'proof')) {
    $mutatedPath = if ($mutation -eq 'candidate') { $runtimePath } else { $proofPath }
    $originalContent = [IO.File]::ReadAllText($mutatedPath)
    # Deterministic fixture-only mutation after planning, before the existing
    # mutex/deletion path; exercise real fingerprint and evidence rechecks.
    $injection = "[IO.File]::AppendAllText('" + $mutatedPath.Replace("'", "''") + "', ' ')`n" + $mutationHook
    [IO.File]::WriteAllText($cleanupPath, $cleanupSource.Replace($mutationHook, $injection), (New-Object Text.UTF8Encoding($false)))
    $refused = $false
    try { Run-Cleanup -Kind Intermediates -Apply $true -VerificationCopies @($verificationWork + '/extracted') } catch { $refused = $_.Exception.Message -like '*changed during cleanup*' }
    Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture ($verificationWork + '/extracted')))) ('Verification deletion refuses a changed planned ' + $mutation)
    [IO.File]::WriteAllText($mutatedPath, $originalContent, (New-Object Text.UTF8Encoding($false)))
    (Get-Item -LiteralPath $mutatedPath).LastWriteTimeUtc = $old
    [IO.File]::WriteAllText($cleanupPath, $cleanupSource, (New-Object Text.UTF8Encoding($false)))
  }
  & (Join-Path $fixture 'Clean-Intermediates.ps1') -Apply -VerificationCopies $verificationCopies
  Check (@($verificationCopies | Where-Object { Test-Path -LiteralPath (Join-Path $fixture $_) }).Count -eq 0) 'Exact verification selection deletes only extraction and six desktop profile copies'
  foreach ($relative in $preservedEvidence) {
    Check ((Test-Path -LiteralPath (Join-Path $fixture $relative) -PathType Leaf) -and (Get-FileHash -LiteralPath (Join-Path $fixture $relative) -Algorithm SHA256).Hash -eq $preservedHashes[$relative]) ('Verification deletion preserves byte-identical SQLite, source, JSON or screenshot evidence: ' + $relative)
  }
  Check ((Test-Path -LiteralPath (Join-Path $fixture ($verificationRun + '/work-KEP123/extracted/node.exe'))) -and (Test-Path -LiteralPath (Join-Path $fixture 'tmp/display-KEP123')) -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.5.0-ABC123')) -and (Test-Path -LiteralPath (Join-Path $fixture 'build/desktop/main.cjs'))) 'Verification selection leaves unselected copies, tmp, release stages and build intact'
  $verificationReports = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Filter cleanup.json -Recurse -File | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8 | ConvertFrom-Json } | Where-Object { $_.verificationCopies.Count -eq 7 })
  Check ($verificationReports.Count -eq 1 -and $verificationReports[0].verificationProofs.Count -eq 7 -and @($verificationReports[0].candidates | Where-Object { $_.deleted -and $_.verificationProof.archiveSha256 -eq $hash }).Count -eq 7) 'Cleanup audit records each exact selected copy and its matching parent portable proof'

  Run-Cleanup Intermediates $true
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.5.0-ABC123'))) 'Current regenerable stage is removed, current ZIP retained'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/display-ABC123'))) 'Recognized stopped verification directory is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/experience-EXP123'))) 'Recognized stopped experience verification data is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/runtime-memory-MEM123'))) 'Recognized stopped memory verification data is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/modern-art-verify-ART123'))) 'Recognized stopped Modern Art verification data is removed'
  foreach ($name in @('modern-art-polish-POL123', 'modern-art-audio-verify-AUD123', 'countdown-crosslayer-CLK123')) {
    Check (-not (Test-Path -LiteralPath (Join-Path $fixture ('tmp/' + $name)))) ('Recognized stopped presentation or countdown verification data is removed: ' + $name)
  }
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/modern-art-polish-reference/notes.md')) 'Similar presentation research directory is preserved'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/modern-art-verify-research/notes.md')) 'Similar Modern Art research directory is preserved'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/app-icon-verify-ICO123'))) 'Recognized stopped icon verification data is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/tablemax-sqlite-migration-SQL123'))) 'Recognized stopped SQLite migration verification data is removed'
  Check ((Test-Path -LiteralPath (Join-Path $fixture 'tmp/app-icon-verify-reference/notes.md')) -and (Test-Path -LiteralPath (Join-Path $fixture 'tmp/tablemax-sqlite-migration-reference/notes.md'))) 'Similar icon and migration research directories are preserved'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/game-ui-Young1')) 'Recently modified verification data is protected by default'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/preserve-me/notes.md')) 'Unknown temporary research is preserved'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'build/desktop/main.cjs')) 'Current build is retained by default'
  $archivedScripts = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Filter check-display-docs.mjs -Recurse -File)
  Check ($archivedScripts.Count -eq 1 -and (Get-Content -LiteralPath $archivedScripts[0].FullName -Raw) -eq 'temporary-script-to-archive') 'One-off script is archived before deletion'
  Run-Cleanup Intermediates $true 0 $true
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'build'))) 'Build is removed only with explicit IncludeBuild'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/game-ui-Young1'))) 'Explicit zero age removes stopped young verification data'
  Check ((Get-FileHash -LiteralPath $currentZip -Algorithm SHA256).Hash.ToLowerInvariant() -eq $hash) 'Current verified ZIP stays byte-identical through all cleanup modes'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-win-x64/TableMax.exe')) 'Default intermediate cleanup also preserves the same-version formal extraction'

  $manifestPath = Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-win-x64-manifest.json'
  $validManifest = [PSCustomObject]@{ version = '1.5.0'; archive = [PSCustomObject]@{ name = 'TableMax-1.5.0-win-x64.zip'; bytes = (Get-Item -LiteralPath $currentZip).Length; sha256 = $hash } } | ConvertTo-Json -Depth 4
  $latestPreviewBefore = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Recurse -Force | ForEach-Object { $_.FullName + '|' + $_.LastWriteTimeUtc.Ticks }) -join "`n"
  foreach ($invalidManifest in @('not-json', '{"version":"1.5.0"}', $validManifest.Replace('TableMax-1.5.0-win-x64.zip', 'TableMax-1.4.0-win-x64.zip'), $validManifest.Replace($hash, ('0' * 64)))) {
    [IO.File]::WriteAllText($manifestPath, $invalidManifest, (New-Object Text.UTF8Encoding($false)))
    $refused = $false
    try { Run-Cleanup -Kind Releases -Apply $true -KeepLatestOnly $true } catch { $refused = $true }
    Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-source.zip'))) 'KeepLatestOnly rejects malformed or mismatched current manifest before any deletion'
  }
  foreach ($field in @('bytes', 'version')) {
    $invalidManifest = $validManifest | ConvertFrom-Json
    if ($field -eq 'bytes') { $invalidManifest.archive.bytes++ } else { $invalidManifest.version = '1.4.0' }
    [IO.File]::WriteAllText($manifestPath, ($invalidManifest | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
    $refused = $false
    try { Run-Cleanup -Kind Releases -Apply $true -KeepLatestOnly $true } catch { $refused = $_.Exception.Message -like '*manifest does not match*' }
    Check $refused ('KeepLatestOnly rejects mismatched manifest ' + $field)
  }
  Remove-Item -LiteralPath $manifestPath -Force
  $refused = $false
  try { Run-Cleanup -Kind Releases -Apply $true -KeepLatestOnly $true } catch { $refused = $_.Exception.Message -like '*manifest is missing*' }
  Check $refused 'KeepLatestOnly requires the current runtime manifest'
  [IO.File]::WriteAllText($manifestPath, $validManifest, (New-Object Text.UTF8Encoding($false)))
  (Get-Item -LiteralPath $manifestPath).LastWriteTimeUtc = $old
  foreach ($kind in @('Intermediates', 'Maintenance')) {
    $refused = $false
    try { Run-Cleanup -Kind $kind -Apply $true -KeepLatestOnly $true } catch { $refused = $_.Exception.Message -like '*KeepLatestOnly is only supported*' }
    Check $refused ($kind + ' refuses KeepLatestOnly')
  }
  foreach ($combination in @('build', 'retired', 'temporary', 'verification')) {
    $options = @{ Kind = 'Releases'; Apply = $true; KeepLatestOnly = $true }
    switch ($combination) {
      'build' { $options.Build = $true }
      'retired' { $options.Retired = @('1.6.0') }
      'temporary' { $options.TemporaryNames = @('preserve-me') }
      'verification' { $options.VerificationCopies = @($missingProofCopy) }
    }
    $refused = $false
    try { Run-Cleanup @options } catch { $refused = $_.Exception.Message -like '*KeepLatestOnly is only supported*' }
    Check $refused ('KeepLatestOnly refuses combined cleanup mode: ' + $combination)
  }
  $refused = $false
  try { & (Join-Path $fixture 'Clean-Releases.ps1') -Apply -KeepLatestOnly -RetiredVersions @('1.6.0') } catch { $refused = $_.Exception.Message -like '*KeepLatestOnly is only supported*' }
  Check $refused 'The root release wrapper forwards KeepLatestOnly and rejects retirement combinations'
  $latestPreviewAfter = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Recurse -Force | ForEach-Object { $_.FullName + '|' + $_.LastWriteTimeUtc.Ticks }) -join "`n"
  Check ($latestPreviewBefore -eq $latestPreviewAfter) 'Rejected KeepLatestOnly modes write no cleanup evidence'

  Fixture-File 'artifacts/releases/package-1.0.0-PKG123/win-unpacked/TableMax.exe' 'historical-packaging-stage'
  Fixture-File 'artifacts/releases/package-1.5.0-NEW123/win-unpacked/TableMax.exe' 'same-version-packaging-stage'
  Fixture-File 'artifacts/releases/builder-debug.yml' 'old-builder-diagnostic'
  Fixture-File 'artifacts/releases/release-diagnostics/output.log' 'unknown-release-diagnostic'
  Fixture-File 'artifacts/releases/nested-release/.git' 'nested-repository-marker'
  Fixture-File 'artifacts/releases/nested-release/keep.txt' 'nested-repository-content'
  foreach ($relative in @('package-1.0.0-PKG123', 'package-1.5.0-NEW123', 'builder-debug.yml', 'release-diagnostics', 'nested-release')) {
    $path = Join-Path $fixture ('artifacts/releases/' + $relative)
    @(Get-ChildItem -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue) + @(Get-Item -LiteralPath $path) | ForEach-Object { $_.LastWriteTimeUtc = $old }
  }
  Fixture-File 'artifacts/releases/recent-release.tmp' 'recent-release-content'
  New-Item -ItemType Junction -Path $latestJunction -Value (Join-Path $fixture 'protected') | Out-Null
  $latestPreviewBefore = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Recurse -Force | ForEach-Object { $_.FullName + '|' + $_.LastWriteTimeUtc.Ticks }) -join "`n"
  $latestPreview = @(& (Join-Path $fixture 'Clean-Releases.ps1') -KeepLatestOnly 6>&1)
  $latestPreviewAfter = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Recurse -Force | ForEach-Object { $_.FullName + '|' + $_.LastWriteTimeUtc.Ticks }) -join "`n"
  Check ($latestPreviewBefore -eq $latestPreviewAfter) 'KeepLatestOnly preview writes no logs, directories or timestamps'
  Check (($latestPreview -join "`n") -match 'Preserving matching release manifest' -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-source.zip')) -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-win-x64'))) 'KeepLatestOnly preview lists both preserved files and keeps selected source and same-version extraction'

  $busyProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('-e', 'setInterval(()=>{},1000)', $fixture) -WindowStyle Hidden -PassThru
  Start-Sleep -Milliseconds 250
  $refused = $false
  try { Run-Cleanup -Kind Releases -Apply $true -KeepLatestOnly $true } catch { $refused = $_.Exception.Message -like '*Busy PIDs*' }
  Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-win-x64'))) 'KeepLatestOnly protects all candidates while a workspace process is active'
  $busyProcess.Kill(); $busyProcess.WaitForExit(); $busyProcess = $null

  $lockDigest = [Security.Cryptography.SHA256]::Create()
  try { $lockId = [BitConverter]::ToString($lockDigest.ComputeHash([Text.Encoding]::UTF8.GetBytes($fixture.ToLowerInvariant()))).Replace('-', '') }
  finally { $lockDigest.Dispose() }
  $lockMarker = Join-Path $fixture 'latest-lock-held'
  $lockCommand = '$m = New-Object Threading.Mutex($false, ''Local\TableMax-Cleanup-' + $lockId + '''); $null = $m.WaitOne(); [IO.File]::WriteAllText(''' + $lockMarker.Replace("'", "''") + ''', ''held''); Start-Sleep -Seconds 60'
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($lockCommand))
  $lockProcess = Start-Process -FilePath (Get-Command powershell.exe).Source -ArgumentList @('-NoProfile', '-EncodedCommand', $encoded) -WindowStyle Hidden -PassThru
  for ($attempt = 0; $attempt -lt 40 -and -not (Test-Path -LiteralPath $lockMarker); $attempt++) { Start-Sleep -Milliseconds 100 }
  Check (Test-Path -LiteralPath $lockMarker) 'The KeepLatestOnly concurrency fixture holds the existing cleanup mutex'
  $refused = $false
  try { Run-Cleanup -Kind Releases -Apply $true -KeepLatestOnly $true } catch { $refused = $_.Exception.Message -like '*Another cleanup*' }
  Check ($refused -and (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-source.zip'))) 'KeepLatestOnly refuses concurrent cleanup before deletion'
  $lockProcess.Kill(); $lockProcess.WaitForExit(); $lockProcess = $null

  $cleanupSource = [IO.File]::ReadAllText($cleanupPath)
  $latestCandidate = Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-source.zip'
  # Make the changed candidate first in the real oldest-first ordering so these
  # refusal tests retain all stages and diagnostics for the successful cleanup.
  (Get-Item -LiteralPath $latestCandidate).LastWriteTimeUtc = $old.AddHours(-1)
  foreach ($mutation in @('manifest-size', 'manifest-time', 'manifest-hash', 'manifest-plan-race', 'archive-hash', 'candidate')) {
    $mutatedPath = if ($mutation -like 'manifest-*') { $manifestPath } elseif ($mutation -eq 'archive-hash') { $currentZip } else { $latestCandidate }
    $originalContent = [IO.File]::ReadAllText($mutatedPath)
    $originalTime = (Get-Item -LiteralPath $mutatedPath).LastWriteTimeUtc
    $escapedPath = $mutatedPath.Replace("'", "''")
    if ($mutation -eq 'manifest-time') {
      $mutationCode = "[IO.File]::SetLastWriteTimeUtc('" + $escapedPath + "', [DateTime]::FromBinary(" + $originalTime.AddMinutes(-1).ToBinary() + "))"
    }
    elseif ($mutation -in @('manifest-hash', 'manifest-plan-race', 'archive-hash')) {
      $changedContent = 'x' + $originalContent.Substring(1)
      $mutationCode = "[IO.File]::WriteAllText('" + $escapedPath + "', '" + $changedContent.Replace("'", "''") + "', (New-Object Text.UTF8Encoding(`$false))); [IO.File]::SetLastWriteTimeUtc('" + $escapedPath + "', [DateTime]::FromBinary(" + $originalTime.ToBinary() + "))"
    }
    else { $mutationCode = "[IO.File]::AppendAllText('" + $escapedPath + "', ' ')" }
    $hook = if ($mutation -eq 'manifest-plan-race') { '$manifestRecord = Get-Content -LiteralPath $releaseManifest -Raw -Encoding utf8 | ConvertFrom-Json' } else { $mutationHook }
    $injected = if ($mutation -eq 'manifest-plan-race') { $hook + "`n" + $mutationCode } else { $mutationCode + "`n" + $hook }
    [IO.File]::WriteAllText($cleanupPath, $cleanupSource.Replace($hook, $injected), (New-Object Text.UTF8Encoding($false)))
    $refused = $false
    try { Run-Cleanup -Kind Releases -Apply $true -KeepLatestOnly $true } catch { $refused = $_.Exception.Message -like '*changed during cleanup*' }
    Check ($refused -and (Test-Path -LiteralPath $latestCandidate)) ('KeepLatestOnly rechecks planned release files before deletion: ' + $mutation)
    [IO.File]::WriteAllText($mutatedPath, $originalContent, (New-Object Text.UTF8Encoding($false)))
    [IO.File]::SetLastWriteTimeUtc($mutatedPath, $originalTime)
    [IO.File]::WriteAllText($cleanupPath, $cleanupSource, (New-Object Text.UTF8Encoding($false)))
  }
  $latestProtected = @('TableMax-1.5.0-win-x64.zip', 'TableMax-1.5.0-win-x64-manifest.json', 'package-1.4.0-Linked', 'latest-linked-copy', 'nested-release', 'recent-release.tmp')
  $latestCandidates = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/releases') -Force | Where-Object { $_.Name -notin $latestProtected } | ForEach-Object { $_.FullName })
  & (Join-Path $fixture 'Clean-Releases.ps1') -Apply -KeepLatestOnly
  foreach ($path in $latestCandidates) {
    Check (-not (Test-Path -LiteralPath $path)) ('KeepLatestOnly removes safe release child: ' + [IO.Path]::GetFileName($path))
  }
  foreach ($name in $latestProtected) { Check (Test-Path -LiteralPath (Join-Path $fixture ('artifacts/releases/' + $name))) ('KeepLatestOnly preserves current or safety-protected child: ' + $name) }
  Check ((Get-Content -LiteralPath (Join-Path $fixture 'protected/marker.txt') -Raw) -eq 'protected-junction-target') 'KeepLatestOnly leaves linked targets byte-identical'
  Check ((Get-FileHash -LiteralPath $currentZip -Algorithm SHA256).Hash.ToLowerInvariant() -eq $hash -and (Get-Content -LiteralPath $manifestPath -Raw) -eq $validManifest) 'KeepLatestOnly keeps the current runtime ZIP and matching manifest byte-identical'
  Check ((Test-Path -LiteralPath (Join-Path $fixture 'tmp/preserve-me/notes.md')) -and (Test-Path -LiteralPath (Join-Path $fixture ($verificationRun + '/results.json')))) 'KeepLatestOnly never cleans tmp or historical maintenance evidence'
  $latestReports = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Filter cleanup.json -Recurse -File | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8 | ConvertFrom-Json } | Where-Object { $_.keepLatestOnly -and $_.result -eq 'passed' })
  Check ($latestReports.Count -eq 1 -and $latestReports[0].preservedFiles.Count -eq 2 -and $latestReports[0].candidates.Count -eq $latestCandidates.Count -and @($latestReports[0].candidates | Where-Object { $_.deleted }).Count -eq $latestCandidates.Count -and $latestReports[0].skipped.Count -eq 4) 'KeepLatestOnly audit records the mode, both preserved files, every safe candidate and every skipped child'
  Fixture-File 'artifacts/releases/TableMax-1.5.0-win-x64.zip' 'changed-unverified-current'
  $refused = $false
  try { Run-Cleanup Releases $true 0 $false @('1.6.0') } catch { $refused = $_.Exception.Message -like '*No passing portable evidence*' }
  Check $refused 'Changed or unverified current archive blocks cleanup'
  $evidenceDir = if ($EvidenceDirectory) { [IO.Path]::GetFullPath($EvidenceDirectory) } else { Join-Path $workspaceForTest 'artifacts/maintenance/local-cleanup-tools' }
  New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
  [PSCustomObject]@{ verifiedAt = [DateTime]::UtcNow.ToString('o'); result = 'passed'; checks = $checks.ToArray(); runtime = $PSVersionTable.PSVersion.ToString() } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidenceDir 'tool-tests.json') -Encoding utf8
  Write-Host ('PASS: ' + $checks.Count + ' cleanup checks in an isolated workspace fixture.')
}
finally {
  if ($busyProcess -and -not $busyProcess.HasExited) { $busyProcess.Kill(); $busyProcess.WaitForExit() }
  if ($lockProcess -and -not $lockProcess.HasExited) { $lockProcess.Kill(); $lockProcess.WaitForExit() }
  foreach ($fixtureJunction in @($junction, $temporaryJunction, $verificationJunction, $latestJunction)) {
    if (Test-Path -LiteralPath $fixtureJunction) {
      if (-not ((Get-Item -LiteralPath $fixtureJunction -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected test junction replacement; fixture retained.' }
      [IO.Directory]::Delete($fixtureJunction)
    }
  }
  if (Test-Path -LiteralPath $fixture) {
    $resolvedFixture = (Resolve-Path -LiteralPath $fixture).Path
    if (-not $resolvedFixture.StartsWith($workspaceForTest + '\tmp\cleanup-test-', [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture cleanup path failed verification.' }
    if (Get-ChildItem -LiteralPath $resolvedFixture -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Unexpected test reparse point; fixture retained.' }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
  }
}
