[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$DeliveryPath,
  [Parameter(Mandatory)][string]$OutputDirectory,
  [string]$HandoffPreparedReport,
  [switch]$AllowTemporaryAccount,
  [switch]$UseProfileAcceptance,
  [switch]$PortableMigrationOnly,
  [string]$PortablePointer,
  [ValidateSet('active-uninstall', 'startup-external-data', 'long-root-external-data', 'chains')][string]$FixtureScenario,
  [int]$PriorFailures = 0
)
$ErrorActionPreference = 'Stop'
$taskRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..')).TrimEnd('\')
$taskOutput = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')
$taskDelivery = [IO.Path]::GetFullPath($DeliveryPath)
$taskHandoffPreparedReport = $null
$taskPortablePointer = $null
if ($FixtureScenario -and ($PortableMigrationOnly -or -not $UseProfileAcceptance)) { throw 'Fixture-only acceptance requires UseProfileAcceptance and excludes portable migration.' }
if ($PortableMigrationOnly) {
  if (-not $UseProfileAcceptance -or [string]::IsNullOrWhiteSpace($PortablePointer)) { throw 'Portable migration requires UseProfileAcceptance and a frozen PortablePointer copy.' }
  if (-not [string]::IsNullOrWhiteSpace($HandoffPreparedReport)) { throw 'Portable migration is independent of the application handoff prepared report.' }
  $taskPortablePointer = [IO.Path]::GetFullPath($PortablePointer)
} else {
  if ([string]::IsNullOrWhiteSpace($HandoffPreparedReport)) { throw 'The complete application chain requires HandoffPreparedReport.' }
  if (-not $UseProfileAcceptance) { throw 'The complete default-D and long-root external-D chains require UseProfileAcceptance.' }
  if (-not [string]::IsNullOrWhiteSpace($PortablePointer)) { throw 'PortablePointer is only valid with PortableMigrationOnly.' }
  $taskHandoffPreparedReport = [IO.Path]::GetFullPath($HandoffPreparedReport)
}
function Write-TaskJson([string]$Path, $Value, [int]$Depth = 100) {
  [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth $Depth) + "`n", [Text.UTF8Encoding]::new($false))
}
function Write-TaskNewJson([string]$Path, $Value) {
  $taskJsonBytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 100) + "`n")
  $taskNewJson = [IO.FileStream]::new($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $taskNewJson.Write($taskJsonBytes, 0, $taskJsonBytes.Length); $taskNewJson.Flush($true) }
  finally { $taskNewJson.Dispose() }
}
function Assert-TaskPathNoLinks([string]$Path) {
  for ($taskCursor = [IO.Path]::GetFullPath($Path); $taskCursor; $taskCursor = [IO.Path]::GetDirectoryName($taskCursor)) {
    if (Test-Path -LiteralPath $taskCursor) {
      if ((Get-Item -LiteralPath $taskCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Verification path contains a link.' }
    }
  }
}
function Get-TaskSourceRecord([string]$Path) {
  $taskSourcePath = [IO.Path]::GetFullPath($Path)
  Assert-TaskPathNoLinks $taskSourcePath
  if (-not [IO.File]::Exists($taskSourcePath)) { throw ('Required acceptance source is not a file: ' + $taskSourcePath) }
  $taskSourceStream = [IO.File]::Open($taskSourcePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  $taskSourceHash = [Security.Cryptography.SHA256]::Create()
  try {
    $taskSourceBytes = $taskSourceStream.Length
    $taskSourceDigest = [BitConverter]::ToString($taskSourceHash.ComputeHash($taskSourceStream)).Replace('-', '').ToLowerInvariant()
    if ($taskSourceBytes -lt 1 -or $taskSourceStream.Length -ne $taskSourceBytes) { throw 'Required acceptance source is empty or changed while reading.' }
    return [ordered]@{ path = $taskSourcePath; bytes = $taskSourceBytes; sha256 = $taskSourceDigest }
  } finally { $taskSourceHash.Dispose(); $taskSourceStream.Dispose() }
}
function Assert-TaskSourceRecords($Sources) {
  foreach ($taskExpectedSource in @($Sources)) {
    $taskActualSource = Get-TaskSourceRecord $taskExpectedSource.path
    if ($taskActualSource.bytes -ne $taskExpectedSource.bytes -or $taskActualSource.sha256 -ne $taskExpectedSource.sha256) { throw ('Acceptance method source changed: ' + $taskExpectedSource.path) }
  }
}
function Get-TaskMethodFingerprint($Sources) {
  $taskMethodSources = @($Sources | ForEach-Object { [ordered]@{ path = $_.path; bytes = $_.bytes; sha256 = $_.sha256 } })
  $taskMethodJson = [ordered]@{ schemaVersion = 1; sources = $taskMethodSources } | ConvertTo-Json -Depth 6 -Compress
  $taskMethodHash = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($taskMethodHash.ComputeHash([Text.UTF8Encoding]::new($false).GetBytes($taskMethodJson))).Replace('-', '').ToLowerInvariant() }
  finally { $taskMethodHash.Dispose() }
}
function Get-TaskExecutionMethod([string]$NodePath, [string]$EntrypointPath, [string]$Repository) {
  if ($EntrypointPath.Contains('"')) { throw 'Unsafe execution-method entrypoint.' }
  $taskMethodStart = [Diagnostics.ProcessStartInfo]::new($NodePath)
  $taskMethodStart.Arguments = '"' + $EntrypointPath + '"'
  $taskMethodStart.WorkingDirectory = $Repository
  $taskMethodStart.UseShellExecute = $false
  $taskMethodStart.CreateNoWindow = $true
  $taskMethodStart.RedirectStandardOutput = $true
  $taskMethodStart.RedirectStandardError = $true
  $taskMethodStart.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
  $taskMethodStart.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
  $taskMethodProcess = $null
  try {
    $taskMethodProcess = [Diagnostics.Process]::Start($taskMethodStart)
    if (-not $taskMethodProcess) { throw 'The execution-method reader did not start.' }
    $null = $taskMethodProcess.Handle
    $taskMethodOutput = $taskMethodProcess.StandardOutput.ReadToEndAsync()
    $taskMethodError = $taskMethodProcess.StandardError.ReadToEndAsync()
    if (-not $taskMethodProcess.WaitForExit(60000)) { throw 'The execution-method reader exceeded its bounded budget.' }
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($taskMethodOutput, $taskMethodError), 5000)) { throw 'The execution-method reader output did not drain.' }
    $taskMethodProcess.Refresh()
    if ($taskMethodProcess.ExitCode -ne 0) { throw ('Execution-method preflight failed: ' + $taskMethodError.Result) }
    # PS 5.1 returns a JSON array as one pipeline object. Do not wrap that
    # pipeline in @(...), which adds another array level and reports Count=1.
    $taskMethodRootArray = ConvertFrom-Json -InputObject $taskMethodOutput.Result
    if ($taskMethodRootArray -isnot [Array]) { throw 'The execution-method reader must return a root JSON array.' }
    $taskDeclaredSources = $taskMethodRootArray
  } finally {
    if ($taskMethodProcess) {
      if (-not $taskMethodProcess.HasExited) { $taskMethodProcess.Kill(); $null = $taskMethodProcess.WaitForExit(5000) }
      $taskMethodProcess.Dispose()
    }
  }
  if ($taskDeclaredSources.Count -lt 2) { throw 'The execution-method reader returned incomplete source records.' }
  $taskMethodPaths = @{}
  $taskSources = @()
  foreach ($taskDeclaredSource in $taskDeclaredSources) {
    if ($taskDeclaredSource -isnot [PSCustomObject]) { throw 'Execution-method source entries must be JSON objects.' }
    $taskMethodPath = [IO.Path]::GetFullPath((Join-Path $Repository $taskDeclaredSource.path))
    if (-not $taskMethodPath.StartsWith($Repository + '\', [StringComparison]::OrdinalIgnoreCase) -or $taskDeclaredSource.sha256 -notmatch '^[a-f0-9]{64}$' -or $taskDeclaredSource.bytes -lt 1 -or $taskMethodPaths.ContainsKey($taskMethodPath.ToLowerInvariant())) { throw 'Execution-method source scope, identity or uniqueness is invalid.' }
    $taskMethodPaths[$taskMethodPath.ToLowerInvariant()] = $true
    $taskActualMethod = Get-TaskSourceRecord $taskMethodPath
    if ($taskActualMethod.bytes -ne $taskDeclaredSource.bytes -or $taskActualMethod.sha256 -ne $taskDeclaredSource.sha256) { throw 'Execution-method source changed during preflight.' }
    $taskSources += $taskActualMethod
  }
  foreach ($taskRequiredMethod in @('verify-production-user.ps1', 'verify-production-user-child.ps1')) {
    $taskRequiredMethodPath = [IO.Path]::GetFullPath((Join-Path $Repository ('tools/test/installation/' + $taskRequiredMethod)))
    if (-not $taskMethodPaths.ContainsKey($taskRequiredMethodPath.ToLowerInvariant())) { throw 'Execution-method sources must include the parent and isolated child.' }
  }
  return $taskSources
}
function Get-TaskFailureBudget([string]$NodePath, [string]$PolicyPath, [string]$Repository, [int]$PriorFailures) {
  if ($PolicyPath.Contains('"')) { throw 'Unsafe failure-policy entrypoint.' }
  $taskPolicySource = Get-TaskSourceRecord $PolicyPath
  $taskPolicyStart = [Diagnostics.ProcessStartInfo]::new($NodePath)
  $taskPolicyStart.Arguments = '"' + $PolicyPath + '"'
  $taskPolicyStart.WorkingDirectory = $Repository
  $taskPolicyStart.UseShellExecute = $false
  $taskPolicyStart.CreateNoWindow = $true
  $taskPolicyStart.RedirectStandardOutput = $true
  $taskPolicyStart.RedirectStandardError = $true
  $taskPolicyStart.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
  $taskPolicyStart.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
  $taskPolicyProcess = $null
  try {
    $taskPolicyProcess = [Diagnostics.Process]::Start($taskPolicyStart)
    if (-not $taskPolicyProcess) { throw 'The failure-policy reader did not start.' }
    $null = $taskPolicyProcess.Handle
    $taskPolicyOutput = $taskPolicyProcess.StandardOutput.ReadToEndAsync()
    $taskPolicyError = $taskPolicyProcess.StandardError.ReadToEndAsync()
    if (-not $taskPolicyProcess.WaitForExit(60000)) { throw 'The failure-policy reader exceeded its bounded budget.' }
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($taskPolicyOutput, $taskPolicyError), 5000)) { throw 'The failure-policy reader output did not drain.' }
    $taskPolicyProcess.Refresh()
    if ($taskPolicyProcess.ExitCode -ne 0) { throw ('Failure-policy preflight failed: ' + $taskPolicyError.Result) }
    $taskPolicy = ConvertFrom-Json -InputObject $taskPolicyOutput.Result
    if ($taskPolicy -isnot [PSCustomObject] -or (@($taskPolicy.PSObject.Properties.Name | Sort-Object) -join ',') -ne 'failureLimit,schemaVersion' -or $taskPolicy.schemaVersion -ne 1 -or ($taskPolicy.failureLimit -isnot [int] -and $taskPolicy.failureLimit -isnot [long]) -or $taskPolicy.failureLimit -lt 1 -or $taskPolicy.failureLimit -gt 1000) { throw 'The shared failure-policy result is invalid.' }
    if ($PriorFailures -lt 0 -or $PriorFailures -ge $taskPolicy.failureLimit) { throw 'The current cumulative failures already exhaust the shared execution budget.' }
    Assert-TaskSourceRecords @($taskPolicySource)
    return [int]$taskPolicy.failureLimit
  } finally {
    if ($taskPolicyProcess) {
      if (-not $taskPolicyProcess.HasExited) { $taskPolicyProcess.Kill(); $null = $taskPolicyProcess.WaitForExit(5000) }
      $taskPolicyProcess.Dispose()
    }
  }
}
function Copy-TaskSourceFile([string]$SourcePath, [string]$TargetPath, $Expected) {
  if ([IO.Path]::GetFullPath($SourcePath) -ne [IO.Path]::GetFullPath($Expected.path)) { throw 'The acceptance execution copy source path changed.' }
  Assert-TaskSourceRecords @($Expected)
  Assert-TaskPathNoLinks $TargetPath
  $taskChildInput = [IO.File]::Open($SourcePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  try {
    $taskChildOutput = [IO.FileStream]::new($TargetPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $taskChildInput.CopyTo($taskChildOutput); $taskChildOutput.Flush($true) }
    finally { $taskChildOutput.Dispose() }
  } finally { $taskChildInput.Dispose() }
  $taskCopiedChild = Get-TaskSourceRecord $TargetPath
  if ($taskCopiedChild.bytes -ne $Expected.bytes -or $taskCopiedChild.sha256 -ne $Expected.sha256) { throw 'The acceptance execution copy differs from the frozen source.' }
  Assert-TaskSourceRecords @($Expected)
  return [ordered]@{ sourcePath = $Expected.path; path = $taskCopiedChild.path; bytes = $taskCopiedChild.bytes; sha256 = $taskCopiedChild.sha256 }
}
function Write-TaskExecutionReceipt([string]$OutputDirectory, $Delivery, [string]$ProofPath, [string]$IsolationPath, $MethodSources) {
  $taskReceiptIsolation = Get-Content -LiteralPath $IsolationPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskReceiptIsolation.result -ne 'passed' -or $taskReceiptIsolation.exitCode -ne 0 -or $taskReceiptIsolation.accountRemoved -ne $true -or $taskReceiptIsolation.profileRemoved -ne $true -or @($taskReceiptIsolation.errors).Count -ne 0) { throw 'Execution receipt requires successful actual exit and account/profile cleanup.' }
  Assert-TaskSourceRecords $MethodSources
  Assert-TaskSourceRecords @($Delivery)
  $taskRawProof = Get-TaskSourceRecord $ProofPath
  $taskPreservedProofPath = Join-Path $OutputDirectory 'execution-proof.json'
  $taskPreservedProof = Copy-TaskSourceFile $ProofPath $taskPreservedProofPath $taskRawProof
  $taskIsolationRecord = Get-TaskSourceRecord $IsolationPath
  $taskReceipt = [ordered]@{
    schemaVersion = 1
    kind = 'installation-execution-receipt'
    delivery = $Delivery
    proof = [ordered]@{ path = $taskPreservedProof.path; bytes = $taskPreservedProof.bytes; sha256 = $taskPreservedProof.sha256 }
    isolation = $taskIsolationRecord
    methodSources = @($MethodSources)
    methodSha256 = (Get-TaskMethodFingerprint $MethodSources)
    exitCode = $taskReceiptIsolation.exitCode
    accountRemoved = $taskReceiptIsolation.accountRemoved
    profileRemoved = $taskReceiptIsolation.profileRemoved
    ownerSid = $taskReceiptIsolation.ownerSid
  }
  $taskReceiptPath = Join-Path $OutputDirectory 'execution-receipt.json'
  Assert-TaskPathNoLinks $taskReceiptPath
  Write-TaskNewJson $taskReceiptPath $taskReceipt
  return Get-TaskSourceRecord $taskReceiptPath
}
function Assert-TaskAcceptanceEnvironment([string]$PowerShellPath, [string]$NodePath, [string]$ChildPath, [string[]]$Entrypoints, [scriptblock]$ResolveCommand = { param($Name) Get-Command -Name $Name -CommandType Cmdlet -ErrorAction Stop }) {
  $taskPowerShellSource = Get-TaskSourceRecord $PowerShellPath
  $taskNodeSource = Get-TaskSourceRecord $NodePath
  $taskChildSource = Get-TaskSourceRecord $ChildPath
  $taskChildTokens = $null
  $taskChildErrors = $null
  $null = [Management.Automation.Language.Parser]::ParseFile($ChildPath, [ref]$taskChildTokens, [ref]$taskChildErrors)
  if (@($taskChildErrors).Count -ne 0) { throw 'The isolated child source has PowerShell syntax errors.' }
  $taskEntrypointSources = @($Entrypoints | ForEach-Object { Get-TaskSourceRecord $_ })
  $taskRequiredCommands = @('New-LocalUser', 'Get-LocalUser', 'Remove-LocalUser', 'Add-LocalGroupMember', 'Get-CimInstance', 'Invoke-CimMethod', 'Remove-CimInstance', 'Get-Acl', 'Set-Acl', 'Start-Process')
  foreach ($taskRequiredCommand in $taskRequiredCommands) {
    if (-not (& $ResolveCommand $taskRequiredCommand)) { throw ('Required acceptance command is unavailable: ' + $taskRequiredCommand) }
  }
  return [ordered]@{ powershell = $taskPowerShellSource; node = $taskNodeSource; child = $taskChildSource; entrypoints = $taskEntrypointSources; commands = $taskRequiredCommands }
}
if (-not $taskOutput.StartsWith($taskRepository + '\artifacts\maintenance\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Evidence must remain inside workspace maintenance.' }
if (-not $taskDelivery.StartsWith($taskRepository + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Delivery must be a workspace file.' }
Assert-TaskPathNoLinks $taskDelivery
if ($taskHandoffPreparedReport) {
  if (-not $taskHandoffPreparedReport.StartsWith($taskRepository + '\artifacts\maintenance\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Prepared handoff evidence must be a workspace maintenance file.' }
  Assert-TaskPathNoLinks $taskHandoffPreparedReport
}
if ($taskPortablePointer) {
  if (-not $taskPortablePointer.StartsWith($taskRepository + '\artifacts\maintenance\', [StringComparison]::OrdinalIgnoreCase)) { throw 'PortablePointer must be a frozen workspace maintenance copy.' }
  Assert-TaskPathNoLinks $taskPortablePointer
}
Assert-TaskPathNoLinks $taskOutput
if (Test-Path -LiteralPath $taskOutput) { throw 'Use a new evidence directory; old results are preserved.' }
if (-not $AllowTemporaryAccount) { throw 'Explicit authorization for a temporary standard Windows account is required.' }
$taskAdministrator = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $taskAdministrator.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'This isolated-account verifier needs administrator consent; it does not self-elevate.' }
$taskDeliveryData = Get-Content -LiteralPath $taskDelivery -Raw -Encoding utf8 | ConvertFrom-Json
if ($taskDeliveryData.deliveryType -ne 'installer' -or $taskDeliveryData.executable.installation.productId -ne '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}') { throw 'A sealed production installer is required.' }
if (-not ([IO.Path]::GetFullPath($taskDeliveryData.executable.path)).StartsWith($taskRepository + '\artifacts\releases\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Production installer must be the sealed workspace release artifact.' }
Assert-TaskPathNoLinks $taskDeliveryData.executable.path
if ((Get-FileHash -LiteralPath $taskDeliveryData.executable.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskDeliveryData.executable.sha256) { throw 'Installer bytes changed.' }
$taskDeliveryBytes = (Get-Item -LiteralPath $taskDelivery).Length
$taskDeliverySha256 = (Get-FileHash -LiteralPath $taskDelivery -Algorithm SHA256).Hash.ToLowerInvariant()
$taskFixturePrepared = $null
$taskFixturePreparedSha256 = $null
$taskFixtureEvidenceRecords = @()
if (-not $PortableMigrationOnly) {
  $taskFixturePreparedSha256 = (Get-FileHash -LiteralPath $taskHandoffPreparedReport -Algorithm SHA256).Hash.ToLowerInvariant()
  $taskFixturePrepared = Get-Content -LiteralPath $taskHandoffPreparedReport -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskFixturePrepared.result -ne 'prepared-not-executed' -or $taskFixturePrepared.failures -ne 0 -or $taskFixturePrepared.fixtureId -ne '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}') { throw 'Fixture-only acceptance requires an exact unexecuted prepared fixture pair.' }
  foreach ($taskRole in @('old', 'new')) {
    $taskFixtureSource = $taskFixturePrepared.$taskRole.delivery.executable
    $taskFixtureSourcePath = [IO.Path]::GetFullPath($taskFixtureSource.path)
    if (-not $taskFixtureSourcePath.StartsWith($taskRepository + '\', [StringComparison]::OrdinalIgnoreCase) -or $taskFixtureSource.installation.productId -ne $taskFixturePrepared.fixtureId -or $taskFixtureSource.bytes -lt 1 -or $taskFixtureSource.bytes -ge 120000000 -or $taskFixtureSource.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Prepared fixture source identity or workspace scope is invalid.' }
    Assert-TaskPathNoLinks $taskFixtureSourcePath
    if ((Get-Item -LiteralPath $taskFixtureSourcePath).Length -ne $taskFixtureSource.bytes -or (Get-FileHash -LiteralPath $taskFixtureSourcePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskFixtureSource.sha256) { throw 'Prepared fixture source bytes changed.' }
  }
  $taskFixtureDriverSha256 = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Read-TaskFixtureEvidence([string]$Path, [string]$Scenario, [string[]]$RequiredSteps) {
  Assert-TaskPathNoLinks $Path
  $taskFixtureProof = Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskFixtureProof.format -ne 1 -or $taskFixtureProof.fixtureId -ne '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}' -or $taskFixtureProof.scenario -ne $Scenario -or $taskFixtureProof.result -ne 'passed' -or $taskFixtureProof.failures -ne 0 -or @($taskFixtureProof.steps).Count -eq 0 -or @($taskFixtureProof.steps | Where-Object { $_.result -ne 'passed' -or [string]::IsNullOrWhiteSpace($_.id) }).Count -ne 0) { throw 'The actual fixture scenario did not pass every recorded step.' }
  if (@($taskFixtureProof.steps | Group-Object id | Where-Object { $_.Count -ne 1 }).Count -ne 0) { throw 'Fixture step IDs must be unique.' }
  foreach ($taskRequiredStep in $RequiredSteps) {
    if (@($taskFixtureProof.steps | Where-Object { $_.id -eq $taskRequiredStep -and $_.result -eq 'passed' }).Count -ne 1) { throw 'The fixture scenario is missing a required unique completed step.' }
  }
  if (@($taskFixtureProof.steps).Count -ne $RequiredSteps.Count) { throw 'Each fixture scenario must contain exactly its required unique steps.' }
  if ([IO.Path]::GetFullPath($taskFixtureProof.preparedInput.path) -ne $taskHandoffPreparedReport -or $taskFixtureProof.preparedInput.sha256 -ne $taskFixturePreparedSha256 -or (Get-FileHash -LiteralPath $taskHandoffPreparedReport -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskFixturePreparedSha256) { throw 'The actual fixture scenario does not bind the original prepared report raw bytes.' }
  $taskExecutionProfile = $taskFixtureProof.executionProfile
  if ($taskExecutionProfile.root -ne $taskReport.profileAcceptanceRoot -or $taskExecutionProfile.ownerSid -ne $taskCreatedSid.Value -or $taskExecutionProfile.integritySid -ne 'S-1-16-8192' -or [IO.Path]::GetFullPath($taskExecutionProfile.workParent) -ne (Join-Path $taskReport.profileAcceptanceRoot 'work') -or [IO.Path]::GetFullPath($taskExecutionProfile.profile) -ne [IO.Path]::GetFullPath($taskUserIdentity.profile) -or [IO.Path]::GetFullPath($taskExecutionProfile.localAppData) -ne [IO.Path]::GetFullPath($taskUserIdentity.localAppData)) { throw 'The actual fixture scenario did not prove this isolated standard Medium profile.' }
  if ([IO.Path]::GetFullPath($taskFixtureProof.scopeRoot) -ne $taskReport.profileAcceptanceRoot -or -not [IO.Path]::GetFullPath($taskFixtureProof.root).StartsWith($taskReport.profileAcceptanceRoot + '\work\', [StringComparison]::OrdinalIgnoreCase)) { throw 'The actual fixture root escaped the private profile work scope.' }
  Assert-TaskPathNoLinks $taskFixtureProof.root
  foreach ($taskRole in @('old', 'new')) {
    $taskFrozenExecutable = $taskFixturePrepared.$taskRole.delivery.executable
    $taskReportedExecutable = $taskFixtureProof.$taskRole.delivery.executable
    $taskActualExecutable = $taskFixtureProof.actualExecutionInputs.$taskRole
    if ([IO.Path]::GetFullPath($taskReportedExecutable.path) -ne [IO.Path]::GetFullPath($taskFrozenExecutable.path) -or $taskReportedExecutable.bytes -ne $taskFrozenExecutable.bytes -or $taskReportedExecutable.sha256 -ne $taskFrozenExecutable.sha256 -or $taskReportedExecutable.installation.productId -ne $taskFixturePrepared.fixtureId) { throw 'The fixture report changed the prepared installer source identity.' }
    if ([IO.Path]::GetFullPath($taskActualExecutable.sourcePath) -ne [IO.Path]::GetFullPath($taskFrozenExecutable.path) -or $taskActualExecutable.bytes -ne $taskFrozenExecutable.bytes -or $taskActualExecutable.sha256 -ne $taskFrozenExecutable.sha256 -or -not [IO.Path]::GetFullPath($taskActualExecutable.path).StartsWith($taskReport.profileAcceptanceRoot + '\work\', [StringComparison]::OrdinalIgnoreCase)) { throw 'The actual fixture execution copy differs from the exact prepared source or profile scope.' }
    foreach ($taskInputPath in @($taskFrozenExecutable.path, $taskActualExecutable.path)) {
      Assert-TaskPathNoLinks $taskInputPath
      if ((Get-Item -LiteralPath $taskInputPath).Length -ne $taskFrozenExecutable.bytes -or (Get-FileHash -LiteralPath $taskInputPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskFrozenExecutable.sha256) { throw 'Actual fixture execution/source bytes changed after the scenario.' }
    }
  }
  if ($Scenario -in @('application-handoff', 'long-root-external-data')) {
    $taskFullOldHost = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'actual-old-host-transport' })[0]
    $taskFullNewHost = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'actual-new-persistent-host' })[0]
    $taskFullExpectedData = if ($Scenario -eq 'long-root-external-data') { Join-Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($taskFixtureProof.root))) 'D' } else { Join-Path $taskFixtureProof.root 'data' }
    if ([IO.Path]::GetFullPath($taskFullOldHost.dataDirectory) -ne $taskFullExpectedData -or [IO.Path]::GetFullPath($taskFullNewHost.dataDirectory) -ne $taskFullExpectedData -or [IO.Path]::GetFullPath($taskFullOldHost.boxRoot) -ne (Join-Path $taskFixtureProof.root 'data') -or [IO.Path]::GetFullPath($taskFullNewHost.boxRoot) -ne (Join-Path $taskFixtureProof.root 'data')) { throw 'Both actual Native generations must retain the selected D and original B.' }
    if ($Scenario -eq 'application-handoff' -and [IO.Path]::GetFullPath($taskFixtureProof.root) -ne (Join-Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($taskFixtureProof.root))) '安装 根')) { throw 'The default-D full chain must use its ordinary private root.' }
    foreach ($taskShortcutStep in @('actual-old-inno-install', 'actual-new-persistent-host')) {
      $taskSelection = @($taskFixtureProof.steps | Where-Object { $_.id -eq $taskShortcutStep })[0].shortcutSelection
      if ($taskSelection.task -ne 'desktopicon' -or $taskSelection.selected -ne $false -or $taskSelection.desktop.present -ne $false -or [IO.Path]::GetFullPath($taskSelection.desktop.path) -ne (Join-Path $taskFixtureProof.root 'fixture-shortcuts\Desktop\TableMax Installation Fixture.lnk')) { throw 'The actual fixture upgrade did not preserve the unselected desktop task.' }
      foreach ($taskShortcutRole in @('launch', 'uninstall')) {
        $taskShortcut = $taskSelection.startMenu.$taskShortcutRole
        $taskShortcutName = if ($taskShortcutRole -eq 'launch') { 'TableMax Installation Fixture.lnk' } else { '卸载 TableMax Installation Fixture.lnk' }
        if ([IO.Path]::GetFullPath($taskShortcut.path) -ne (Join-Path $taskFixtureProof.root ('fixture-shortcuts\Start\' + $taskShortcutName)) -or $taskShortcut.bytes -lt 1 -or $taskShortcut.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'The fixture task-selection proof lost an exact Start shortcut record.' }
      }
    }
  }
  if ($Scenario -in @('application-handoff', 'long-root-external-data')) {
    $taskDataStep = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'handoff-helper-and-data' })[0]
    $taskNextStartup = $taskDataStep.nextStartupCleanup
    $taskPinnedHost = $taskNextStartup.persistentHostExit
    $taskNextReady = $taskNextStartup.restart.ready
    $taskNextCleanup = $taskNextStartup.cleanup.value
    $taskNextEvidenceDirectory = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))
    $taskExpectedNativeImage = Join-Path $taskFixtureProof.root 'data\app\TableMax.exe'
    if ($taskNextStartup.result -ne 'passed' -or $taskPinnedHost.held.kind -ne 'fixture-native-exit-observation' -or $taskPinnedHost.held.stage -ne 'handle-held' -or $taskPinnedHost.held.pid -ne $taskFullNewHost.desktopPid -or $taskPinnedHost.held.ownerSid -ne $taskCreatedSid.Value -or [IO.Path]::GetFullPath($taskPinnedHost.held.image) -ne $taskExpectedNativeImage -or $taskPinnedHost.held.handleHeld -ne $true -or [string]::IsNullOrWhiteSpace($taskPinnedHost.held.startedAtUtc) -or $taskPinnedHost.exited.stage -ne 'exited' -or $taskPinnedHost.exited.pid -ne $taskPinnedHost.held.pid -or $taskPinnedHost.exited.image -ne $taskPinnedHost.held.image -or $taskPinnedHost.exited.ownerSid -ne $taskPinnedHost.held.ownerSid -or $taskPinnedHost.exited.startedAtUtc -ne $taskPinnedHost.held.startedAtUtc -or $taskPinnedHost.exited.handleHeld -ne $true -or $taskPinnedHost.exited.exitCode -ne 0 -or $taskPinnedHost.exited.processHasExited -ne $true -or $taskPinnedHost.checker.code -ne 0) { throw 'The actual post-Apply Native did not exit 0 through its pinned exact process handle.' }
    if ($taskNextReady.desktopPid -lt 1 -or $taskNextReady.desktopPid -eq $taskFullNewHost.desktopPid -or $taskNextReady.buildVersion -ne $taskFixturePrepared.new.manifest.buildVersion -or $taskNextStartup.restart.appVersion -ne $taskNextReady.buildVersion -or $taskNextStartup.restart.actualHostState.currentVersion -ne $taskNextReady.buildVersion -or [IO.Path]::GetFullPath($taskNextReady.root) -ne [IO.Path]::GetFullPath($taskFixtureProof.root) -or [IO.Path]::GetFullPath($taskNextReady.boxRoot) -ne (Join-Path $taskFixtureProof.root 'data') -or [IO.Path]::GetFullPath($taskNextReady.dataDirectory) -ne $taskFullExpectedData -or $taskNextReady.currentMappingSha256 -ne $taskFixturePrepared.new.manifest.currentMappingSha256 -or $taskNextReady.realShutdownDelegates -ne $true) { throw 'The next-startup cleanup was not observed in a separate healthy same-version Native at the original B/D.' }
    if ($taskNextCleanup.schemaVersion -ne 1 -or $taskNextCleanup.kind -ne 'TableMax.ApplicationUpdate.Cleanup' -or $taskNextCleanup.status -ne 'completed' -or $taskNextCleanup.ownerSid -ne $taskCreatedSid.Value -or $taskNextCleanup.installationId -ne $taskFullNewHost.identity.installationId -or [IO.Path]::GetFullPath($taskNextCleanup.root) -ne [IO.Path]::GetFullPath($taskFixtureProof.root) -or $taskNextCleanup.buildVersion -ne $taskNextReady.buildVersion -or $taskNextCleanup.currentBuildVersion -ne $taskNextReady.buildVersion -or $taskNextCleanup.payloadManifestSha256 -ne $taskFixturePrepared.new.manifest.payloadManifestSha256 -or $taskNextCleanup.currentMappingSha256 -ne $taskFixturePrepared.new.manifest.currentMappingSha256 -or $taskNextCleanup.launchAuditSha256 -ne $taskDataStep.shortLaunch.audit.sha256 -or $taskNextCleanup.handoffSha256 -ne $taskDataStep.shortLaunch.handoffRecord.sha256 -or $taskNextCleanup.launchMetadataSha256 -ne $taskDataStep.shortLaunch.metadata.sha256 -or $taskNextCleanup.targetEnvelopeSha256 -ne $taskDataStep.shortLaunch.targetEnvelope.sha256 -or $taskNextCleanup.receiptSha256 -ne $taskNextStartup.preservation.before.receipt.sha256) { throw 'The next-startup cleanup audit did not bind the actual installation, target or original public raw records.' }
    $taskNextArtifacts = @(
      @{ record = $taskPinnedHost.heldFile; path = (Join-Path $taskNextEvidenceDirectory 'persistent-host-handle-held.json') },
      @{ record = $taskPinnedHost.exitedFile; path = (Join-Path $taskNextEvidenceDirectory 'persistent-host-exit.json') },
      @{ record = $taskPinnedHost.request; path = (Join-Path $taskNextEvidenceDirectory 'quit.request') },
      @{ record = $taskNextStartup.restart.readyFile; path = (Join-Path $taskNextEvidenceDirectory 'next-startup\old-native-ready.json') },
      @{ record = $taskNextStartup.restart.plan; path = (Join-Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($taskFixtureProof.root))) 'next-startup-plan.json') },
      @{ record = $taskNextStartup.cleanup.file; path = (Join-Path $taskNextEvidenceDirectory 'next-startup-cleanup.json') },
      @{ record = $taskNextStartup.preservation.games.snapshot; path = (Join-Path $taskNextEvidenceDirectory 'next-startup-games-before.json') }
    )
    foreach ($taskArtifact in $taskNextArtifacts) {
      if ([IO.Path]::GetFullPath($taskArtifact.record.path) -ne $taskArtifact.path -or $taskArtifact.record.bytes -lt 1 -or $taskArtifact.record.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'A required next-startup raw artifact is missing or escaped its exact evidence path.' }
      Assert-TaskPathNoLinks $taskArtifact.path
      if ((Get-Item -LiteralPath $taskArtifact.path).Length -ne $taskArtifact.record.bytes -or (Get-FileHash -LiteralPath $taskArtifact.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskArtifact.record.sha256) { throw 'A required next-startup raw artifact changed after capture.' }
    }
    $taskExpectedRemoved = @($taskDataStep.shortLaunch.retainedHelper, @{ path = $taskDataStep.shortLaunch.metadata.sourcePath; bytes = $taskDataStep.shortLaunch.metadata.bytes; sha256 = $taskDataStep.shortLaunch.metadata.sha256 }, $taskDataStep.shortLaunch.canonicalHelperSource)
    if ($null -ne $taskDataStep.shortLaunch.retainedInstaller) { $taskExpectedRemoved += $taskDataStep.shortLaunch.retainedInstaller }
    if (@($taskNextStartup.removed).Count -ne $taskExpectedRemoved.Count -or @($taskNextCleanup.removed).Count -ne $taskExpectedRemoved.Count) { throw 'The next-startup cleanup removed an unexpected number of files.' }
    foreach ($taskRemovedExpected in $taskExpectedRemoved) {
      $taskRemovedPath = $taskRemovedExpected.path
      $taskRemovedRecords = @($taskNextCleanup.removed | Where-Object { [IO.Path]::GetFullPath($_.path) -eq [IO.Path]::GetFullPath($taskRemovedPath) })
      if ($taskRemovedRecords.Count -ne 1 -or $taskRemovedRecords[0].bytes -ne $taskRemovedExpected.bytes -or $taskRemovedRecords[0].sha256 -ne $taskRemovedExpected.sha256) { throw 'A next-startup removed tuple differs from the originally verified file.' }
      $taskRemovedExtended = '\\?\' + [IO.Path]::GetFullPath($taskRemovedPath)
      if ([IO.File]::Exists($taskRemovedExtended) -or [IO.Directory]::Exists($taskRemovedExtended)) { throw 'An exactly confirmed next-startup cleanup file is still present.' }
    }
    $taskRetainedInstaller = $taskNextStartup.retainedSourceInstaller
    if ([IO.Path]::GetFullPath($taskRetainedInstaller.path) -ne [IO.Path]::GetFullPath($taskDataStep.shortLaunch.canonicalInstallerSource.path) -or $taskRetainedInstaller.bytes -ne $taskFixturePrepared.new.delivery.executable.bytes -or $taskRetainedInstaller.sha256 -ne $taskFixturePrepared.new.delivery.executable.sha256 -or $taskNextCleanup.retainedSourceInstaller.sourcePath -ne $taskRetainedInstaller.path -or $taskNextCleanup.retainedSourceInstaller.path -ne $taskRetainedInstaller.path -or $taskNextCleanup.retainedSourceInstaller.bytes -ne $taskRetainedInstaller.bytes -or $taskNextCleanup.retainedSourceInstaller.sha256 -ne $taskRetainedInstaller.sha256 -or @($taskNextStartup.retainedAudits).Count -ne 3 -or $taskNextStartup.preservation.games.files -lt 1) { throw 'The next-startup cleanup did not retain the exact original download and public audit set.' }
    foreach ($taskPreservedName in @('configuration', 'identity', 'receipt', 'unknown', 'dataSentinel')) {
      $taskBefore = $taskNextStartup.preservation.before.$taskPreservedName
      $taskAfter = $taskNextStartup.preservation.after.$taskPreservedName
      if ($taskBefore.path -ne $taskAfter.path -or $taskBefore.bytes -ne $taskAfter.bytes -or $taskBefore.sha256 -ne $taskAfter.sha256 -or $taskBefore.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'A next-startup cleanup preservation record changed.' }
      if ($taskPreservedName -in @('configuration', 'unknown', 'dataSentinel')) {
        $taskAfterUninstall = $taskNextStartup.uninstallPreservation.$taskPreservedName
        if ($taskAfterUninstall.path -ne $taskBefore.path -or $taskAfterUninstall.bytes -ne $taskBefore.bytes -or $taskAfterUninstall.sha256 -ne $taskBefore.sha256) { throw 'Default uninstall lost a next-startup preserved data file.' }
      }
    }
    $taskRestartNative = $taskFixtureProof.nativeDiagnostics.restartNative
    if ($taskRestartNative.pid -ne $taskNextReady.desktopPid -or $taskRestartNative.exitCode -ne 0 -or $null -ne $taskRestartNative.signalCode -or $taskRestartNative.processStillRunning -ne $false -or $taskRestartNative.normalShutdownExpected -ne $true -or @($taskRestartNative.streams).Count -ne 2) { throw 'The independently restarted Native did not exit 0 after the actual default uninstall.' }
    foreach ($taskStreamName in @('stdout', 'stderr')) {
      $taskStreams = @($taskRestartNative.streams | Where-Object { $_.name -eq $taskStreamName })
      if ($taskStreams.Count -ne 1) { throw 'The restarted Native requires each raw stream exactly once.' }
      $taskStream = $taskStreams[0]
      $taskExpectedStreamPath = Join-Path $taskNextEvidenceDirectory ('restart-native-' + $taskStreamName + '.bin')
      if ([IO.Path]::GetFullPath($taskStream.path) -ne $taskExpectedStreamPath -or $taskStream.bytes -lt 0 -or $taskStream.bytes -gt 2097152 -or $taskStream.sha256 -notmatch '^[a-f0-9]{64}$' -or $taskStream.sourceReachedEof -ne $true -or $taskStream.truncated -ne $false -or $taskStream.archiveDetachedBeforeEof -ne $false -or $taskStream.error -or $taskStream.status) { throw 'A restarted Native raw stream was incomplete or unbound.' }
      Assert-TaskPathNoLinks $taskExpectedStreamPath
      if ((Get-Item -LiteralPath $taskExpectedStreamPath).Length -ne $taskStream.bytes -or (Get-FileHash -LiteralPath $taskExpectedStreamPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskStream.sha256) { throw 'A restarted Native raw stream changed after capture.' }
    }
  }
  if ($Scenario -eq 'framework-recovery') {
    $taskFrameworkBaseline = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'framework-old-bootstrap-baseline' })[0]
    $taskFrameworkFailure = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'framework-new-inno-expected-health-failure' })[0]
    $taskFrameworkRetained = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'framework-old-uninstaller-retained' })[0]
    if ($taskFrameworkFailure.expectedFailure -ne $true -or $taskFrameworkFailure.installerExitCode -ne 7 -or $taskFrameworkFailure.helperExitCode -ne 40 -or $taskFrameworkFailure.preparationRejectedBeforePerformInstall -ne $true -or $taskFrameworkFailure.frameworkWritesAbsent -ne $true -or $taskFrameworkFailure.nativeWitness.nodeExitCode -ne 0 -or $taskFrameworkFailure.nativeWitness.expectedNativeExitCode -ne 42 -or $taskFrameworkFailure.nativeWitness.productionEntryInvoked -ne $false -or $taskFrameworkFailure.nativeWitness.sqliteWriteCompleted -ne $true -or $taskFrameworkRetained.oldFrameworkRetained -ne $true -or $taskFrameworkRetained.registrationRetained -ne $true -or $taskFrameworkRetained.shortcutsRetained -ne $true) { throw 'The failed upgrade did not prove exact preparation rejection and original A framework preservation.' }
    $taskFrameworkLog = Join-Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))) 'framework-new-failed-inno.log'
    if ([IO.Path]::GetFullPath($taskFrameworkFailure.innoLog.path) -ne $taskFrameworkLog -or $taskFrameworkFailure.innoLog.bytes -lt 1 -or $taskFrameworkFailure.innoLog.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'The preparation failure did not bind its exact original Inno log.' }
    Assert-TaskPathNoLinks $taskFrameworkLog
    if ((Get-Item -LiteralPath $taskFrameworkLog).Length -ne $taskFrameworkFailure.innoLog.bytes -or (Get-FileHash -LiteralPath $taskFrameworkLog -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskFrameworkFailure.innoLog.sha256) { throw 'The original rejected-upgrade Inno log changed.' }
    $taskFrameworkLogText = Get-Content -LiteralPath $taskFrameworkLog -Raw -Encoding utf8
    $taskCoordinatorMarkers = [regex]::Matches($taskFrameworkLogText, 'TableMax coordinator finished with exit code: ([0-9]+)\b')
    if ($taskCoordinatorMarkers.Count -ne 1 -or $taskCoordinatorMarkers[0].Groups[1].Value -ne '40') { throw 'The rejected installer lacks the unique actual helper health-failure exit 40 marker.' }
    foreach ($taskForbiddenMarker in @('Starting the installation process.','Saving uninstall information.','Renaming uninstaller.','Creating new uninstall log:','Will overwrite existing uninstall log:','Creating new uninstall key:','Writing uninstall key values.','Deleting uninstall key left over')) {
      if ($taskFrameworkLogText.Contains($taskForbiddenMarker)) { throw 'The rejected installer reached an actual framework-writing stage.' }
    }
    if (@($taskFrameworkBaseline.framework).Count -ne 2 -or @($taskFrameworkRetained.framework).Count -ne 2) { throw 'The original A framework requires its exact EXE and DAT baseline.' }
    foreach ($taskFrameworkName in @('unins000.exe','unins000.dat')) {
      $taskFrameworkPath = Join-Path $taskFixtureProof.root $taskFrameworkName
      $taskBeforeFramework = @($taskFrameworkBaseline.framework | Where-Object { [IO.Path]::GetFullPath($_.path) -eq $taskFrameworkPath })
      $taskAfterFramework = @($taskFrameworkRetained.framework | Where-Object { [IO.Path]::GetFullPath($_.path) -eq $taskFrameworkPath })
      if ($taskBeforeFramework.Count -ne 1 -or $taskAfterFramework.Count -ne 1 -or $taskBeforeFramework[0].bytes -lt 1 -or $taskBeforeFramework[0].sha256 -notmatch '^[a-f0-9]{64}$' -or $taskBeforeFramework[0].bytes -ne $taskAfterFramework[0].bytes -or $taskBeforeFramework[0].sha256 -ne $taskAfterFramework[0].sha256) { throw 'A failed upgrade changed the original A framework raw bytes.' }
    }
    $taskBeforeRegistry = $taskFrameworkBaseline.registration
    $taskAfterRegistry = $taskFrameworkRetained.registration
    $taskRegistryKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}_is1'
    if ($taskBeforeRegistry.hive -ne 'CurrentUser' -or $taskBeforeRegistry.view -ne 'Registry64' -or $taskBeforeRegistry.key -ne $taskRegistryKey -or [IO.Path]::GetFullPath($taskBeforeRegistry.InstallLocation).TrimEnd('\') -ne [IO.Path]::GetFullPath($taskFixtureProof.root).TrimEnd('\') -or $taskBeforeRegistry.DisplayVersion -ne $taskFixturePrepared.old.manifest.buildVersion -or @($taskBeforeRegistry.values).Count -lt 1 -or (ConvertTo-Json -InputObject $taskBeforeRegistry -Depth 100 -Compress) -cne (ConvertTo-Json -InputObject $taskAfterRegistry -Depth 100 -Compress)) { throw 'The rejected upgrade changed the complete original A registry name/kind/data snapshot.' }
    if (@($taskFrameworkBaseline.shortcuts).Count -ne 3 -or @($taskFrameworkRetained.shortcuts).Count -ne 3 -or (ConvertTo-Json -InputObject $taskFrameworkBaseline.shortcuts -Depth 100 -Compress) -cne (ConvertTo-Json -InputObject $taskFrameworkRetained.shortcuts -Depth 100 -Compress)) { throw 'The rejected upgrade changed an original A shortcut state or raw record.' }
    foreach ($taskShortcutRole in @('desktop','launch','uninstall')) {
      $taskShortcutEntries = @($taskFrameworkBaseline.shortcuts | Where-Object { $_.role -eq $taskShortcutRole })
      $taskShortcutRelative = if ($taskShortcutRole -eq 'desktop') { 'Desktop\TableMax Installation Fixture.lnk' } elseif ($taskShortcutRole -eq 'launch') { 'Start\TableMax Installation Fixture.lnk' } else { 'Start\卸载 TableMax Installation Fixture.lnk' }
      $taskShortcutPath = Join-Path $taskFixtureProof.root ('fixture-shortcuts\' + $taskShortcutRelative)
      if ($taskShortcutEntries.Count -ne 1 -or [IO.Path]::GetFullPath($taskShortcutEntries[0].path) -ne $taskShortcutPath -or ($taskShortcutRole -ne 'desktop' -and $taskShortcutEntries[0].present -ne $true)) { throw 'The original A shortcut baseline lost an exact redirected role or path.' }
      if ($taskShortcutEntries[0].present) {
        if ([IO.Path]::GetFullPath($taskShortcutEntries[0].file.path) -ne $taskShortcutPath -or $taskShortcutEntries[0].file.bytes -lt 1 -or $taskShortcutEntries[0].file.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'The original A shortcut baseline is not raw-SHA bound.' }
      } elseif ($null -ne $taskShortcutEntries[0].file) { throw 'An absent original shortcut cannot have invented raw bytes.' }
    }
  }
  if ($Scenario -in @('active-uninstall', 'startup-external-data')) {
    $taskActiveCleanup = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'exact-fixture-uninstall-cleanup' })[0]
    $taskActiveHost = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'actual-old-host-transport' })[0]
    $taskBeforeUninstall = $taskActiveCleanup.activeNativeBeforeUninstall
    if ($taskActiveCleanup.registrationRemoved -ne $true -or [IO.Path]::GetFullPath($taskActiveCleanup.scope) -ne [IO.Path]::GetFullPath($taskFixtureProof.root) -or $taskBeforeUninstall.pid -lt 1 -or $taskBeforeUninstall.pid -ne $taskActiveHost.desktopPid -or $null -ne $taskBeforeUninstall.exitCode -or $null -ne $taskBeforeUninstall.signalCode -or [string]::IsNullOrWhiteSpace($taskBeforeUninstall.observedAtUtc)) { throw 'The actual default uninstall did not begin with the exact old Native still running.' }
  }
  if ($Scenario -in @('active-uninstall', 'startup-external-data', 'application-handoff', 'long-root-external-data')) {
    $taskOldNative = $taskFixtureProof.nativeDiagnostics.oldNative
    $taskRawHost = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'actual-old-host-transport' })[0]
    if ($taskOldNative.pid -ne $taskRawHost.desktopPid -or $taskOldNative.exitCode -ne 0 -or $null -ne $taskOldNative.signalCode -or $taskOldNative.processStillRunning -ne $false -or $taskOldNative.normalShutdownExpected -ne $true -or @($taskFixtureProof.nativeDiagnostics.errors).Count -ne 0 -or @($taskOldNative.streams).Count -ne 2) { throw 'The actual fixture chain did not prove normal old Native exit and complete diagnostics.' }
    foreach ($taskStreamName in @('stdout', 'stderr')) {
      $taskStreams = @($taskOldNative.streams | Where-Object { $_.name -eq $taskStreamName })
      if ($taskStreams.Count -ne 1) { throw 'The active uninstall requires each raw old Native stream exactly once.' }
      $taskStream = $taskStreams[0]
      $taskExpectedStreamPath = Join-Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))) ('old-native-' + $taskStreamName + '.bin')
      if ([IO.Path]::GetFullPath($taskStream.path) -ne $taskExpectedStreamPath -or $taskStream.bytes -lt 0 -or $taskStream.bytes -gt 2097152 -or $taskStream.sha256 -notmatch '^[a-f0-9]{64}$' -or $taskStream.sourceReachedEof -ne $true -or $taskStream.truncated -ne $false -or $taskStream.archiveDetachedBeforeEof -ne $false -or $taskStream.error -or $taskStream.status) { throw 'An old Native raw stream was incomplete, truncated or unbound.' }
      Assert-TaskPathNoLinks $taskExpectedStreamPath
      if ((Get-Item -LiteralPath $taskExpectedStreamPath).Length -ne $taskStream.bytes -or (Get-FileHash -LiteralPath $taskExpectedStreamPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskStream.sha256) { throw 'An active-uninstall raw diagnostic changed after capture.' }
    }
  }
  if ($Scenario -in @('startup-external-data', 'long-root-external-data')) {
    $taskExternal = $taskFixtureProof.startupExternalData
    $taskExternalOldHost = @($taskFixtureProof.steps | Where-Object { $_.id -eq 'actual-old-host-transport' })[0]
    $taskExpectedData = Join-Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($taskFixtureProof.root))) 'D'
    $taskExpectedBox = Join-Path $taskFixtureProof.root 'data'
    $taskExpectedConfig = Join-Path $taskExpectedBox 'TableMax.config.json'
    if ($taskFixtureProof.root.Length -ne 198 -or $taskExternal.rootLength -ne 198 -or [IO.Path]::GetFullPath($taskExternal.dataDirectory) -ne $taskExpectedData -or [IO.Path]::GetFullPath($taskExternal.gamesDirectory) -ne (Join-Path $taskExpectedBox 'games') -or [IO.Path]::GetFullPath($taskExternal.actualReady.dataDirectory) -ne $taskExpectedData -or [IO.Path]::GetFullPath($taskExternal.actualReady.boxRoot) -ne $taskExpectedBox -or [IO.Path]::GetFullPath($taskExternalOldHost.dataDirectory) -ne $taskExpectedData -or $taskExternal.externalGamesPresent -ne $false -or @($taskExternal.gameEntries).Count -lt 1 -or $taskExternal.dataAndGamesRetained -ne $true) { throw 'The short external data scenario lost its I198, actual D or retained B/G binding.' }
    if ($Scenario -eq 'long-root-external-data' -and ([IO.Path]::GetFullPath($taskExternal.newActualReady.dataDirectory) -ne $taskExpectedData -or [IO.Path]::GetFullPath($taskExternal.newActualReady.boxRoot) -ne $taskExpectedBox)) { throw 'The actual upgraded Native lost its explicit external D or original B.' }
    Assert-TaskPathNoLinks $taskExpectedData
    foreach ($taskConfigRecord in @($taskExternal.configurationBefore, $taskExternal.configurationAfterUninstall)) {
      if ([IO.Path]::GetFullPath($taskConfigRecord.path) -ne $taskExpectedConfig -or $taskConfigRecord.bytes -ne $taskExternal.configurationBefore.bytes -or $taskConfigRecord.sha256 -ne $taskExternal.configurationBefore.sha256 -or (Get-Item -LiteralPath $taskExpectedConfig).Length -ne $taskConfigRecord.bytes -or (Get-FileHash -LiteralPath $taskExpectedConfig -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskConfigRecord.sha256) { throw 'The legitimate external data configuration changed during install or uninstall.' }
    }
    if ((Get-Content -LiteralPath $taskExpectedConfig -Raw -Encoding utf8 | ConvertFrom-Json).dataDirectory -ne $taskExpectedData) { throw 'The retained configuration lost its exact external data pointer.' }
  }
  return [pscustomobject]@{ scenario = $Scenario; path = [IO.Path]::GetFullPath($Path); bytes = (Get-Item -LiteralPath $Path).Length; sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant(); preparedInput = @{ path = $taskHandoffPreparedReport; sha256 = $taskFixturePreparedSha256 }; ownerSid = $taskCreatedSid.Value; root = $taskFixtureProof.root; executionProfile = $taskExecutionProfile; actualExecutionInputs = $taskFixtureProof.actualExecutionInputs; completedStepIds = @($taskFixtureProof.steps | ForEach-Object { $_.id }) }
}
$taskPortablePointerBytes = $null
$taskPortablePointerSha256 = $null
$taskPortableExecutable = $null
if ($PortableMigrationOnly) {
  $taskPortablePointerBytes = (Get-Item -LiteralPath $taskPortablePointer).Length
  $taskPortablePointerSha256 = (Get-FileHash -LiteralPath $taskPortablePointer -Algorithm SHA256).Hash.ToLowerInvariant()
  $taskPortableData = Get-Content -LiteralPath $taskPortablePointer -Raw -Encoding utf8 | ConvertFrom-Json
  $taskPortableDeliveries = @($taskPortableData.deliveries | Where-Object { $_.edition -eq 'full' })
  if ($taskPortableDeliveries.Count -ne 1 -or $taskPortableDeliveries[0].deliveryType -eq 'installer' -or $taskPortableDeliveries[0].executable.type -eq 'installer' -or $taskPortableDeliveries[0].executable.installation) { throw 'The frozen pointer must contain one full portable executable.' }
  $taskPortableExecutable = $taskPortableDeliveries[0].executable
  $taskPortableExecutablePath = [IO.Path]::GetFullPath($taskPortableExecutable.path)
  if (-not $taskPortableExecutablePath.StartsWith($taskRepository + '\artifacts\releases\', [StringComparison]::OrdinalIgnoreCase) -or $taskPortableExecutable.sha256 -notmatch '^[a-f0-9]{64}$' -or $taskPortableExecutable.bytes -lt 1 -or $taskPortableExecutable.bytes -ge 120000000) { throw 'The frozen portable executable identity is invalid.' }
  Assert-TaskPathNoLinks $taskPortableExecutablePath
  if ((Get-Item -LiteralPath $taskPortableExecutablePath).Length -ne $taskPortableExecutable.bytes -or (Get-FileHash -LiteralPath $taskPortableExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPortableExecutable.sha256) { throw 'The frozen portable executable bytes changed.' }
}
$taskSystemPowerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskSourceNode = Join-Path $taskRepository '.cache/node/22.14.0/runtime/node.exe'
$taskTrackedChild = Join-Path $PSScriptRoot 'verify-production-user-child.ps1'
$taskMethodEntrypoint = Join-Path $PSScriptRoot 'execution-method.mjs'
$taskEntrypoints = @(if ($PortableMigrationOnly) { Join-Path $taskRepository 'tools/test/installation/verify-portable-migration.mjs' } else { Join-Path $taskRepository 'tools/test/installation/verify-application-handoff.mjs' })
$taskEntrypoints += $taskMethodEntrypoint
if (-not $PortableMigrationOnly -and -not $FixtureScenario) { $taskEntrypoints += Join-Path $taskRepository 'tools/release/installation-verifier.mjs' }
$taskEnvironment = Assert-TaskAcceptanceEnvironment $taskSystemPowerShell $taskSourceNode $taskTrackedChild $taskEntrypoints
$taskFailurePolicyPath = Join-Path $taskRepository 'tools/test/runner/failure-policy.mjs'
$taskFailureLimit = Get-TaskFailureBudget $taskSourceNode $taskFailurePolicyPath $taskRepository $PriorFailures
$taskMethodSources = @(Get-TaskExecutionMethod $taskSourceNode $taskMethodEntrypoint $taskRepository)
if (@($taskMethodSources | Where-Object { $_.path -eq $taskFailurePolicyPath }).Count -ne 1) { throw 'The complete acceptance method must bind the shared failure policy.' }
$taskMethodSha256 = Get-TaskMethodFingerprint $taskMethodSources
$taskUsername = 'TMVerify_' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$taskWork = Join-Path $taskRepository ('tmp\installation-user-' + [Guid]::NewGuid().ToString('N'))
Assert-TaskPathNoLinks $taskWork
New-Item -ItemType Directory -Path $taskWork | Out-Null
Assert-TaskPathNoLinks $taskWork
New-Item -ItemType Directory -Path $taskOutput | Out-Null
Assert-TaskPathNoLinks $taskOutput
$taskReport = [ordered]@{ schemaVersion = 1; kind = $(if ($PortableMigrationOnly) { 'temporary-standard-user-portable-migration' } else { 'temporary-standard-user' }); startedAtUtc = [DateTime]::UtcNow.ToString('o'); result = 'started'; account = $taskUsername; ownerSid = $null; freshAccount = $false; standardAccount = $false; profileLoaded = $false; installerSha256 = $taskDeliveryData.executable.sha256; accountRemoved = $false; profileRemoved = $false; errors = @() }
$taskReport.methodSources = $taskMethodSources
$taskReport.methodSha256 = $taskMethodSha256
$taskReport.failureLimit = $taskFailureLimit
$taskReport.environmentPreflight = $taskEnvironment
$taskRunnerPath = Join-Path $taskWork 'run.ps1'
$taskChildExecution = Copy-TaskSourceFile $taskTrackedChild $taskRunnerPath $taskEnvironment.child
$taskReport.childExecution = $taskChildExecution
if ($FixtureScenario) {
  $taskReport.scenario = 'fixture-only'
  $taskReport.fixtureScenario = $FixtureScenario
  $taskReport.formalInstallerExecuted = $false
  $taskReport.handoffPreparedSha256 = $taskFixturePreparedSha256
}
if ($PortableMigrationOnly) {
  $taskReport.priorFailures = $PriorFailures
  $taskReport.portablePointer = @{ path = $taskPortablePointer; bytes = $taskPortablePointerBytes; sha256 = $taskPortablePointerSha256 }
}
$taskCreatedSid = $null
$taskRunner = $null
try {
  $taskRandom = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($taskRandom)
  $taskPassword = ConvertTo-SecureString ('aA1!' + [Convert]::ToBase64String($taskRandom)) -AsPlainText -Force
  $taskUser = New-LocalUser -Name $taskUsername -Password $taskPassword -Description 'Temporary TableMax installation acceptance' -AccountNeverExpires -UserMayNotChangePassword
  $taskCreatedSid = $taskUser.SID
  $taskReport.accountSid = $taskCreatedSid.Value
  $taskReport.ownerSid = $taskCreatedSid.Value
  $taskReport.freshAccount = $true
  Write-TaskJson (Join-Path $taskOutput 'isolated-account.json') $taskReport
  Add-LocalGroupMember -SID ([Security.Principal.SecurityIdentifier]::new('S-1-5-32-545')) -Member $taskUser
  foreach ($taskDirectory in @($taskWork, $taskOutput)) {
    $taskAcl = Get-Acl -LiteralPath $taskDirectory
    $taskAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($taskCreatedSid, 'Modify', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    Set-Acl -LiteralPath $taskDirectory -AclObject $taskAcl
  }
  $taskPlan = Join-Path $taskWork 'plan.json'
  @{ repository = $taskRepository; delivery = $taskDelivery; handoffPreparedReport = $taskHandoffPreparedReport; handoffEvidence = (Join-Path $taskOutput 'application-handoff'); frameworkRecoveryEvidence = (Join-Path $taskOutput 'application-framework-recovery'); activeUninstallEvidence = (Join-Path $taskOutput 'application-active-uninstall'); fixtureScenario = $FixtureScenario; fixturePreparedSha256 = $taskFixturePreparedSha256; evidence = (Join-Path $taskOutput 'shipping-executable-checks-full.json'); portableMigrationOnly = [bool]$PortableMigrationOnly; portablePointer = $taskPortablePointer; portablePointerBytes = $taskPortablePointerBytes; portablePointerSha256 = $taskPortablePointerSha256; portableMigrationEvidence = (Join-Path $taskOutput 'portable-migration'); priorFailures = $PriorFailures; failureLimit = $taskFailureLimit; accountSid = $taskCreatedSid.Value; work = $taskWork; useProfileAcceptance = [bool]$UseProfileAcceptance; sourceNode = $taskSourceNode; sourceNodeBytes = $taskEnvironment.node.bytes; sourceNodeSha256 = $taskEnvironment.node.sha256; childExecution = $taskChildExecution; methodSha256 = $taskMethodSha256 } | ConvertTo-Json | Set-Content -LiteralPath $taskPlan -Encoding utf8

  $taskCredentials = [Management.Automation.PSCredential]::new($env:COMPUTERNAME + '\' + $taskUsername, $taskPassword)
  $taskRunner = Start-Process -FilePath $taskSystemPowerShell -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"' + $taskRunnerPath + '"'),'-Plan',('"' + $taskPlan + '"')) -Credential $taskCredentials -LoadUserProfile -WorkingDirectory $taskWork -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskOutput 'account-runner.stdout.log') -RedirectStandardError (Join-Path $taskOutput 'account-runner.stderr.log') -PassThru
  $null = $taskRunner.Handle
  if (-not $taskRunner.WaitForExit(1860000)) { throw 'Isolated installer verification exceeded its bounded budget.' }
  $taskRunner.Refresh()
  $taskReport.exitCode = $taskRunner.ExitCode
  if ($taskRunner.ExitCode -ne 0) { throw 'Isolated installer verification failed; inspect its saved evidence.' }
  $taskUserIdentity = Get-Content -LiteralPath (Join-Path $taskOutput 'user-identity.json') -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskUserIdentity.sid -ne $taskCreatedSid.Value -or -not $taskUserIdentity.standardAccount -or [IO.Path]::GetFileName($taskUserIdentity.profile) -ne $taskUsername) { throw 'Actual loaded standard-account identity did not match the new account.' }
  if ($UseProfileAcceptance) {
    $taskExpectedAcceptanceParent = [IO.Path]::GetFullPath((Join-Path $taskUserIdentity.localAppData 'TableMaxAcceptance'))
    if ([IO.Path]::GetDirectoryName($taskUserIdentity.profileAcceptanceRoot) -ne $taskExpectedAcceptanceParent -or [IO.Path]::GetFileName($taskUserIdentity.profileAcceptanceRoot) -notmatch '^[a-f0-9]{32}$' -or $taskUserIdentity.executableSecurityMetadataCopied -ne $false -or $taskUserIdentity.nodeSha256 -ne (Get-FileHash -LiteralPath $taskSourceNode -Algorithm SHA256).Hash.ToLowerInvariant()) { throw 'The profile acceptance scope or materialized Node identity did not match.' }
    $taskReport.profileAcceptanceRoot = $taskUserIdentity.profileAcceptanceRoot
    $taskReport.profileAcceptanceNode = $taskUserIdentity.nodeExecutable
    $taskReport.profileAcceptanceNodeSha256 = $taskUserIdentity.nodeSha256
  }
  if ($PortableMigrationOnly) {
    $taskMigrationProofPath = Join-Path $taskOutput 'portable-migration/report.json'
    Assert-TaskPathNoLinks $taskMigrationProofPath
    $taskMigrationProof = Get-Content -LiteralPath $taskMigrationProofPath -Raw -Encoding utf8 | ConvertFrom-Json
    if ($taskMigrationProof.schemaVersion -ne 1 -or $taskMigrationProof.scenario -ne 'portable-migration' -or $taskMigrationProof.result -ne 'passed' -or $taskMigrationProof.failures -ne 0 -or $taskMigrationProof.priorFailures -ne $PriorFailures -or @($taskMigrationProof.cases).Count -ne 2) { throw 'The actual portable migration report did not complete both cases.' }
    if ($taskMigrationProof.executionProfile.root -ne $taskReport.profileAcceptanceRoot -or $taskMigrationProof.executionProfile.ownerSid -ne $taskCreatedSid.Value -or $taskMigrationProof.executionProfile.integritySid -ne 'S-1-16-8192') { throw 'Portable migration did not prove the actual isolated standard Medium profile.' }
    if ([IO.Path]::GetFullPath($taskMigrationProof.portable.pointer.path) -ne $taskPortablePointer -or $taskMigrationProof.portable.pointer.bytes -ne $taskPortablePointerBytes -or $taskMigrationProof.portable.pointer.sha256 -ne $taskPortablePointerSha256 -or (Get-FileHash -LiteralPath $taskPortablePointer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPortablePointerSha256) { throw 'The actual migration did not bind the exact frozen portable pointer.' }
    if ([IO.Path]::GetFullPath($taskMigrationProof.portable.executable.path) -ne $taskPortableExecutablePath -or [IO.Path]::GetFullPath($taskMigrationProof.portable.executable.sourcePath) -ne $taskPortableExecutablePath -or $taskMigrationProof.portable.executable.bytes -ne $taskPortableExecutable.bytes -or $taskMigrationProof.portable.executable.sha256 -ne $taskPortableExecutable.sha256 -or $taskMigrationProof.portable.buildVersion -ne $taskPortableData.buildVersion) { throw 'The migration portable executable identity differs from its frozen pointer.' }
    if ([IO.Path]::GetFullPath($taskMigrationProof.currentDelivery.path) -ne $taskDelivery -or $taskMigrationProof.currentDelivery.bytes -ne $taskDeliveryBytes -or $taskMigrationProof.currentDelivery.sha256 -ne $taskDeliverySha256 -or (Get-FileHash -LiteralPath $taskDelivery -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskDeliverySha256 -or $taskMigrationProof.currentDelivery.executable.bytes -ne $taskDeliveryData.executable.bytes -or $taskMigrationProof.currentDelivery.executable.sha256 -ne $taskReport.installerSha256 -or [IO.Path]::GetFullPath($taskMigrationProof.currentDelivery.executable.sourcePath) -ne [IO.Path]::GetFullPath($taskDeliveryData.executable.path) -or [IO.Path]::GetFullPath($taskMigrationProof.currentDelivery.executable.path) -ne [IO.Path]::GetFullPath($taskDeliveryData.executable.path) -or $taskMigrationProof.currentDelivery.installationManifestSha256 -ne $taskDeliveryData.executable.installation.manifestSha256) { throw 'The actual migration did not bind the exact sealed current installer delivery.' }
    if (@($taskMigrationProof.executionCopies).Count -ne 4) { throw 'Both migration cases require exact portable and installer execution copies.' }
    foreach ($taskCaseId in @('defaultD','externalD')) {
      $taskCases = @($taskMigrationProof.cases | Where-Object { $_.id -eq $taskCaseId })
      if ($taskCases.Count -ne 1 -or $taskCases[0].result -ne 'passed' -or $taskCases[0].actualInstaller -ne $true -or $taskCases[0].defaultUninstall -ne $true -or $taskCases[0].ownerSid -ne $taskCreatedSid.Value) { throw 'A required actual installer/default-uninstaller migration case did not pass.' }
      foreach ($taskCheck in @('portable10-native-generated-saved-player','portable10-source-idle-complete-inventory','actual-inno-migration','installed18-managed-members-and-receipt','saved-player-and-storage-restored','old-source-and-games-preserved','actual-default-uninstall','data-games-config-and-source-preserved-after-uninstall')) {
        if (@($taskCases[0].checks | Where-Object { $_ -eq $taskCheck }).Count -ne 1) { throw 'The migration case lacks a required unique completed check.' }
      }
      foreach ($taskCasePath in @($taskCases[0].root, $taskCases[0].oldBox, $taskCases[0].dataDirectory)) {
        if (-not [IO.Path]::GetFullPath($taskCasePath).StartsWith($taskReport.profileAcceptanceRoot + '\work\', [StringComparison]::OrdinalIgnoreCase)) { throw 'A migration case escaped the isolated profile work root.' }
        Assert-TaskPathNoLinks $taskCasePath
      }
      foreach ($taskRole in @('portable','installer')) {
        $taskCopies = @($taskMigrationProof.executionCopies | Where-Object { $_.caseId -eq $taskCaseId -and $_.role -eq $taskRole })
        $taskExpectedSource = if ($taskRole -eq 'portable') { $taskPortableExecutable } else { $taskDeliveryData.executable }
        if ($taskCopies.Count -ne 1 -or [IO.Path]::GetFullPath($taskCopies[0].sourcePath) -ne [IO.Path]::GetFullPath($taskExpectedSource.path) -or $taskCopies[0].bytes -ne $taskExpectedSource.bytes -or $taskCopies[0].sha256 -ne $taskExpectedSource.sha256 -or -not [IO.Path]::GetFullPath($taskCopies[0].path).StartsWith($taskReport.profileAcceptanceRoot + '\work\', [StringComparison]::OrdinalIgnoreCase)) { throw 'A migration execution copy differs from its exact frozen source or scope.' }
      }
    }
    $taskReport.portableMigrationEvidencePath = $taskMigrationProofPath.Substring($taskRepository.Length + 1).Replace('\', '/')
    $taskReport.portableMigrationBeforeIsolationSha256 = (Get-FileHash -LiteralPath $taskMigrationProofPath -Algorithm SHA256).Hash.ToLowerInvariant()
  } elseif ($FixtureScenario) {
    if ($FixtureScenario -in @('active-uninstall', 'startup-external-data')) {
      $taskActiveEvidenceName = if ($FixtureScenario -eq 'startup-external-data') { 'application-startup-external-data' } else { 'application-active-uninstall' }
      $taskFixtureEvidenceRecords = @(Read-TaskFixtureEvidence -Path (Join-Path $taskOutput ($taskActiveEvidenceName + '/report.json')) -Scenario $FixtureScenario -RequiredSteps @('verify-prepared-materials', 'actual-old-inno-install', 'actual-old-host-transport', 'exact-fixture-uninstall-cleanup'))
    } elseif ($FixtureScenario -eq 'long-root-external-data') {
      $taskFixtureEvidenceRecords = @(Read-TaskFixtureEvidence -Path (Join-Path $taskOutput 'application-handoff-long-root-external-data/report.json') -Scenario 'long-root-external-data' -RequiredSteps @('verify-prepared-materials', 'actual-old-inno-install', 'actual-old-host-transport', 'actual-check-download', 'real-apply-parent-handoff', 'actual-new-persistent-host', 'handoff-helper-and-data', 'exact-fixture-uninstall-cleanup'))
    } else {
      $taskFixtureEvidenceRecords = @(
        Read-TaskFixtureEvidence -Path (Join-Path $taskOutput 'application-handoff/report.json') -Scenario 'application-handoff' -RequiredSteps @('verify-prepared-materials', 'actual-old-inno-install', 'actual-old-host-transport', 'actual-check-download', 'real-apply-parent-handoff', 'actual-new-persistent-host', 'handoff-helper-and-data', 'exact-fixture-uninstall-cleanup')
        Read-TaskFixtureEvidence -Path (Join-Path $taskOutput 'application-handoff-long-root-external-data/report.json') -Scenario 'long-root-external-data' -RequiredSteps @('verify-prepared-materials', 'actual-old-inno-install', 'actual-old-host-transport', 'actual-check-download', 'real-apply-parent-handoff', 'actual-new-persistent-host', 'handoff-helper-and-data', 'exact-fixture-uninstall-cleanup')
        Read-TaskFixtureEvidence -Path (Join-Path $taskOutput 'application-framework-recovery/report.json') -Scenario 'framework-recovery' -RequiredSteps @('verify-prepared-materials', 'framework-old-inno-install', 'framework-old-bootstrap-baseline', 'framework-new-inno-expected-health-failure', 'framework-old-uninstaller-retained', 'framework-missing-live-helper', 'framework-actual-old-default-uninstall', 'framework-preserved-data-and-registration')
      )
    }
    if (Test-Path -LiteralPath (Join-Path $taskOutput 'shipping-executable-checks-full.json')) { throw 'Fixture-only acceptance must not create a formal installed proof.' }
    $taskReport.fixtureEvidence = @($taskFixtureEvidenceRecords)
  } else {
  $taskHandoffProofPath = Join-Path $taskOutput 'application-handoff/report.json'
  Assert-TaskPathNoLinks $taskHandoffProofPath
  $taskHandoffProof = Get-Content -LiteralPath $taskHandoffProofPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskHandoffProof.result -ne 'passed' -or $taskHandoffProof.failures -ne 0 -or @($taskHandoffProof.steps | Where-Object { $_.result -ne 'passed' }).Count -ne 0) { throw 'The actual Apply chain did not pass; prepared-only or exit-code-only evidence is insufficient.' }
  foreach ($taskRequiredStep in @('actual-old-inno-install','actual-old-host-transport','actual-check-download','real-apply-parent-handoff','actual-new-persistent-host','handoff-helper-and-data','exact-fixture-uninstall-cleanup')) {
    if (@($taskHandoffProof.steps | Where-Object { $_.id -eq $taskRequiredStep -and $_.result -eq 'passed' }).Count -ne 1) { throw 'The actual Apply proof is missing a required unique step.' }
  }
  $taskReport.handoffEvidencePath = $taskHandoffProofPath.Substring($taskRepository.Length + 1).Replace('\', '/')
  $taskReport.handoffEvidenceSha256 = (Get-FileHash -LiteralPath $taskHandoffProofPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $taskReport.handoffPreparedSha256 = (Get-FileHash -LiteralPath $taskHandoffPreparedReport -Algorithm SHA256).Hash.ToLowerInvariant()
  if ([IO.Path]::GetFullPath($taskHandoffProof.preparedInput.path) -ne $taskHandoffPreparedReport -or $taskHandoffProof.preparedInput.sha256 -ne $taskReport.handoffPreparedSha256) { throw 'The actual Apply proof does not bind the exact prepared input.' }
  $taskFrameworkProofPath = Join-Path $taskOutput 'application-framework-recovery/report.json'
  Assert-TaskPathNoLinks $taskFrameworkProofPath
  $taskFrameworkProof = Get-Content -LiteralPath $taskFrameworkProofPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskFrameworkProof.result -ne 'passed' -or $taskFrameworkProof.failures -ne 0 -or $taskFrameworkProof.scenario -ne 'framework-recovery' -or @($taskFrameworkProof.steps | Where-Object { $_.result -ne 'passed' }).Count -ne 0) { throw 'The actual failed-upgrade framework recovery did not pass.' }
  foreach ($taskRequiredStep in @('framework-old-inno-install','framework-old-bootstrap-baseline','framework-new-inno-expected-health-failure','framework-old-uninstaller-retained','framework-missing-live-helper','framework-actual-old-default-uninstall','framework-preserved-data-and-registration')) {
    if (@($taskFrameworkProof.steps | Where-Object { $_.id -eq $taskRequiredStep -and $_.result -eq 'passed' }).Count -ne 1) { throw 'The actual framework recovery proof is missing a required unique step.' }
  }
  if ([IO.Path]::GetFullPath($taskFrameworkProof.preparedInput.path) -ne $taskHandoffPreparedReport -or $taskFrameworkProof.preparedInput.sha256 -ne $taskReport.handoffPreparedSha256) { throw 'The framework recovery proof does not bind the exact prepared input.' }
  if ($UseProfileAcceptance) {
    foreach ($taskChain in @($taskHandoffProof, $taskFrameworkProof)) {
      if ($taskChain.executionProfile.root -ne $taskReport.profileAcceptanceRoot -or $taskChain.executionProfile.ownerSid -ne $taskCreatedSid.Value -or $taskChain.executionProfile.integritySid -ne 'S-1-16-8192') { throw 'The actual chain did not prove the isolated standard Medium profile scope.' }
      foreach ($taskRole in @('old','new')) {
        $taskSourceExecutable = $taskChain.$taskRole.delivery.executable
        $taskActualExecutable = $taskChain.actualExecutionInputs.$taskRole
        if ([IO.Path]::GetFullPath($taskActualExecutable.sourcePath) -ne [IO.Path]::GetFullPath($taskSourceExecutable.path) -or $taskActualExecutable.sha256 -ne $taskSourceExecutable.sha256 -or $taskActualExecutable.bytes -ne $taskSourceExecutable.bytes -or -not [IO.Path]::GetFullPath($taskActualExecutable.path).StartsWith($taskReport.profileAcceptanceRoot + '\work\', [StringComparison]::OrdinalIgnoreCase)) { throw 'The actual chain execution copy did not bind the exact frozen installer.' }
      }
    }
  }
  $taskReport.frameworkRecoveryEvidencePath = $taskFrameworkProofPath.Substring($taskRepository.Length + 1).Replace('\', '/')
  $taskReport.frameworkRecoveryEvidenceSha256 = (Get-FileHash -LiteralPath $taskFrameworkProofPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $taskReport.applicationChainEvidence = @(
    Read-TaskFixtureEvidence -Path $taskHandoffProofPath -Scenario 'application-handoff' -RequiredSteps @('verify-prepared-materials', 'actual-old-inno-install', 'actual-old-host-transport', 'actual-check-download', 'real-apply-parent-handoff', 'actual-new-persistent-host', 'handoff-helper-and-data', 'exact-fixture-uninstall-cleanup')
    Read-TaskFixtureEvidence -Path (Join-Path $taskOutput 'application-handoff-long-root-external-data/report.json') -Scenario 'long-root-external-data' -RequiredSteps @('verify-prepared-materials', 'actual-old-inno-install', 'actual-old-host-transport', 'actual-check-download', 'real-apply-parent-handoff', 'actual-new-persistent-host', 'handoff-helper-and-data', 'exact-fixture-uninstall-cleanup')
    Read-TaskFixtureEvidence -Path $taskFrameworkProofPath -Scenario 'framework-recovery' -RequiredSteps @('verify-prepared-materials', 'framework-old-inno-install', 'framework-old-bootstrap-baseline', 'framework-new-inno-expected-health-failure', 'framework-old-uninstaller-retained', 'framework-missing-live-helper', 'framework-actual-old-default-uninstall', 'framework-preserved-data-and-registration')
  )
  }
  $taskReport.standardAccount = $true
  $taskReport.profileLoaded = $true
  $taskReport.result = 'passed'
} catch {
  $taskReport.result = 'failed'
  $taskReport.errors += $_.Exception.Message
} finally {
  if ($taskCreatedSid) {
    # This account was freshly created here, its random password never leaves this process.
    # Stop only processes owned by its exact SID, never by an executable name.
    try {
      if ($taskRunner -and -not $taskRunner.HasExited) {
        $taskRunner.Kill()
        if (-not $taskRunner.WaitForExit(5000)) { throw 'The owned isolated-account runner did not exit before process cleanup.' }
      }
      $taskProcessCleanupDeadline = [DateTime]::UtcNow.AddSeconds(30)
      do {
      $taskOwnedProcessesSeen = 0
      foreach ($taskProcess in Get-CimInstance Win32_Process) {
        $taskHandle = $null
        try { $taskOwner = Invoke-CimMethod -InputObject $taskProcess -MethodName GetOwnerSid }
        catch { continue }
        if ($taskOwner.ReturnValue -ne 0 -or $taskOwner.Sid -ne $taskCreatedSid.Value) { continue }
        $taskOwnedProcessesSeen++
        try {
          $taskHandle = [Diagnostics.Process]::GetProcessById($taskProcess.ProcessId)
          $null = $taskHandle.Handle
          $taskCreationDelta = [long]$taskHandle.StartTime.ToUniversalTime().Ticks - [long]$taskProcess.CreationDate.ToUniversalTime().Ticks
          if ([Math]::Abs($taskCreationDelta) -gt 9) { continue }
          $taskOwner = Invoke-CimMethod -InputObject $taskProcess -MethodName GetOwnerSid
          if ($taskOwner.Sid -eq $taskCreatedSid.Value) {
            $taskHandle.Kill()
            if (-not $taskHandle.WaitForExit(5000)) { throw 'An isolated-account process did not exit.' }
          }
        } catch [ArgumentException] { }
        catch { $taskReport.errors += ('Isolated process cleanup: ' + $_.Exception.Message) }
        finally { if ($taskHandle) { $taskHandle.Dispose() } }
      }
      if ($taskOwnedProcessesSeen -eq 0) { break }
      if ([DateTime]::UtcNow -ge $taskProcessCleanupDeadline) { throw 'The bounded isolated-account process sweep did not reach zero.' }
      Start-Sleep -Milliseconds 200
      } while ($true)
    } catch { $taskReport.errors += ('Process cleanup: ' + $_.Exception.Message) }
    try {
      $taskCurrentUser = Get-LocalUser -SID $taskCreatedSid
      if ($taskCurrentUser.Name -ne $taskUsername) { throw 'Temporary account identity changed; cleanup preserved it.' }
      Remove-LocalUser -SID $taskCreatedSid
      if (Get-LocalUser -SID $taskCreatedSid -ErrorAction SilentlyContinue) { throw 'Temporary account still exists.' }
      $taskReport.accountRemoved = $true
    } catch { $taskReport.errors += $_.Exception.Message }
    try {
      $taskProfileDeadline = [DateTime]::UtcNow.AddSeconds(45)
      do {
        $taskProfile = Get-CimInstance Win32_UserProfile | Where-Object { $_.SID -eq $taskCreatedSid.Value }
        if (-not $taskProfile -or -not $taskProfile.Loaded) { break }
        Start-Sleep -Milliseconds 500
      } while ([DateTime]::UtcNow -lt $taskProfileDeadline)
      if ($taskProfile) {
        $taskProfilesRoot = [Environment]::ExpandEnvironmentVariables((Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList').ProfilesDirectory)
        $taskExpectedProfile = [IO.Path]::GetFullPath((Join-Path $taskProfilesRoot $taskUsername)).TrimEnd('\')
        if ($taskProfile.Special -or $taskProfile.Loaded -or [IO.Path]::GetFullPath($taskProfile.LocalPath).TrimEnd('\') -ne $taskExpectedProfile) { throw 'Temporary profile did not match the verified idle path; cleanup preserved it.' }
        Remove-CimInstance -InputObject $taskProfile
        if (Get-CimInstance Win32_UserProfile | Where-Object { $_.SID -eq $taskCreatedSid.Value }) { throw 'Temporary profile still exists.' }
      }
      $taskReport.profileRemoved = $true
    } catch { $taskReport.errors += $_.Exception.Message }
  }
  try {
    Assert-TaskSourceRecords $taskMethodSources
    Assert-TaskSourceRecords @($taskChildExecution)
    if ((Get-TaskMethodFingerprint $taskMethodSources) -ne $taskMethodSha256) { throw 'Acceptance method fingerprint changed.' }
  } catch { $taskReport.errors += ('Acceptance method binding: ' + $_.Exception.Message) }
  if ($taskReport.errors.Count -gt 0) { $taskReport.result = 'failed' }
  $taskReport.finishedAtUtc = [DateTime]::UtcNow.ToString('o')
  Write-TaskJson (Join-Path $taskOutput 'isolated-account.json') $taskReport
}
if ($taskReport.result -ne 'passed' -or -not $taskReport.accountRemoved -or -not $taskReport.profileRemoved) { exit 1 }
if ($FixtureScenario) {
  try {
    if (Test-Path -LiteralPath (Join-Path $taskOutput 'shipping-executable-checks-full.json')) { throw 'Fixture-only acceptance must never create or bind a formal installed proof.' }
    if (Test-Path -LiteralPath $taskReport.profileAcceptanceRoot) { throw 'The temporary fixture acceptance root survived profile cleanup.' }
    if ((Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskFixtureDriverSha256 -or (Get-FileHash -LiteralPath $taskHandoffPreparedReport -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskFixturePreparedSha256) { throw 'The driver or exact prepared input changed during fixture acceptance.' }
    if ((Get-Item -LiteralPath $taskDelivery).Length -ne $taskDeliveryBytes -or (Get-FileHash -LiteralPath $taskDelivery -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskDeliverySha256 -or (Get-Item -LiteralPath $taskDeliveryData.executable.path).Length -ne $taskDeliveryData.executable.bytes -or (Get-FileHash -LiteralPath $taskDeliveryData.executable.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskDeliveryData.executable.sha256) { throw 'The static production baseline changed; it was not executed by this fixture-only mode.' }
    $taskExpectedFixtureReports = if ($FixtureScenario -in @('active-uninstall', 'startup-external-data', 'long-root-external-data')) { 1 } else { 3 }
    if (@($taskFixtureEvidenceRecords).Count -ne $taskExpectedFixtureReports) { throw 'The fixture-only mode lost a required actual scenario report.' }
    foreach ($taskFixtureRecord in $taskFixtureEvidenceRecords) {
      Assert-TaskPathNoLinks $taskFixtureRecord.path
      if ((Get-Item -LiteralPath $taskFixtureRecord.path).Length -ne $taskFixtureRecord.bytes -or (Get-FileHash -LiteralPath $taskFixtureRecord.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskFixtureRecord.sha256) { throw 'An actual fixture report changed during account/profile cleanup.' }
    }
    $taskIsolationPath = Join-Path $taskOutput 'isolated-account.json'
    Assert-TaskPathNoLinks $taskIsolationPath
    $taskIsolation = Get-Content -LiteralPath $taskIsolationPath -Raw -Encoding utf8 | ConvertFrom-Json
    if ($taskIsolation.schemaVersion -ne 1 -or $taskIsolation.kind -ne 'temporary-standard-user' -or $taskIsolation.scenario -ne 'fixture-only' -or $taskIsolation.fixtureScenario -ne $FixtureScenario -or $taskIsolation.formalInstallerExecuted -ne $false -or $taskIsolation.result -ne 'passed' -or $taskIsolation.ownerSid -ne $taskCreatedSid.Value -or $taskIsolation.account -ne $taskUsername -or $taskIsolation.freshAccount -ne $true -or $taskIsolation.standardAccount -ne $true -or $taskIsolation.profileLoaded -ne $true -or $taskIsolation.accountRemoved -ne $true -or $taskIsolation.profileRemoved -ne $true -or $taskIsolation.exitCode -ne 0 -or @($taskIsolation.errors).Count -ne 0) { throw 'Fixture-only acceptance requires successful exact isolated-account and profile cleanup.' }
    $taskFixtureWrapper = [ordered]@{
      schemaVersion = 1
      kind = 'fixture-only-acceptance'
      scenario = $FixtureScenario
      result = 'passed'
      fixtureId = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}'
      ownerSid = $taskCreatedSid.Value
      account = $taskUsername
      formalInstallerExecuted = $false
      baselineDelivery = @{ path = $taskDelivery; bytes = $taskDeliveryBytes; sha256 = $taskDeliverySha256; executable = @{ sourcePath = [IO.Path]::GetFullPath($taskDeliveryData.executable.path); path = [IO.Path]::GetFullPath($taskDeliveryData.executable.path); bytes = $taskDeliveryData.executable.bytes; sha256 = $taskDeliveryData.executable.sha256; executed = $false } }
      preparedInput = @{ path = $taskHandoffPreparedReport; sha256 = $taskFixturePreparedSha256 }
      reports = @($taskFixtureEvidenceRecords)
      executionProfileRoot = $taskReport.profileAcceptanceRoot
      accountRemoved = $true
      profileRemoved = $true
      isolationEvidencePath = $taskIsolationPath.Substring($taskRepository.Length + 1).Replace('\', '/')
      isolationEvidenceSha256 = (Get-FileHash -LiteralPath $taskIsolationPath -Algorithm SHA256).Hash.ToLowerInvariant()
      driverSource = @{ path = [IO.Path]::GetFullPath($PSCommandPath); sha256 = $taskFixtureDriverSha256 }
      finishedAtUtc = [DateTime]::UtcNow.ToString('o')
      boundary = 'Fixture GUID scenarios only. The production delivery is a read-only baseline and was not executed. Actual reports retain their original bytes and bind exact prepared sources, Medium profile copies and successful account/profile cleanup. This wrapper is not a formal shipping proof, promotion approval, publication or browser SmartScreen result.'
    }
    Write-TaskNewJson (Join-Path $taskOutput 'fixture-only-evidence.json') $taskFixtureWrapper
  } catch {
    $taskReport.result = 'failed'
    $taskReport.errors += ('Fixture-only binding: ' + $_.Exception.Message)
    Write-TaskJson (Join-Path $taskOutput 'isolated-account.json') $taskReport
    exit 1
  }
  exit 0
}
$taskExecutionReceipt = $null
try {
  $taskProofPath = if ($PortableMigrationOnly) { Join-Path $taskOutput 'portable-migration/report.json' } else { Join-Path $taskOutput 'shipping-executable-checks-full.json' }
  Assert-TaskPathNoLinks $taskProofPath
  $taskProof = Get-Content -LiteralPath $taskProofPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($PortableMigrationOnly) {
    if ($taskProof.schemaVersion -ne 1 -or $taskProof.scenario -ne 'portable-migration' -or $taskProof.result -ne 'passed' -or $taskProof.failures -ne 0 -or (Get-FileHash -LiteralPath $taskProofPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskReport.portableMigrationBeforeIsolationSha256 -or $taskProof.executionProfile.root -ne $taskReport.profileAcceptanceRoot -or $taskProof.executionProfile.ownerSid -ne $taskCreatedSid.Value -or $taskProof.executionProfile.integritySid -ne 'S-1-16-8192') { throw 'Final migration proof changed or did not match the successfully cleaned isolated account.' }
  } else {
  if ($taskProof.result -ne 'passed' -or $taskProof.fixture -or -not $taskProof.isolatedWindows -or -not $taskProof.uninstalled -or $taskProof.ownerSid -ne $taskCreatedSid.Value -or $taskProof.executableSha256 -ne $taskReport.installerSha256) { throw 'Final installed proof did not match the successfully cleaned isolated account.' }
  if (@($taskReport.applicationChainEvidence).Count -ne 3) { throw 'Formal acceptance requires all three complete actual fixture chains.' }
  foreach ($taskChainRecord in $taskReport.applicationChainEvidence) {
    Assert-TaskPathNoLinks $taskChainRecord.path
    if ((Get-Item -LiteralPath $taskChainRecord.path).Length -ne $taskChainRecord.bytes -or (Get-FileHash -LiteralPath $taskChainRecord.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskChainRecord.sha256) { throw 'A required fixture-chain raw report changed during isolated profile cleanup.' }
  }
  $taskProof | Add-Member -NotePropertyName applicationChainEvidence -NotePropertyValue @($taskReport.applicationChainEvidence) -Force
  if ($UseProfileAcceptance) {
    if ($taskProof.executionProfile.root -ne $taskReport.profileAcceptanceRoot -or $taskProof.executionProfile.ownerSid -ne $taskCreatedSid.Value -or $taskProof.executionProfile.integritySid -ne 'S-1-16-8192' -or [IO.Path]::GetFullPath($taskProof.executionCopy.sourcePath) -ne [IO.Path]::GetFullPath($taskDeliveryData.executable.path) -or $taskProof.executionCopy.sha256 -ne $taskReport.installerSha256 -or $taskProof.executionCopy.bytes -ne $taskDeliveryData.executable.bytes -or -not [IO.Path]::GetFullPath($taskProof.executionCopy.path).StartsWith($taskReport.profileAcceptanceRoot + '\work\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Final formal proof did not bind the exact Medium profile execution copy.' }
  }
  }
  if ($UseProfileAcceptance -and (Test-Path -LiteralPath $taskReport.profileAcceptanceRoot)) { throw 'The temporary acceptance root survived isolated profile cleanup.' }
  $taskIsolationPath = Join-Path $taskOutput 'isolated-account.json'
  $taskRelativeIsolationPath = $taskIsolationPath.Substring($taskRepository.Length + 1).Replace('\', '/')
  $taskIsolationHash = (Get-FileHash -LiteralPath $taskIsolationPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if (-not $PortableMigrationOnly) {
    $taskReceiptDelivery = [ordered]@{ path = $taskDelivery; bytes = $taskDeliveryBytes; sha256 = $taskDeliverySha256 }
    $taskExecutionReceipt = Write-TaskExecutionReceipt $taskOutput $taskReceiptDelivery $taskProofPath $taskIsolationPath $taskMethodSources
  }
  $taskProof | Add-Member -NotePropertyName isolationEvidencePath -NotePropertyValue $taskRelativeIsolationPath -Force
  $taskProof | Add-Member -NotePropertyName isolationEvidenceSha256 -NotePropertyValue $taskIsolationHash -Force
  $taskTemporaryProofPath = Join-Path $taskOutput ('proof-' + [Guid]::NewGuid().ToString('N') + '.tmp')
  Write-TaskJson $taskTemporaryProofPath $taskProof
  Move-Item -LiteralPath $taskTemporaryProofPath -Destination $taskProofPath -Force
} catch {
  if ($taskExecutionReceipt) {
    Write-TaskNewJson (Join-Path $taskOutput 'acceptance-binding-error.json') ([ordered]@{ schemaVersion = 1; kind = 'installation-acceptance-binding-error'; result = 'failed'; message = $_.Exception.Message; executionReceipt = $taskExecutionReceipt; isolationPreserved = $true; finishedAtUtc = [DateTime]::UtcNow.ToString('o') })
    exit 1
  }
  $taskReport.result = 'failed'
  $taskReport.errors += ('Acceptance binding: ' + $_.Exception.Message)
  Write-TaskJson (Join-Path $taskOutput 'isolated-account.json') $taskReport
  exit 1
}
