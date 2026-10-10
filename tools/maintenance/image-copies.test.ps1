param([string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
$testProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$fixtureLabel = 'image-copy-test-' + [char]0x6E38 + [char]0x620F + ' ' + [Guid]::NewGuid().ToString('N')
$fixture = Join-Path $testProject ('tmp/' + $fixtureLabel)
$checks = New-Object 'System.Collections.Generic.List[string]'
$links = New-Object 'System.Collections.Generic.List[string]'
$oldCoordinator = $env:TABLEMAX_MAINTENANCE_COORDINATOR
$inventoryVariable = 'TableMaxImageCopyFixtureProcessInventory'
$hookVariable = 'TableMaxImageCopyFixtureBeforeIdle'
$callVariable = 'TableMaxImageCopyFixtureIdleCalls'
$savedVariables = @{}
foreach ($name in @($inventoryVariable, $hookVariable, $callVariable)) {
  $value = Get-Variable -Name $name -Scope Global -ErrorAction SilentlyContinue
  $savedVariables[$name] = $value
}

# Controlled Win32_Process inventory applies only to this copied fixture tool.
# Production cleanup still uses its genuine CIM query; no production source is patched.
function Get-CimInstance {
  param([string]$ClassName)
  if ($ClassName -ne 'Win32_Process') { throw 'Unexpected fixture CIM query.' }
  $global:TableMaxImageCopyFixtureIdleCalls++
  if ($global:TableMaxImageCopyFixtureBeforeIdle) {
    $hook = $global:TableMaxImageCopyFixtureBeforeIdle
    $global:TableMaxImageCopyFixtureBeforeIdle = $null
    & $hook | Out-Null
  }
  return $global:TableMaxImageCopyFixtureProcessInventory
}

function File([string]$Path, [string]$Text) {
  $full = Join-Path $fixture $Path
  New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($full, $Text)
  (Get-Item -LiteralPath $full).LastWriteTimeUtc = [DateTime]::UtcNow.AddHours(-2)
}
function Member([string]$Path) {
  $full = Join-Path $fixture $Path
  $item = Get-Item -LiteralPath $full -Force
  return [PSCustomObject]@{
    path = $Path
    bytes = [long]$item.Length
    sha256 = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}
function Remove-FixtureJunction([string]$Path) {
  $absoluteRoot = [IO.Path]::GetFullPath($fixture).TrimEnd('\')
  $absolute = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  if (-not $absoluteRoot.StartsWith($testProject + '\tmp\', [StringComparison]::OrdinalIgnoreCase) -or
      -not $absolute.StartsWith($absoluteRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Fixture junction escapes its isolated tmp root.'
  }
  $item = Get-Item -LiteralPath $absolute -Force
  if (-not $item.PSIsContainer -or -not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Only a fixture directory reparse point may use nonrecursive link removal.'
  }
  $cursor = Split-Path $absolute -Parent
  while ($cursor -and $cursor -ne $testProject) {
    if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw 'Fixture junction removal refuses linked ancestors.'
    }
    $cursor = Split-Path $cursor -Parent
  }
  if (-not ('TableMax.ImageCopyFixtureLinks' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace TableMax {
  public static class ImageCopyFixtureLinks {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true,
      EntryPoint = "RemoveDirectoryW", ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool RemoveDirectory(string path);
  }
}
'@
  }
  if (-not [TableMax.ImageCopyFixtureLinks]::RemoveDirectory($absolute)) {
    throw (New-Object ComponentModel.Win32Exception([Runtime.InteropServices.Marshal]::GetLastWin32Error()))
  }
}
function Check([bool]$Value, [string]$Message) {
  if (-not $Value) { throw $Message }
  $checks.Add($Message)
}
function CandidatesRemain {
  foreach ($path in @($screenPath, $copyPath)) {
    if (-not (Test-Path -LiteralPath (Join-Path $fixture $path) -PathType Leaf)) {
      throw ('Rejected request removed a candidate: ' + $path)
    }
  }
}
function Reject([scriptblock]$Action, [string]$Message, [string]$Pattern = '') {
  $caught = $null
  try { & $Action | Out-Null }
  catch { $caught = $_.Exception.Message }
  if (-not $caught) { throw ('Expected rejection: ' + $Message) }
  if ($Pattern -and $caught -notmatch $Pattern) {
    throw ('Wrong rejection for ' + $Message + ': ' + $caught)
  }
  CandidatesRemain
  Check $true $Message
}
function Plan {
  File $manifestPath ($script:plan | ConvertTo-Json -Depth 12)
}
function Age {
  # Finish enumeration before changing directory timestamps. Windows PowerShell
  # 5.1 can otherwise retain a directory handle while the pipeline mutates it.
  $entries = @($script:plan.groups | ForEach-Object {
    $candidateDirectory = Join-Path $fixture $_.path
    Get-ChildItem -LiteralPath $candidateDirectory -Recurse -Force
    Get-Item -LiteralPath $candidateDirectory -Force
  })
  foreach ($entry in $entries) {
    if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Age refuses fixture reparse points.' }
    $entry.LastWriteTimeUtc = [DateTime]::UtcNow.AddHours(-2)
  }
}
function Run([switch]$Apply, [hashtable]$Options = @{}) {
  $arguments = @{
    Kind = 'Intermediates'
    ImageCopiesManifest = $manifestPath
    Apply = [bool]$Apply
  }
  foreach ($key in $Options.Keys) { $arguments[$key] = $Options[$key] }
  & (Join-Path $fixture 'tools/maintenance/cleanup-local.ps1') @arguments
}
function Reset {
  $global:TableMaxImageCopyFixtureProcessInventory = @()
  $global:TableMaxImageCopyFixtureBeforeIdle = $null
  $global:TableMaxImageCopyFixtureIdleCalls = 0
  File 'package.json' '{"name":"tablemax","version":"1.0.6"}'
  File 'README.md' '# Isolated image retirement fixture'
  File 'docs/reference/fixture.md' '# Retained fixture report'
  File $archivePath 'current-runtime-zip'
  File $releaseManifestPath '{"version":"1.0.6","fixture":true}'
  $archiveHash = (Member $archivePath).sha256
  File $proofPath (@{ portable = $true; result = 'passed'; archiveSha256 = $archiveHash } | ConvertTo-Json)
  File $screenPath 'obsolete-matrix-image'
  File $keyPath 'critical-png-image'
  File $screenReport '{"result":"passed","zipSha256":"old-candidate","layouts":24}'
  File $savePath 'formal-state-remains'
  File $originalPath 'exact-retained-source-image'
  File $copyPath 'exact-retained-source-image'
  File $copyReport '{"result":"passed","kind":"generated-bundle"}'
  File $finalUnoPath 'current-uno-proof-png'
  File $finalRummikubPath 'current-rummikub-proof-png'
  File 'artifacts/uno/validation/v106-final-4/failure-host.png' 'unique-failure-png'
  File 'artifacts/uno/validation/v106-final-4/failed-host.png' 'unique-failed-png'
  $derivative = Member $copyPath
  $derivative | Add-Member NoteProperty sourcePath $originalPath
  $script:plan = [PSCustomObject]@{
    schemaVersion = 1
    authorization = 'retire-reviewed-image-copies'
    currentVersion = '1.0.6'
    currentArchiveSha256 = $archiveHash
    protectedFiles = @($archivePath, $releaseManifestPath, $proofPath, $keyPath, $savePath, $originalPath, $finalUnoPath, $finalRummikubPath | ForEach-Object { Member $_ })
    groups = @(
      [PSCustomObject]@{
        path = 'artifacts/uno/validation/v106-final-4'
        kind = 'superseded-screenshots'
        reason = 'Superseded candidate matrix; key evidence and original report remain'
        files = @((Member $screenPath))
        evidence = @((Member $screenReport))
      }
      [PSCustomObject]@{
        path = 'artifacts/maintenance/v1.0.5/copy-test/work-ABC123/bundle/assets'
        kind = 'derived-asset-copies'
        reason = 'Generated copy matches retained source bytes and SHA-256'
        files = @($derivative)
        evidence = @((Member $copyReport))
      }
    )
  }
  Plan
  Age
}
function ChangedDuringApply([scriptblock]$Mutation, [string]$Label, [string]$Pattern = '', [int]$GroupIndex = 0) {
  Reset
  $script:plan.groups = @($script:plan.groups[$GroupIndex])
  Plan
  Age
  $global:TableMaxImageCopyFixtureBeforeIdle = $Mutation
  Reject { Run -Apply } $Label $Pattern
}

$manifestPath = 'artifacts/maintenance/v1.0.6/image-copy-fixture/manifest.json'
$archivePath = 'artifacts/releases/TableMax-1.0.6-win-x64.zip'
$releaseManifestPath = 'artifacts/releases/TableMax-1.0.6-win-x64-manifest.json'
$proofPath = 'artifacts/maintenance/v1.0.6/proof/results.json'
$screenPath = 'artifacts/uno/validation/v106-final-4/old-matrix.png'
$keyPath = 'artifacts/uno/validation/v106-final-4/key-acceptance.png'
$screenReport = 'artifacts/uno/validation/v106-final-4/results.json'
$savePath = 'artifacts/uno/validation/v106-final-4/room.sqlite'
$originalPath = 'assets/platform/original.webp'
$copyPath = 'artifacts/maintenance/v1.0.5/copy-test/work-ABC123/bundle/assets/original-copied.webp'
$copyReport = 'artifacts/maintenance/v1.0.5/copy-test/results.json'
$finalUnoPath = 'artifacts/uno/validation/v106-final-layout-6/current.png'
$finalRummikubPath = 'artifacts/rummikub/validation/ui-preview/final-authoritative-20261009/current.png'
$startedAt = [DateTime]::UtcNow
$passed = $false
try {
  $env:TABLEMAX_MAINTENANCE_COORDINATOR = $null
  New-Item -ItemType Directory -Path (Join-Path $fixture 'tools/maintenance') -Force | Out-Null
  foreach ($script in @('cleanup-local.ps1', 'cleanup-guard.ps1', 'WorkspaceSnapshot.cs', 'image-copies.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $fixture ('tools/maintenance/' + $script))
  }
  Reset
  Run | Out-Null
  CandidatesRemain
  Check $true 'Preview preserves all listed images in a root containing spaces and Unicode'
  Check (@(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Directory -Filter 'local-cleanup-*').Count -eq 0) 'Preview creates no deletion report'
  Check ($global:TableMaxImageCopyFixtureIdleCalls -eq 0) 'Preview does not enter the deletion idle flow'

  foreach ($options in @(
    @{ Kind = 'Maintenance' }, @{ Kind = 'Releases' }, @{ ImageCopiesManifest = '' },
    @{ IncludeBuild = $true }, @{ KeepLatestOnly = $true }, @{ TemporaryNames = @('other') },
    @{ VerificationCopies = @('other') }, @{ RetiredVersions = @('1.0.5') },
    @{ DuplicateScreenshotsManifest = 'other.json' }, @{ RetiredGeneratedManifest = 'other.json' },
    @{ HistoricalScreenshotsManifest = 'other.json' }, @{ RegisteredArtifactsManifest = 'other.json' },
    @{ MinimumAgeMinutes = 0 }, @{ MinimumAgeMinutes = 29 }
  )) {
    Reset
    $label = (($options.Keys | Sort-Object) -join ',') + ':' + (($options.Values | ForEach-Object { [string]$_ }) -join ',')
    Reject { Run -Apply -Options $options } ('Exclusive manual and 30-minute contract rejects ' + $label) 'exclusive manual cleanup'
  }

  foreach ($change in @(
    @{ name = 'schemaVersion'; value = 2 }, @{ name = 'authorization'; value = 'unapproved' },
    @{ name = 'authorization'; value = $null }, @{ name = 'currentVersion'; value = '1.0.5' },
    @{ name = 'currentArchiveSha256'; value = ('0' * 64) }, @{ name = 'groups'; value = @() },
    @{ name = 'protectedFiles'; value = @() }
  )) {
    Reset
    $script:plan.($change.name) = $change.value
    Plan
    Reject { Run -Apply } ('Reviewed schema/current proof required: ' + $change.name) 'reviewed files and the current verified ZIP'
  }
  Reset
  $script:plan.protectedFiles = @($script:plan.protectedFiles | Where-Object { $_.path -ne $archivePath })
  Plan
  Reject { Run } 'Current ZIP must be explicitly protected' 'Current ZIP must be explicitly protected'
  Reset
  $script:plan.protectedFiles += $script:plan.protectedFiles[0]
  Plan
  Reject { Run } 'Duplicate protected members rejected' 'Duplicate protected'

  foreach ($scope in @(
    'assets/platform', 'artifacts/uno/validation/v106-final-layout-6',
    'artifacts/avalon/validation/portable-six-long-quest-final',
    'artifacts/rummikub/validation/ui-preview/final-authoritative-20261009',
    'artifacts/rummikub/validation/ui-preview/unknown-preview',
    'artifacts/uno/validation/v106-final-4/../v106-final-layout-6'
  )) {
    Reset
    $script:plan.groups[0].path = $scope
    Plan
    Reject { Run -Apply } ('Unreviewed, original or current final scope rejected: ' + $scope) 'scope remains protected'
  }
  Reset
  $script:plan.groups[1].path = 'artifacts/maintenance/v1.0.5/copy-test/bundle/assets'
  Plan
  Reject { Run } 'Derived scope requires exact generated work directory' 'exact generated bundle asset scopes'
  Reset
  $script:plan.groups[0].kind = 'unknown'
  Plan
  Reject { Run } 'Unknown image kind rejected' 'Unknown image copy kind'
  Reset
  $script:plan.groups[0].reason = ''
  Plan
  Reject { Run } 'Missing scope rationale rejected' 'unique scopes, reason and retained reports'
  Reset
  $script:plan.groups[0].evidence = @()
  Plan
  Reject { Run } 'Missing retained reports rejected' 'unique scopes, reason and retained reports'
  Reset
  $script:plan.groups[0].files = @()
  Plan
  Reject { Run } 'Empty image groups rejected' 'unique scopes, reason and retained reports'
  Reset
  $script:plan.groups += $script:plan.groups[0]
  Plan
  Reject { Run } 'Repeated group rejected' 'unique scopes, reason and retained reports'
  Reset
  $script:plan.groups[0].files += $script:plan.groups[0].files[0]
  Plan
  Reject { Run } 'Duplicate image member rejected' 'Duplicate, protected or invalid'
  Reset
  $alias = Member $screenPath
  $alias.path = $screenPath.Replace('/old-matrix', '//old-matrix')
  $script:plan.groups[0].files += $alias
  Plan
  Reject { Run } 'Double-slash alias cannot double-count one physical file' 'Invalid image audit path|Duplicate, protected or invalid'
  Reset
  $script:plan.protectedFiles += Member $screenPath
  Plan
  Reject { Run -Apply } 'Any protected/deletion overlap blocks the entire plan' 'Duplicate, protected or invalid'

  foreach ($invalidPath in @('../outside.png', 'C:/outside.png', 'artifacts\uno\validation\v106-final-4\old-matrix.png')) {
    Reset
    $script:plan.groups[0].files[0].path = $invalidPath
    Plan
    Reject { Run } ('Traversal, absolute or non-normalized member rejected: ' + $invalidPath) 'Invalid image audit path'
  }
  foreach ($outsideMember in @($originalPath, $savePath, $archivePath, $finalUnoPath)) {
    Reset
    $script:plan.groups[0].files = @((Member $outsideMember))
    Plan
    Reject { Run -Apply } ('Original, save, delivery or out-of-scope member rejected: ' + $outsideMember) 'Duplicate, protected or invalid'
  }
  foreach ($name in @('failure-host.png', 'failed-host.png')) {
    Reset
    $script:plan.groups[0].files = @((Member ('artifacts/uno/validation/v106-final-4/' + $name)))
    Plan
    Reject { Run -Apply } ('Unique failure image protected: ' + $name) 'Duplicate, protected or invalid'
  }

  Reset
  $script:plan.groups[0].files[0].sha256 = '0' * 64
  Plan
  Reject { Run -Apply } 'Changed image hash blocks deletion' 'Image audit member changed'
  Reset
  $script:plan.groups[0].files[0].bytes++
  Plan
  Reject { Run } 'Changed image size blocks deletion' 'Image audit member changed'
  Reset
  $script:plan.groups[0].evidence[0].sha256 = '0' * 64
  Plan
  Reject { Run } 'Changed retained report blocks deletion' 'Image audit member changed'
  Reset
  $script:plan.groups[0].evidence = @((Member $keyPath))
  Plan
  Reject { Run } 'An image cannot substitute for retained report evidence' 'Retained image copy reports'
  Reset
  $script:plan.groups[1].files[0].sourcePath = $keyPath
  Plan
  Reject { Run } 'Derivative source must be a retained product asset' 'retained original product asset'
  Reset
  File $originalPath 'changed-source-image-bytes'
  $script:plan.protectedFiles = @($script:plan.protectedFiles | ForEach-Object { if ($_.path -eq $originalPath) { Member $originalPath } else { $_ } })
  Plan
  Reject { Run -Apply } 'Derivative exact source equality cannot be bypassed with a revised protection record' 'Image audit member changed'
  Reset
  File $proofPath '{"portable":true,"result":"failed","archiveSha256":"unmatched"}'
  Plan
  Reject { Run -Apply } 'Passing portable proof for the exact ZIP is required' 'No passing portable evidence matches'
  Reset
  File $archivePath 'mutated-current-zip'
  Plan
  Reject { Run -Apply } 'Changed current ZIP cannot use old portable proof' 'No passing portable evidence matches'

  Reset
  File 'docs/reference/fixture.md' ('[keep image](/' + $screenPath + ')')
  Plan
  Age
  Reject { Run -Apply } 'Direct document image references protect a listed candidate' 'Document-linked image remains protected'
  Reset
  File 'README.md' ('[keep image](' + $screenPath.Replace('/', '\') + ')')
  Plan
  Age
  Reject { Run } 'README backslash image references remain protected' 'Document-linked image remains protected'
  Reset
  New-Item -ItemType Directory -Path (Join-Path $fixture 'artifacts/uno/validation/v106-final-4/.git') -Force | Out-Null
  Reject { Run -Apply } 'Nested repository within a selected group blocks deletion' 'Nested repository remains protected'
  Remove-Item -LiteralPath (Join-Path $fixture 'artifacts/uno/validation/v106-final-4/.git') -Force
  Reset
  $linkPath = Join-Path $fixture 'artifacts/uno/validation/v106-final-4/linked'
  $linkTarget = Join-Path $fixture 'tmp/junction-source'
  File 'tmp/junction-source/old-matrix.png' 'obsolete-matrix-image'
  New-Item -ItemType Junction -Path $linkPath -Target $linkTarget -Force | Out-Null
  $links.Add($linkPath)
  $linkedMember = Member 'tmp/junction-source/old-matrix.png'
  $junctionTargetBefore = Member 'tmp/junction-source/old-matrix.png'
  $linkedMember.path = 'artifacts/uno/validation/v106-final-4/linked/old-matrix.png'
  $script:plan.groups[0].files = @($linkedMember)
  Plan
  Reject { Run -Apply } 'Junction ancestor protects a listed member' 'refuses reparse points'
  Remove-FixtureJunction $linkPath
  $links.Remove($linkPath) | Out-Null
  $junctionTargetAfter = Member 'tmp/junction-source/old-matrix.png'
  Check ($junctionTargetAfter.bytes -eq $junctionTargetBefore.bytes -and $junctionTargetAfter.sha256 -eq $junctionTargetBefore.sha256) 'Nonrecursive junction removal preserves the target file byte-for-byte'
  Reset
  (Get-Item -LiteralPath (Join-Path $fixture $screenPath)).LastWriteTimeUtc = [DateTime]::UtcNow
  Reject { Run -Apply } 'Recently modified candidate is rejected' 'Recently modified image remains protected'
  Reset
  $script:plan.groups = @($script:plan.groups[0])
  Plan
  Age
  (Get-Item -LiteralPath (Join-Path $fixture $keyPath)).LastWriteTimeUtc = [DateTime]::UtcNow
  Run -Apply | Out-Null
  CandidatesRemain
  Check $true 'Recent unlisted evidence in the candidate group protects its entire directory snapshot'
  Reset
  $global:TableMaxImageCopyFixtureProcessInventory = @([PSCustomObject]@{
    ProcessId = 987651
    ParentProcessId = 0
    Name = 'node.exe'
    ExecutablePath = Join-Path $fixture 'runtime/node.exe'
    CommandLine = 'node "' + (Join-Path $fixture 'tools/test/fixture.mjs') + '"'
    CreationDate = [DateTime]::UtcNow
  })
  Reject { Run -Apply } 'Busy fixture engineering process blocks exact-image deletion' 'Busy PIDs: 987651'

  ChangedDuringApply { File $screenPath 'changed-matrix-image' } 'Member content changed after preview blocks deletion' 'Candidate changed before deletion|Image audit member changed'
  ChangedDuringApply { File $originalPath 'changed-source-image' } 'Source content changed after preview blocks deletion' 'Image audit member changed|Protected evidence changed' 1
  ChangedDuringApply { File $screenReport '{"result":"changed"}' } 'Report changed after preview blocks deletion' 'Candidate changed before deletion|Image audit member changed'
  ChangedDuringApply { File $archivePath 'changed-runtime-zip' } 'ZIP changed after preview blocks deletion' 'Current ZIP changed during cleanup|Image audit member changed|Protected evidence changed'
  ChangedDuringApply { File $keyPath 'changed-key-image' } 'Protected key image changed after preview blocks deletion' 'Candidate changed before deletion|Image audit member changed|Protected evidence changed'
  ChangedDuringApply { File 'README.md' '# Document changed during cleanup' } 'Documentation changed after reference audit blocks deletion' 'Documentation changed after image reference audit'
  ChangedDuringApply { File $manifestPath '{"changed":true}' } 'Manifest changed after preview blocks deletion' 'Image copy manifest changed'

  Reset
  $removedMembers = @($script:plan.groups | ForEach-Object { $_.files })
  $expectedBytes = [long](($removedMembers | Measure-Object -Property bytes -Sum).Sum)
  $protectedBefore = @($script:plan.protectedFiles + @((Member $screenReport), (Member $copyReport)))
  Run -Apply | Out-Null
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture $screenPath))) 'Apply removes exactly the reviewed superseded screenshot'
  Check (-not (Test-Path -LiteralPath (Join-Path $fixture $copyPath))) 'Apply removes exactly the same-SHA generated image copy'
  foreach ($preserved in $protectedBefore) {
    $after = Member $preserved.path
    if ($after.bytes -ne $preserved.bytes -or $after.sha256 -ne $preserved.sha256) {
      throw ('Protected file changed in successful cleanup: ' + $preserved.path)
    }
  }
  Check $true 'Successful Apply preserves reports, key PNG, saves, source asset, current ZIP, manifest and final proofs byte-for-byte'
  Check ((Test-Path -LiteralPath (Join-Path $fixture $script:plan.groups[0].path) -PathType Container) -and
         (Test-Path -LiteralPath (Join-Path $fixture $script:plan.groups[1].path) -PathType Container)) 'Apply retains both source evidence directories'
  $reports = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'artifacts/maintenance') -Filter cleanup.json -Recurse | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8 | ConvertFrom-Json })
  $successful = @($reports | Where-Object { $_.result -eq 'passed' -and $_.deletedBytes -eq $expectedBytes -and $_.candidates.Count -eq 2 })
  Check ($successful.Count -eq 1) 'Successful report records exact selected logical bytes and both groups'
  $manifestHash = (Get-FileHash -LiteralPath (Join-Path $fixture $manifestPath) -Algorithm SHA256).Hash
  Check ($successful[0].imageCopiesManifestSha256 -eq $manifestHash) 'Successful report binds the exact reviewed manifest SHA-256'
  $reportedProtected = @($successful[0].protectedImageFiles)
  $protectedMismatch = @($reportedProtected | Where-Object {
    $record = $_
    $expected = @($script:plan.protectedFiles | Where-Object { $_.path -eq $record.path })
    $expected.Count -ne 1 -or $expected[0].sha256 -ne $record.sha256 -or $expected[0].bytes -ne $record.bytes
  })
  Check ($reportedProtected.Count -eq $script:plan.protectedFiles.Count -and $protectedMismatch.Count -eq 0) 'Successful report preserves the complete protected-file paths, sizes and original hashes'
  $reportedMembers = @($successful[0].candidates | ForEach-Object { $_.imageCopies.files })
  $matched = @($reportedMembers | Where-Object { $_.sha256 -in $removedMembers.sha256 })
  Check ($reportedMembers.Count -eq 2 -and $matched.Count -eq 2) 'Deletion report retains exact removed hashes and source binding'
  Check ($global:TableMaxImageCopyFixtureIdleCalls -ge 3) 'Apply rechecks the controlled idle inventory before group deletion'
  $passed = $true
}
catch {
  $failure = $_.Exception.Message
  throw
}
finally {
  if (-not $EvidenceDirectory) { $EvidenceDirectory = Join-Path $testProject 'artifacts/maintenance/image-copy-tools' }
  New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
  @{
    result = $(if ($passed) { 'passed' } else { 'failed' })
    count = $checks.Count
    checks = $checks.ToArray()
    failure = $failure
    scope = 'Isolated copied maintenance source in a space/Unicode fixture root; controlled Win32_Process idle/busy inventory only in this test. No actual project candidate deletion.'
    startedAt = $startedAt.ToString('o')
    elapsedSeconds = [Math]::Round(([DateTime]::UtcNow - $startedAt).TotalSeconds, 3)
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'results.json') -Encoding utf8
  foreach ($link in $links) {
    $absoluteLink = [IO.Path]::GetFullPath($link)
    if (-not $absoluteLink.StartsWith($fixture + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture link escapes root.' }
    if (Test-Path -LiteralPath $absoluteLink) { Remove-FixtureJunction $absoluteLink }
  }
  if (Test-Path -LiteralPath $fixture) {
    $absolute = [IO.Path]::GetFullPath($fixture)
    if (-not $absolute.StartsWith($testProject + '\tmp\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture escapes project tmp.' }
    Remove-Item -LiteralPath $absolute -Recurse -Force
  }
  $env:TABLEMAX_MAINTENANCE_COORDINATOR = $oldCoordinator
  foreach ($name in @($inventoryVariable, $hookVariable, $callVariable)) {
    if ($savedVariables[$name]) { Set-Variable -Name $name -Value $savedVariables[$name].Value -Scope Global }
    else { Remove-Variable -Name $name -Scope Global -ErrorAction SilentlyContinue }
  }
  if ($passed) { Write-Host ($checks.Count.ToString() + ' reviewed image retirement checks passed.') }
}
