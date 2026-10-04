param([string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$fixture = Join-Path $project ('tmp/workspace-compression-' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
$outside = Join-Path $project ('tmp/compression-external-' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
$junction = Join-Path $fixture 'outside-link'
$redirectedParent = Join-Path $fixture 'redirected-parent'
$movedParent = Join-Path $outside 'moved-parent'
$redirectedCreated = $false
$evidenceRoot = if ($EvidenceDirectory) { [IO.Path]::GetFullPath($EvidenceDirectory) } else { Join-Path $project 'artifacts/maintenance/compression-tools' }
if (-not $evidenceRoot.StartsWith($project + '\artifacts\maintenance\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Evidence directory must stay inside project maintenance.' }
$stableReport = Join-Path $evidenceRoot 'compression-isolated-report.json'
$stableAudit = Join-Path $evidenceRoot 'compression-isolated-items.jsonl'
$checks = [Collections.Generic.List[string]]::new()
$busyProcess = $null
$testError = $null
$report = $null
$timer = [Diagnostics.Stopwatch]::StartNew()
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

function Check([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw ('FAILED: ' + $Message) }
  $checks.Add($Message)
}
function Run-Compression([bool]$Apply, [string]$Label) {
  $captured = [Collections.Generic.List[string]]::new()
  try {
    & (Join-Path $project 'Compress-Workspace.ps1') -ProjectRoot $fixture -Apply:$Apply *>&1 | ForEach-Object { $captured.Add([string]$_) }
  }
  catch { $captured.Add($_.Exception.Message); throw }
  finally { $captured | Set-Content -LiteralPath (Join-Path $evidenceRoot ('compression-isolated-' + $Label + '.log')) -Encoding utf8 }
}
function Remove-OwnedFixture([string]$Path, [string]$Prefix) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  $expected = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  if ($resolved -ne $expected -or -not $resolved.StartsWith($project + '\tmp\' + $Prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture cleanup path failed verification; fixture retained.' }
  $stack = [Collections.Generic.Stack[string]]::new()
  $stack.Push($resolved)
  while ($stack.Count) {
    $directory = $stack.Pop()
    if ((Get-Item -LiteralPath $directory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected fixture reparse point; fixture retained.' }
    foreach ($entry in [IO.DirectoryInfo]::new($directory).EnumerateFileSystemInfos()) {
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected fixture reparse point; fixture retained.' }
      if ($entry -is [IO.DirectoryInfo]) { $stack.Push($entry.FullName) }
    }
  }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}

try {
  New-Item -ItemType Directory -Path $fixture, $outside -Force | Out-Null
  & git -C $fixture init --quiet
  if ($LASTEXITCODE -ne 0) { throw 'Isolated fixture repository initialization failed.' }
  $ordinary = Join-Path $fixture 'retained-evidence.txt'
  $localShared = Join-Path $fixture 'local-shared.txt'
  $localAlias = Join-Path $fixture 'local-alias.txt'
  $externalTarget = Join-Path $outside 'outside-data.txt'
  $externalAlias = Join-Path $fixture 'external-alias.txt'
  $randomFile = Join-Path $fixture 'random.bin'
  $readOnlyFile = Join-Path $fixture 'readonly-retained.txt'
  [IO.File]::WriteAllText($ordinary, ('preserve all original evidence and semantic content' + "`n") * 24000)
  [IO.File]::WriteAllText($localShared, ('local hard link source' + "`n") * 18000)
  [IO.File]::WriteAllText($externalTarget, ('shared outside target' + "`n") * 18000)
  [IO.File]::WriteAllText($readOnlyFile, ('read-only evidence must retain content and flags' + "`n") * 18000)
  [IO.File]::SetAttributes($readOnlyFile, ((Get-Item -LiteralPath $readOnlyFile).Attributes -bor [IO.FileAttributes]::ReadOnly))
  $readOnlyAttributes = (Get-Item -LiteralPath $readOnlyFile).Attributes
  New-Item -ItemType HardLink -Path $localAlias -Target $localShared | Out-Null
  New-Item -ItemType HardLink -Path $externalAlias -Target $externalTarget | Out-Null
  New-Item -ItemType Junction -Path $junction -Target $outside | Out-Null
  $random = New-Object byte[] 131072
  $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $randomGenerator.GetBytes($random) } finally { $randomGenerator.Dispose() }
  [IO.File]::WriteAllBytes($randomFile, $random)
  $nested = Join-Path $fixture 'nested'
  New-Item -ItemType Directory -Path (Join-Path $nested '.git') -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $nested 'nested-data.txt'), ('nested preserved' + "`n") * 18000)
  $before = @{}
  foreach ($path in @($ordinary, $localShared, $localAlias, $externalTarget, $externalAlias, $randomFile, $readOnlyFile, (Join-Path $nested 'nested-data.txt'))) { $before[$path] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
  Run-Compression $false 'preview'
  Check (-not ((Get-Item -LiteralPath $ordinary).Attributes -band [IO.FileAttributes]::Compressed) -and -not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts'))) 'Preview neither compresses content nor creates audit files'

  # The command line is deliberately relative: no fixture path is passed to node.
  New-Item -ItemType Directory -Path (Join-Path $fixture 'scripts') -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $fixture 'scripts/dev.mjs'), 'import { writeFileSync } from "node:fs"; writeFileSync("relative-busy-ready", "ready"); setInterval(() => {}, 1000);')
  $marker = Join-Path $fixture 'relative-busy-ready'
  $busyProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('scripts/dev.mjs') -WorkingDirectory $fixture -WindowStyle Hidden -PassThru
  for ($attempt=0; $attempt -lt 40 -and -not (Test-Path -LiteralPath $marker); $attempt++) { Start-Sleep -Milliseconds 100 }
  if (-not (Test-Path -LiteralPath $marker)) { throw 'Relative node guard fixture did not start.' }
  $commandLine = [string](Get-CimInstance Win32_Process -Filter ('ProcessId=' + $busyProcess.Id)).CommandLine
  if ($commandLine.IndexOf($fixture, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or $commandLine -notmatch 'scripts[\\/]dev\.mjs') { throw 'Busy fixture does not exercise a relative command.' }
  $blocked = $false
  try { Run-Compression $true 'busy-guard' } catch { $blocked=$_.Exception.Message -like '*workspace application, build or verification process is still active*' }
  $allOriginal = $true
  foreach ($path in $before.Keys) { if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $before[$path]) { $allOriginal=$false } }
  Check ($blocked -and $allOriginal -and -not ((Get-Item -LiteralPath $ordinary).Attributes -band [IO.FileAttributes]::Compressed) -and -not (Test-Path -LiteralPath (Join-Path $fixture 'artifacts'))) 'A hidden relative node development process blocks Apply before any candidate changes'
  $busyProcess.Kill(); $busyProcess.WaitForExit(); $busyProcess=$null

  Run-Compression $true 'apply'
  Check ([bool]((Get-Item -LiteralPath $ordinary).Attributes -band [IO.FileAttributes]::Compressed)) 'Ordinary retained evidence is transparently compressed'
  Check ([bool]((Get-Item -LiteralPath $localShared).Attributes -band [IO.FileAttributes]::Compressed)) 'Fully local hard links share one compressed file'
  Check (-not ((Get-Item -LiteralPath $externalTarget).Attributes -band [IO.FileAttributes]::Compressed)) 'External hard-link targets retain their compression state'
  Check (-not ((Get-Item -LiteralPath $randomFile).Attributes -band [IO.FileAttributes]::Compressed)) 'Incompressible content is restored to its original allocation'
  Check (-not ((Get-Item -LiteralPath (Join-Path $nested 'nested-data.txt')).Attributes -band [IO.FileAttributes]::Compressed)) 'Nested repositories remain untouched'
  $allOriginal=$true
  foreach ($path in $before.Keys) { if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $before[$path]) { $allOriginal=$false } }
  Check $allOriginal 'Every source and hard-link alias retains its original SHA-256'
  [IO.File]::AppendAllText($ordinary, 'ordinary application writes still work')
  Check ([IO.File]::ReadAllText($ordinary).EndsWith('ordinary application writes still work')) 'Normal application reads and writes still work after compression'
  $reports = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Directory -Filter 'workspace-compression-*' | Sort-Object Name)
  $reportPath = Join-Path $reports[-1].FullName 'compression.json'
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
  Check ($report.result -eq 'passed' -and $report.savedBytes -gt 0 -and $report.changedCount -eq 2 -and $report.checkedCount -eq 3) 'Accounting counts unique compressed files and real storage savings'
  Check (@($report.skipped | Where-Object reason -eq 'link preserved').Count -eq 1) 'The outside junction is excluded from the audit'
  Check (@($report.skipped | Where-Object reason -eq 'hard links outside audited workspace preserved').Count -eq 1) 'Outside hard-link ownership is explicitly excluded'
  $readonlySkips = @($report.skipped | Where-Object { $_.path -eq $readOnlyFile -and $_.reason -eq 'readonly file preserved' })
  $readOnlyAfter = Get-Item -LiteralPath $readOnlyFile -Force
  Check ($readOnlyAfter.Length -gt $report.preview.minimumBytes -and $readOnlyAfter.Attributes -eq $readOnlyAttributes -and [bool]($readOnlyAfter.Attributes -band [IO.FileAttributes]::ReadOnly) -and -not ($readOnlyAfter.Attributes -band [IO.FileAttributes]::Compressed) -and (Get-FileHash -LiteralPath $readOnlyFile -Algorithm SHA256).Hash -eq $before[$readOnlyFile] -and $readonlySkips.Count -eq 1 -and @($report.candidates | Where-Object path -eq $readOnlyFile).Count -eq 0) 'A read-only file larger than MinimumBytes retains its SHA-256 and exact attributes, excluded with an explicit readonly reason'
  $items = @(Get-Content -LiteralPath $report.auditPath | ForEach-Object { $_ | ConvertFrom-Json })
  $started = @($items | Where-Object event -eq 'started')
  $completed = @($items | Where-Object event -eq 'completed')
  $auditValid = $items[0].event -eq 'run-started' -and $started.Count -eq 3 -and $completed.Count -eq 3
  foreach ($candidate in $report.candidates) {
    $events = @($items | Where-Object path -eq $candidate.path)
    if ($events.Count -ne 2 -or $events[0].event -ne 'started' -or $events[1].event -ne 'completed' -or $events[1].sha256 -ne $candidate.sha256 -or $events[1].storageBytesAfter -ne $candidate.storageBytesAfter) { $auditValid=$false }
  }
  Check $auditValid 'Durable JSONL records run start, each candidate start, and matching hash-confirmed completion'
  Copy-Item -LiteralPath $reportPath -Destination $stableReport -Force
  Copy-Item -LiteralPath $report.auditPath -Destination $stableAudit -Force

  # Preserve leaf identity and link count while moving its parent outside the
  # audited workspace. A lexical path and inode-only check would still pass.
  $expectedParent = [IO.Path]::GetFullPath($redirectedParent)
  $expectedMoved = [IO.Path]::GetFullPath($movedParent)
  if (-not $expectedParent.StartsWith($fixture + '\', [StringComparison]::OrdinalIgnoreCase) -or -not $expectedMoved.StartsWith($outside + '\', [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $expectedParent) -or (Test-Path -LiteralPath $expectedMoved)) { throw 'Moved-parent fixture boundaries or initial state failed verification.' }
  New-Item -ItemType Directory -Path $expectedParent -Force | Out-Null
  $scopeFile = Join-Path $expectedParent 'scope-data.txt'
  [IO.File]::WriteAllText($scopeFile, ('physical workspace boundary must be preserved' + "`n") * 18000)
  $scopeBefore = [TableMaxNtfsCompression]::Inspect($scopeFile)
  $scopeHash = (Get-FileHash -LiteralPath $scopeFile -Algorithm SHA256).Hash
  $scopeAttributes = (Get-Item -LiteralPath $scopeFile -Force).Attributes
  $parentEntry = Get-Item -LiteralPath $expectedParent -Force
  if ((Resolve-Path -LiteralPath $expectedParent).Path -ne $expectedParent -or ($parentEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $parentEntry.PSIsContainer) { throw 'Only the exact ordinary owned parent may move.' }
  Move-Item -LiteralPath $expectedParent -Destination $expectedMoved
  if ((Resolve-Path -LiteralPath $expectedMoved).Path -ne $expectedMoved -or (Test-Path -LiteralPath $expectedParent)) { throw 'Owned parent movement did not match the verified target.' }
  New-Item -ItemType Junction -Path $expectedParent -Target $expectedMoved | Out-Null
  $redirectedCreated = $true
  $scopeRedirected = [TableMaxNtfsCompression]::Inspect($scopeFile)
  $scopeRefused = $false
  $scopeError = $null
  try { $null = [TableMaxNtfsCompression]::Compress($scopeFile, $scopeBefore.Identity, $scopeBefore.LogicalBytes, $scopeBefore.Links, $fixture, [string[]]@($scopeFile)) }
  catch { $scopeError=$_.Exception.Message; $scopeRefused=$scopeError -like '*resolves outside audited workspace*' }
  $scopeAfter = [TableMaxNtfsCompression]::Inspect($scopeFile)
  $scopeCase = @{ originalPath=$scopeFile; actualMovedParent=$expectedMoved; identityBefore=$scopeBefore.Identity; identityAfterRedirect=$scopeRedirected.Identity; linksBefore=$scopeBefore.Links; linksAfterRedirect=$scopeRedirected.Links; logicalBytesBefore=$scopeBefore.LogicalBytes; logicalBytesAfterRedirect=$scopeRedirected.LogicalBytes; refused=$scopeRefused; error=$scopeError; sha256Before=$scopeHash; sha256After=(Get-FileHash -LiteralPath $scopeFile -Algorithm SHA256).Hash; attributesBefore=[int]$scopeAttributes; attributesAfter=[int](Get-Item -LiteralPath $scopeFile -Force).Attributes; compressedAfter=$scopeAfter.Compressed }
  $scopeCase | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'physical-boundary-case.json') -Encoding utf8
  Check ($scopeRefused -and $scopeRedirected.Identity -eq $scopeBefore.Identity -and $scopeRedirected.Links -eq $scopeBefore.Links -and $scopeRedirected.LogicalBytes -eq $scopeBefore.LogicalBytes -and $scopeCase.sha256After -eq $scopeHash -and $scopeCase.attributesAfter -eq [int]$scopeAttributes -and -not $scopeAfter.Compressed) 'An outside moved parent with a Junction back to the same inode is rejected by final handle path, preserving content and attributes'
}
catch { $testError=$_; throw }
finally {
  if ($busyProcess -and -not $busyProcess.HasExited) { $busyProcess.Kill(); $busyProcess.WaitForExit() }
  if (Test-Path -LiteralPath $redirectedParent) {
    $redirected = Get-Item -LiteralPath $redirectedParent -Force
    if ($redirectedCreated -or ($redirected.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      $resolvedRedirected = [IO.Path]::GetFullPath($redirectedParent)
      $redirectedTarget = [IO.Path]::GetFullPath([string](@($redirected.Target)[0])).TrimEnd('\')
      if (-not $resolvedRedirected.StartsWith($fixture + '\', [StringComparison]::OrdinalIgnoreCase) -or -not ($redirected.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $redirected.LinkType -ne 'Junction' -or $redirectedTarget -ne [IO.Path]::GetFullPath($movedParent).TrimEnd('\')) { throw 'Unexpected redirected-parent fixture; owned roots retained.' }
      [IO.Directory]::Delete($resolvedRedirected)
    }
  }
  if (Test-Path -LiteralPath $junction) {
    $link = Get-Item -LiteralPath $junction -Force
    $resolvedJunction = [IO.Path]::GetFullPath($junction)
    $target = [IO.Path]::GetFullPath([string](@($link.Target)[0])).TrimEnd('\')
    if (-not $resolvedJunction.StartsWith($project + '\tmp\workspace-compression-', [StringComparison]::OrdinalIgnoreCase) -or -not ($link.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $link.LinkType -ne 'Junction' -or $target -ne [IO.Path]::GetFullPath($outside).TrimEnd('\')) { throw 'Unexpected owned junction replacement; fixtures retained.' }
    [IO.Directory]::Delete($resolvedJunction)
  }
  Remove-OwnedFixture $fixture 'workspace-compression-'
  Remove-OwnedFixture $outside 'compression-external-'
  $timer.Stop()
  $output = Join-Path $evidenceRoot 'compression-tool-tests.json'
  @{ result=$(if ($testError) { 'failed' } else { 'passed' }); assertions=$checks.Count; checks=$checks.ToArray(); fixture=$fixture; externalFixture=$outside; report=$stableReport; audit=$stableAudit; savedBytes=$(if ($report) { $report.savedBytes } else { 0 }); seconds=$timer.Elapsed.TotalSeconds; fixtureTeardown='completed; only this run owned roots and its verified junction'; error=$(if ($testError) { $testError.Exception.Message } else { $null }) } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $output -Encoding utf8
}
Write-Output ('Transparent compression: ' + $checks.Count + ' checks passed. Evidence: ' + $output)
