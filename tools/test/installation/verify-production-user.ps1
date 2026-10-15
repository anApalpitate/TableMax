[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$DeliveryPath,
  [Parameter(Mandatory)][string]$OutputDirectory,
  [string]$HandoffPreparedReport,
  [switch]$AllowTemporaryAccount,
  [switch]$UseProfileAcceptance,
  [switch]$PortableMigrationOnly,
  [string]$PortablePointer,
  [ValidateRange(0, 2)][int]$PriorFailures = 0
)
$ErrorActionPreference = 'Stop'
$taskRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..')).TrimEnd('\')
$taskOutput = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')
$taskDelivery = [IO.Path]::GetFullPath($DeliveryPath)
$taskHandoffPreparedReport = $null
$taskPortablePointer = $null
if ($PortableMigrationOnly) {
  if (-not $UseProfileAcceptance -or [string]::IsNullOrWhiteSpace($PortablePointer)) { throw 'Portable migration requires UseProfileAcceptance and a frozen PortablePointer copy.' }
  if (-not [string]::IsNullOrWhiteSpace($HandoffPreparedReport)) { throw 'Portable migration is independent of the application handoff prepared report.' }
  $taskPortablePointer = [IO.Path]::GetFullPath($PortablePointer)
} else {
  if ([string]::IsNullOrWhiteSpace($HandoffPreparedReport)) { throw 'The complete application chain requires HandoffPreparedReport.' }
  if (-not [string]::IsNullOrWhiteSpace($PortablePointer)) { throw 'PortablePointer is only valid with PortableMigrationOnly.' }
  $taskHandoffPreparedReport = [IO.Path]::GetFullPath($HandoffPreparedReport)
}
function Write-TaskJson([string]$Path, $Value, [int]$Depth = 100) {
  [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth $Depth) + "`n", [Text.UTF8Encoding]::new($false))
}
function Assert-TaskPathNoLinks([string]$Path) {
  for ($taskCursor = [IO.Path]::GetFullPath($Path); $taskCursor; $taskCursor = [IO.Path]::GetDirectoryName($taskCursor)) {
    if (Test-Path -LiteralPath $taskCursor) {
      if ((Get-Item -LiteralPath $taskCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Verification path contains a link.' }
    }
  }
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
$taskUsername = 'TMVerify_' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$taskWork = Join-Path $taskRepository ('tmp\installation-user-' + [Guid]::NewGuid().ToString('N'))
Assert-TaskPathNoLinks $taskWork
New-Item -ItemType Directory -Path $taskWork | Out-Null
Assert-TaskPathNoLinks $taskWork
New-Item -ItemType Directory -Path $taskOutput | Out-Null
Assert-TaskPathNoLinks $taskOutput
$taskReport = [ordered]@{ schemaVersion = 1; kind = $(if ($PortableMigrationOnly) { 'temporary-standard-user-portable-migration' } else { 'temporary-standard-user' }); startedAtUtc = [DateTime]::UtcNow.ToString('o'); result = 'started'; account = $taskUsername; ownerSid = $null; freshAccount = $false; standardAccount = $false; profileLoaded = $false; installerSha256 = $taskDeliveryData.executable.sha256; accountRemoved = $false; profileRemoved = $false; errors = @() }
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
  $taskSourceNode = Join-Path $taskRepository '.cache/node/22.14.0/runtime/node.exe'
  @{ repository = $taskRepository; delivery = $taskDelivery; handoffPreparedReport = $taskHandoffPreparedReport; handoffEvidence = (Join-Path $taskOutput 'application-handoff'); frameworkRecoveryEvidence = (Join-Path $taskOutput 'application-framework-recovery'); evidence = (Join-Path $taskOutput 'shipping-executable-checks-full.json'); portableMigrationOnly = [bool]$PortableMigrationOnly; portablePointer = $taskPortablePointer; portablePointerBytes = $taskPortablePointerBytes; portablePointerSha256 = $taskPortablePointerSha256; portableMigrationEvidence = (Join-Path $taskOutput 'portable-migration'); priorFailures = $PriorFailures; accountSid = $taskCreatedSid.Value; work = $taskWork; useProfileAcceptance = [bool]$UseProfileAcceptance; sourceNode = $taskSourceNode; sourceNodeBytes = (Get-Item -LiteralPath $taskSourceNode).Length; sourceNodeSha256 = (Get-FileHash -LiteralPath $taskSourceNode -Algorithm SHA256).Hash.ToLowerInvariant() } | ConvertTo-Json | Set-Content -LiteralPath $taskPlan -Encoding utf8
  $taskChildSource = @'
param([string]$Plan)
$ErrorActionPreference = 'Stop'
$taskPlan = Get-Content -LiteralPath $Plan -Raw -Encoding utf8 | ConvertFrom-Json
function Invoke-TaskNode([string]$ScriptPath, [string[]]$NodeArguments, [string]$LogPath) {
  $taskArguments = @($ScriptPath) + @($NodeArguments)
  foreach ($taskArgument in $taskArguments) {
    if ($taskArgument.Contains('"') -or $taskArgument.EndsWith('\')) { throw 'Unsafe Node argument.' }
  }
  $taskExecutable = if ([string]::IsNullOrEmpty($taskNodeExecutable)) { Join-Path $taskPlan.repository '.cache/node/22.14.0/runtime/node.exe' } else { $taskNodeExecutable }
  $taskStart = [Diagnostics.ProcessStartInfo]::new($taskExecutable)
  $taskStart.Arguments = [string]::Join(' ', [string[]]@($taskArguments | ForEach-Object { '"' + $_ + '"' }))
  $taskStart.WorkingDirectory = $taskPlan.repository
  $taskStart.UseShellExecute = $false
  $taskStart.CreateNoWindow = $true
  $taskStart.RedirectStandardOutput = $true
  $taskStart.RedirectStandardError = $true
  $taskStart.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
  $taskStart.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
  $taskNative = $null
  $taskStdout = $null
  $taskStderr = $null
  try {
    $taskNative = [Diagnostics.Process]::Start($taskStart)
    if (-not $taskNative) { throw 'The verifier Node process did not start.' }
    $taskStdout = $taskNative.StandardOutput.ReadToEndAsync()
    $taskStderr = $taskNative.StandardError.ReadToEndAsync()
    if (-not $taskNative.WaitForExit(1860000)) { throw 'The verifier Node process exceeded its bounded budget.' }
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($taskStdout, $taskStderr), 5000)) { throw 'The verifier Node output did not drain.' }
    $taskNative.Refresh()
    $taskNativeExit = $taskNative.ExitCode
  } finally {
    if ($taskNative) {
      if (-not $taskNative.HasExited) { $taskNative.Kill(); $null = $taskNative.WaitForExit(5000) }
      $taskNative.Dispose()
    }
    $taskOut = if ($taskStdout -and $taskStdout.Status -eq [Threading.Tasks.TaskStatus]::RanToCompletion) { $taskStdout.Result } else { '[stdout did not drain]' }
    $taskErr = if ($taskStderr -and $taskStderr.Status -eq [Threading.Tasks.TaskStatus]::RanToCompletion) { $taskStderr.Result } else { '[stderr did not drain]' }
    [IO.File]::WriteAllText($LogPath, $taskOut + "`n[stderr]`n" + $taskErr, [Text.UTF8Encoding]::new($false))
  }
  return $taskNativeExit
}
if ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne $taskPlan.accountSid) { throw 'Wrong test account.' }
if (([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Installer acceptance must use a standard account.' }
Set-Location -LiteralPath $taskPlan.repository
foreach ($taskVariable in @(Get-ChildItem Env: | Where-Object { $_.Name -like 'TABLEMAX_*' -or $_.Name -like 'WEBVIEW2_*' -or $_.Name -in @('NODE_OPTIONS','NODE_PATH') })) {
  Remove-Item -LiteralPath ('Env:\' + $taskVariable.Name)
}
$env:TABLEMAX_ISOLATED_WINDOWS_ACCEPTANCE = '1'
$env:TABLEMAX_AUTO_MAINTENANCE = '0'
$env:TABLEMAX_TEST_MAINTENANCE = '0'
$env:TABLEMAX_INSTALLATION_VERIFY_TMP = $taskPlan.work
$env:TABLEMAX_INSTALLATION_HANDOFF_TMP = $taskPlan.work
$env:TEMP = $taskPlan.work
$env:TMP = $taskPlan.work
$env:TABLEMAX_HOST = '127.0.0.1'
$env:TABLEMAX_PORT = '0'
$taskProfilePath = [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
if ([IO.Path]::GetFileName($taskProfilePath) -notlike 'TMVerify_*') { throw 'The isolated user profile was not loaded.' }
$env:USERPROFILE = $taskProfilePath
$taskLocalAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData, [Environment+SpecialFolderOption]::DoNotVerify)
$taskRoamingAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData, [Environment+SpecialFolderOption]::DoNotVerify)
foreach ($taskProfileMember in @($taskLocalAppData, $taskRoamingAppData)) {
  if (-not $taskProfileMember -or -not [IO.Path]::GetFullPath($taskProfileMember).StartsWith($taskProfilePath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'The child application-data directory does not belong to the isolated profile.' }
}
$env:LOCALAPPDATA = $taskLocalAppData
$env:APPDATA = $taskRoamingAppData
$env:HOMEDRIVE = [IO.Path]::GetPathRoot($taskProfilePath).TrimEnd('\')
$env:HOMEPATH = $taskProfilePath.Substring($env:HOMEDRIVE.Length)
$taskActualIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name.Split('\')
$env:USERNAME = $taskActualIdentity[$taskActualIdentity.Length - 1]
$env:USERDOMAIN = $taskActualIdentity[0]
$taskNodeExecutable = $taskPlan.sourceNode
$taskProfileAcceptanceRoot = $null
if ($taskPlan.useProfileAcceptance) {
  function Assert-TaskProfilePathNoLinks([string]$Path) {
    for ($taskCursor = [IO.Path]::GetFullPath($Path); $taskCursor; $taskCursor = [IO.Path]::GetDirectoryName($taskCursor)) {
      if ((Test-Path -LiteralPath $taskCursor) -and ((Get-Item -LiteralPath $taskCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'The isolated profile path contains a link.' }
    }
  }
  $taskProfileAcceptanceParent = Join-Path $taskLocalAppData 'TableMaxAcceptance'
  Assert-TaskProfilePathNoLinks $taskProfileAcceptanceParent
  if (-not (Test-Path -LiteralPath $taskProfileAcceptanceParent)) { New-Item -ItemType Directory -Path $taskProfileAcceptanceParent | Out-Null }
  $taskProfileAcceptanceRoot = Join-Path $taskProfileAcceptanceParent ([Guid]::NewGuid().ToString('N'))
  if (Test-Path -LiteralPath $taskProfileAcceptanceRoot) { throw 'The private profile acceptance root already exists.' }
  New-Item -ItemType Directory -Path $taskProfileAcceptanceRoot | Out-Null
  $taskProfileWork = Join-Path $taskProfileAcceptanceRoot 'work'
  New-Item -ItemType Directory -Path $taskProfileWork | Out-Null
  $taskProfileTools = Join-Path $taskProfileAcceptanceRoot 'tools'
  New-Item -ItemType Directory -Path $taskProfileTools | Out-Null
  Assert-TaskProfilePathNoLinks $taskProfileTools
  $taskNodeExecutable = Join-Path $taskProfileTools 'node.exe'
  if ((Get-Item -LiteralPath $taskPlan.sourceNode).Length -ne $taskPlan.sourceNodeBytes -or (Get-FileHash -LiteralPath $taskPlan.sourceNode -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPlan.sourceNodeSha256) { throw 'The pinned source Node changed before profile materialization.' }
  $taskNodeInput = [IO.File]::OpenRead($taskPlan.sourceNode)
  try {
    $taskNodeOutput = [IO.FileStream]::new($taskNodeExecutable, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $taskNodeInput.CopyTo($taskNodeOutput) } finally { $taskNodeOutput.Dispose() }
  } finally { $taskNodeInput.Dispose() }
  if ((Get-Item -LiteralPath $taskNodeExecutable).Length -ne $taskPlan.sourceNodeBytes -or (Get-FileHash -LiteralPath $taskNodeExecutable -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPlan.sourceNodeSha256 -or (Get-FileHash -LiteralPath $taskPlan.sourceNode -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPlan.sourceNodeSha256) { throw 'The profile Node must contain the exact pinned source bytes.' }
  $env:TABLEMAX_WINDOWS_ACCEPTANCE_PROFILE_ROOT = $taskProfileAcceptanceRoot
  $env:TABLEMAX_WINDOWS_ACCEPTANCE_PROFILE_SID = $taskPlan.accountSid
  $env:TABLEMAX_INSTALLATION_VERIFY_TMP = $taskProfileWork
  $env:TABLEMAX_INSTALLATION_HANDOFF_TMP = $taskProfileWork
  if ($taskPlan.portableMigrationOnly) { $env:TABLEMAX_INSTALLATION_MIGRATION_TMP = $taskProfileWork }
  $env:TEMP = $taskProfileWork
  $env:TMP = $taskProfileWork
}
$taskIdentityJson = @{ sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value; profile = $taskProfilePath; localAppData = $taskLocalAppData; roamingAppData = $taskRoamingAppData; hkcu = (Get-Item -LiteralPath 'HKCU:\').Name; standardAccount = $true; inheritedApplicationEnvironmentCleared = $true; isolatedProfileEnvironmentNormalized = $true; profileAcceptanceRoot = $taskProfileAcceptanceRoot; nodeExecutable = $taskNodeExecutable; nodeSha256 = $taskPlan.sourceNodeSha256; nodeBytes = $taskPlan.sourceNodeBytes; executableSecurityMetadataCopied = $false } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path (Split-Path -Parent $taskPlan.evidence) 'user-identity.json'), $taskIdentityJson + "`n", [Text.UTF8Encoding]::new($false))
foreach ($taskInput in @('tools/release/installation-verifier.mjs','.cache/node/22.14.0/runtime/node.exe')) {
  $taskStream = [IO.File]::OpenRead((Join-Path $taskPlan.repository $taskInput)); $taskStream.Dispose()
}
$taskStream = [IO.File]::OpenRead($taskPlan.delivery); $taskStream.Dispose()
if ($taskPlan.portableMigrationOnly) {
  if (-not $taskPlan.useProfileAcceptance -or (Get-Item -LiteralPath $taskPlan.portablePointer).Length -ne $taskPlan.portablePointerBytes -or (Get-FileHash -LiteralPath $taskPlan.portablePointer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPlan.portablePointerSha256) { throw 'The frozen portable pointer or isolated profile mode changed.' }
  $taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/test/installation/verify-portable-migration.mjs') -NodeArguments @(('--delivery=' + $taskPlan.delivery), ('--portable-pointer=' + $taskPlan.portablePointer), ('--evidence=' + $taskPlan.portableMigrationEvidence), ('--prior-failures=' + $taskPlan.priorFailures)) -LogPath (Join-Path (Split-Path -Parent $taskPlan.evidence) 'portable-migration.log')
  exit $taskNodeExit
}
$taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/test/installation/verify-application-handoff.mjs') -NodeArguments @(('--prepared-report=' + $taskPlan.handoffPreparedReport), ('--evidence=' + $taskPlan.handoffEvidence)) -LogPath (Join-Path (Split-Path -Parent $taskPlan.evidence) 'application-handoff.log')
if ($taskNodeExit -ne 0) { exit $taskNodeExit }
$taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/test/installation/verify-application-handoff.mjs') -NodeArguments @('--framework-recovery-only', ('--prepared-report=' + $taskPlan.handoffPreparedReport), ('--evidence=' + $taskPlan.frameworkRecoveryEvidence)) -LogPath (Join-Path (Split-Path -Parent $taskPlan.evidence) 'application-framework-recovery.log')
if ($taskNodeExit -ne 0) { exit $taskNodeExit }
$taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/release/installation-verifier.mjs') -NodeArguments @(('--delivery=' + $taskPlan.delivery), ('--evidence=' + $taskPlan.evidence), '--isolated-windows') -LogPath (Join-Path (Split-Path -Parent $taskPlan.evidence) 'production-account.log')
exit $taskNodeExit
'@
  $taskRunnerPath = Join-Path $taskWork 'run.ps1'
  Set-Content -LiteralPath $taskRunnerPath -Value $taskChildSource -Encoding utf8
  $taskCredentials = [Management.Automation.PSCredential]::new($env:COMPUTERNAME + '\' + $taskUsername, $taskPassword)
  $taskRunner = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"' + $taskRunnerPath + '"'),'-Plan',('"' + $taskPlan + '"')) -Credential $taskCredentials -LoadUserProfile -WorkingDirectory $taskWork -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskOutput 'account-runner.stdout.log') -RedirectStandardError (Join-Path $taskOutput 'account-runner.stderr.log') -PassThru
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
      foreach ($taskCheck in @('portable10-native-generated-saved-player','portable10-source-idle-complete-inventory','actual-inno-migration','installed14-managed-members-and-receipt','saved-player-and-storage-restored','old-source-and-games-preserved','actual-default-uninstall','data-games-config-and-source-preserved-after-uninstall')) {
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
  if ($taskReport.errors.Count -gt 0) { $taskReport.result = 'failed' }
  $taskReport.finishedAtUtc = [DateTime]::UtcNow.ToString('o')
  Write-TaskJson (Join-Path $taskOutput 'isolated-account.json') $taskReport
}
if ($taskReport.result -ne 'passed' -or -not $taskReport.accountRemoved -or -not $taskReport.profileRemoved) { exit 1 }
try {
  $taskProofPath = if ($PortableMigrationOnly) { Join-Path $taskOutput 'portable-migration/report.json' } else { Join-Path $taskOutput 'shipping-executable-checks-full.json' }
  Assert-TaskPathNoLinks $taskProofPath
  $taskProof = Get-Content -LiteralPath $taskProofPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($PortableMigrationOnly) {
    if ($taskProof.schemaVersion -ne 1 -or $taskProof.scenario -ne 'portable-migration' -or $taskProof.result -ne 'passed' -or $taskProof.failures -ne 0 -or (Get-FileHash -LiteralPath $taskProofPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskReport.portableMigrationBeforeIsolationSha256 -or $taskProof.executionProfile.root -ne $taskReport.profileAcceptanceRoot -or $taskProof.executionProfile.ownerSid -ne $taskCreatedSid.Value -or $taskProof.executionProfile.integritySid -ne 'S-1-16-8192') { throw 'Final migration proof changed or did not match the successfully cleaned isolated account.' }
  } else {
  if ($taskProof.result -ne 'passed' -or $taskProof.fixture -or -not $taskProof.isolatedWindows -or -not $taskProof.uninstalled -or $taskProof.ownerSid -ne $taskCreatedSid.Value -or $taskProof.executableSha256 -ne $taskReport.installerSha256) { throw 'Final installed proof did not match the successfully cleaned isolated account.' }
  if ($UseProfileAcceptance) {
    if ($taskProof.executionProfile.root -ne $taskReport.profileAcceptanceRoot -or $taskProof.executionProfile.ownerSid -ne $taskCreatedSid.Value -or $taskProof.executionProfile.integritySid -ne 'S-1-16-8192' -or [IO.Path]::GetFullPath($taskProof.executionCopy.sourcePath) -ne [IO.Path]::GetFullPath($taskDeliveryData.executable.path) -or $taskProof.executionCopy.sha256 -ne $taskReport.installerSha256 -or $taskProof.executionCopy.bytes -ne $taskDeliveryData.executable.bytes -or -not [IO.Path]::GetFullPath($taskProof.executionCopy.path).StartsWith($taskReport.profileAcceptanceRoot + '\work\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Final formal proof did not bind the exact Medium profile execution copy.' }
  }
  }
  if ($UseProfileAcceptance -and (Test-Path -LiteralPath $taskReport.profileAcceptanceRoot)) { throw 'The temporary acceptance root survived isolated profile cleanup.' }
  $taskIsolationPath = Join-Path $taskOutput 'isolated-account.json'
  $taskRelativeIsolationPath = $taskIsolationPath.Substring($taskRepository.Length + 1).Replace('\', '/')
  $taskIsolationHash = (Get-FileHash -LiteralPath $taskIsolationPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $taskProof | Add-Member -NotePropertyName isolationEvidencePath -NotePropertyValue $taskRelativeIsolationPath -Force
  $taskProof | Add-Member -NotePropertyName isolationEvidenceSha256 -NotePropertyValue $taskIsolationHash -Force
  $taskTemporaryProofPath = Join-Path $taskOutput ('proof-' + [Guid]::NewGuid().ToString('N') + '.tmp')
  Write-TaskJson $taskTemporaryProofPath $taskProof
  Move-Item -LiteralPath $taskTemporaryProofPath -Destination $taskProofPath -Force
} catch {
  $taskReport.result = 'failed'
  $taskReport.errors += ('Acceptance binding: ' + $_.Exception.Message)
  Write-TaskJson (Join-Path $taskOutput 'isolated-account.json') $taskReport
  exit 1
}
