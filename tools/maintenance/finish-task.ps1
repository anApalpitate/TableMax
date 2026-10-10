[CmdletBinding()]
param([string]$CoordinatorPath, [Parameter(Mandatory)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
# PowerShell 7 hosts may pass incompatible module paths to Windows PowerShell.
# Prefer this child's built-in modules without changing the user's environment.
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$taskOutput = [IO.Path]::GetFullPath($OutputDirectory)
if (-not $taskOutput.StartsWith($taskWorkspace + '\artifacts\maintenance\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Maintenance output outside workspace evidence.' }
Set-Location -LiteralPath $taskWorkspace
$taskReport = [ordered]@{startedAtUtc=[DateTime]::UtcNow.ToString('o'); result='started'; stages=@(); errors=@()}
try {
  if ($CoordinatorPath) { $env:TABLEMAX_MAINTENANCE_COORDINATOR = $CoordinatorPath }
  $workspace = $taskWorkspace; $sourceWorkspace = $taskWorkspace
  . (Join-Path $taskWorkspace 'tools/maintenance/cleanup-guard.ps1')
  Write-Host 'Checking engineering idle and verified current package...'
  Assert-Idle
  $taskProject = Get-Content -LiteralPath (Join-Path $taskWorkspace 'package.json') -Raw -Encoding utf8 | ConvertFrom-Json
  $taskArchive = Join-Path $taskWorkspace ('artifacts/releases/TableMax-' + $taskProject.version + '-win-x64.zip')
  $taskArchiveHash = (Get-FileHash -LiteralPath $taskArchive).Hash.ToLowerInvariant()
  if (-not ('TableMax.WorkspaceSnapshotV2' -as [type])) { Add-Type -Path (Join-Path $taskWorkspace 'tools/maintenance/WorkspaceSnapshot.cs') }
  $taskPortableProof = $null
  foreach ($taskProofPath in [TableMax.WorkspaceSnapshotV2]::FindReports((Join-Path $taskWorkspace 'artifacts/maintenance'))) {
    try { $taskProof = Get-Content -LiteralPath $taskProofPath -Raw -Encoding utf8 | ConvertFrom-Json } catch { continue }
    if ($taskProof.portable -eq $true -and $taskProof.result -eq 'passed' -and $taskProof.archiveSha256 -eq $taskArchiveHash) { $taskPortableProof = $taskProofPath; break }
  }
  if (-not $taskPortableProof) { throw 'No matching passing portable evidence; automatic maintenance preserved all files.' }
  $taskReport.archiveSha256 = $taskArchiveHash; $taskReport.portableProof = $taskPortableProof
  $env:TABLEMAX_MAINTENANCE_CHILD = '1'
  Write-Host 'Previewing and pruning expired build cache...'
  & node (Join-Path $taskWorkspace 'tools/maintenance/clean-build-cache.mjs')
  if ($LASTEXITCODE) { throw 'Build-cache preview failed; nothing further removed.' }
  & node (Join-Path $taskWorkspace 'tools/maintenance/clean-build-cache.mjs') --apply
  if ($LASTEXITCODE) { throw 'Build-cache cleanup failed.' }
  $taskReport.stages += 'build-cache'
  $taskPlan = Join-Path $taskOutput 'retirement-plan.json'
  & node (Join-Path $PSScriptRoot 'verification-artifacts.mjs') $taskPlan
  if ($LASTEXITCODE) { throw 'Registered-artifact plan failed.' }
  $taskSelection = Get-Content -LiteralPath $taskPlan -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskSelection.entries.Count) {
    & (Join-Path $taskWorkspace 'tools/maintenance/cleanup-local.ps1') -Kind Intermediates -RegisteredArtifactsManifest $taskPlan
    & (Join-Path $taskWorkspace 'tools/maintenance/cleanup-local.ps1') -Kind Intermediates -RegisteredArtifactsManifest $taskPlan -Apply
  }
  $taskReport.stages += 'registered-artifacts'
  $taskReport.capacity = & (Join-Path $taskWorkspace 'Maintain-Project.ps1') -Apply
  $taskReport.result = 'completed'
} catch {
  $taskReport.result = 'blocked'; $taskReport.errors += $_.Exception.Message
  Write-Host ('Automatic maintenance preserved remaining files: ' + $_.Exception.Message)
} finally {
  $taskReport.finishedAtUtc = [DateTime]::UtcNow.ToString('o')
  $taskReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskOutput 'result.json') -Encoding utf8
}
