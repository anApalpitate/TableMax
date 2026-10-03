$ErrorActionPreference = 'Stop'
$workspaceForTest = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$fixture = Join-Path $workspaceForTest ('tmp/cleanup-test-' + [Guid]::NewGuid().ToString('N'))
$checks = New-Object 'System.Collections.Generic.List[string]'
$busyProcess = $null
$junction = Join-Path $fixture 'artifacts/releases/package-1.4.0-Linked/link'

function Check([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw ('FAILED: ' + $Message) }
  $checks.Add($Message)
}
function Fixture-File([string]$Relative, [string]$Content) {
  $path = Join-Path $fixture $Relative
  New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($path, $Content, (New-Object Text.UTF8Encoding($false)))
}
function Run-Cleanup([string]$Kind, [bool]$Apply, [int]$Age = 30, [bool]$Build = $false, [string[]]$Retired = @()) {
  & (Join-Path $fixture 'scripts/cleanup-local.ps1') -Kind $Kind -Apply:$Apply -MinimumAgeMinutes $Age -IncludeBuild:$Build -RetiredVersions $Retired
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
  Fixture-File 'tmp/modern-art-verify-research/notes.md' 'unknown-modern-art-research'
  Fixture-File 'tmp/game-ui-Young1/data/room.sqlite' 'young-isolated-test-data'
  Fixture-File 'tmp/check-display-docs.mjs' 'temporary-script-to-archive'
  Fixture-File 'tmp/preserve-me/notes.md' 'unknown-research'
  Fixture-File 'build/desktop/main.cjs' 'current-build'
  Fixture-File 'protected/marker.txt' 'protected-junction-target'
  New-Item -ItemType Directory -Path (Split-Path $junction -Parent) -Force | Out-Null
  New-Item -ItemType Junction -Path $junction -Value (Join-Path $fixture 'protected') | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $fixture 'scripts') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'cleanup-local.ps1') -Destination (Join-Path $fixture 'scripts/cleanup-local.ps1')
  $currentZip = Join-Path $fixture 'artifacts/releases/TableMax-1.5.0-win-x64.zip'
  $hash = (Get-FileHash -LiteralPath $currentZip -Algorithm SHA256).Hash.ToLowerInvariant()
  Fixture-File 'artifacts/maintenance/portable/results.json' ('{"portable":true,"result":"passed","archiveSha256":"' + $hash + '","note":"中文编码"}')
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

  Run-Cleanup Releases $false
  Check (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/TableMax-1.4.0-win-x64.zip')) 'Preview never deletes old releases'
  Check (@(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Directory).Count -eq 1) 'Preview writes no cleanup evidence or workspace files'
  $busyProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('-e', 'setInterval(()=>{},1000)', $fixture) -WindowStyle Hidden -PassThru
  Start-Sleep -Milliseconds 250
  $refused = $false
  try { Run-Cleanup Releases $true } catch { $refused = $_.Exception.Message -like '*Busy PIDs*' }
  Check $refused 'Active workspace runtime blocks Apply before deletion'
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

  Run-Cleanup Intermediates $true
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts/releases/package-1.5.0-ABC123'))) 'Current regenerable stage is removed, current ZIP retained'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/display-ABC123'))) 'Recognized stopped verification directory is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/experience-EXP123'))) 'Recognized stopped experience verification data is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/runtime-memory-MEM123'))) 'Recognized stopped memory verification data is removed'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/modern-art-verify-ART123'))) 'Recognized stopped Modern Art verification data is removed'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/modern-art-verify-research/notes.md')) 'Similar Modern Art research directory is preserved'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/game-ui-Young1')) 'Recently modified verification data is protected by default'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'tmp/preserve-me/notes.md')) 'Unknown temporary research is preserved'
  Check (Test-Path -LiteralPath (Join-Path $fixture 'build/desktop/main.cjs')) 'Current build is retained by default'
  $archivedScripts = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Filter check-display-docs.mjs -Recurse -File)
  Check ($archivedScripts.Count -eq 1 -and (Get-Content -LiteralPath $archivedScripts[0].FullName -Raw) -eq 'temporary-script-to-archive') 'One-off script is archived before deletion'
  Run-Cleanup Intermediates $true 0 $true
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'build'))) 'Build is removed only with explicit IncludeBuild'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture 'tmp/game-ui-Young1'))) 'Explicit zero age removes stopped young verification data'
  Check ((Get-FileHash -LiteralPath $currentZip -Algorithm SHA256).Hash.ToLowerInvariant() -eq $hash) 'Current verified ZIP stays byte-identical through all cleanup modes'
  Fixture-File 'artifacts/releases/TableMax-1.5.0-win-x64.zip' 'changed-unverified-current'
  $refused = $false
  try { Run-Cleanup Releases $true 0 $false @('1.6.0') } catch { $refused = $_.Exception.Message -like '*No passing portable evidence*' }
  Check $refused 'Changed or unverified current archive blocks cleanup'
  $evidenceDir = Join-Path $workspaceForTest 'artifacts/maintenance/local-cleanup-tools'
  New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
  [PSCustomObject]@{ verifiedAt = [DateTime]::UtcNow.ToString('o'); result = 'passed'; checks = $checks.ToArray(); runtime = $PSVersionTable.PSVersion.ToString() } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidenceDir 'tool-tests.json') -Encoding utf8
  Write-Host ('PASS: ' + $checks.Count + ' cleanup checks in an isolated workspace fixture.')
}
finally {
  if ($busyProcess -and -not $busyProcess.HasExited) { $busyProcess.Kill(); $busyProcess.WaitForExit() }
  if (Test-Path -LiteralPath $junction) {
    if (-not ((Get-Item -LiteralPath $junction -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected test junction replacement; fixture retained.' }
    [IO.Directory]::Delete($junction)
  }
  if (Test-Path -LiteralPath $fixture) {
    $resolvedFixture = (Resolve-Path -LiteralPath $fixture).Path
    if (-not $resolvedFixture.StartsWith($workspaceForTest + '\tmp\cleanup-test-', [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture cleanup path failed verification.' }
    if (Get-ChildItem -LiteralPath $resolvedFixture -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Unexpected test reparse point; fixture retained.' }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
  }
}
