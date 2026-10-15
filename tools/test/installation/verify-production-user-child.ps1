param([string]$Plan)
$ErrorActionPreference = 'Stop'
$taskPlan = Get-Content -LiteralPath $Plan -Raw -Encoding utf8 | ConvertFrom-Json
function Assert-TaskChildSource([string]$Path, $Expected) {
  if (-not $Expected -or $Expected.bytes -lt 1 -or $Expected.sha256 -notmatch '^[a-f0-9]{64}$' -or [IO.Path]::GetFullPath($Path) -ne [IO.Path]::GetFullPath($Expected.path)) { throw 'The isolated child source identity is invalid.' }
  if ((Get-Item -LiteralPath $Path).Length -ne $Expected.bytes -or (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Expected.sha256) { throw 'The isolated child source bytes changed.' }
}
Assert-TaskChildSource $PSCommandPath $taskPlan.childExecution
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
if ($taskPlan.fixtureScenario) {
  if (-not $taskPlan.useProfileAcceptance -or $taskPlan.fixtureScenario -notin @('active-uninstall', 'startup-external-data', 'long-root-external-data', 'chains') -or (Get-FileHash -LiteralPath $taskPlan.handoffPreparedReport -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPlan.fixturePreparedSha256) { throw 'The fixture-only mode or exact prepared input changed.' }
  if ($taskPlan.fixtureScenario -in @('active-uninstall', 'startup-external-data')) {
    $taskActiveEvidence = $taskPlan.activeUninstallEvidence
    $taskActiveArguments = @('--active-uninstall-only', ('--prepared-report=' + $taskPlan.handoffPreparedReport))
    if ($taskPlan.fixtureScenario -eq 'startup-external-data') { $taskActiveEvidence = Join-Path (Split-Path -Parent $taskPlan.evidence) 'application-startup-external-data'; $taskActiveArguments += '--short-external-data' }
    $taskActiveArguments += '--evidence=' + $taskActiveEvidence
    $taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/test/installation/verify-application-handoff.mjs') -NodeArguments $taskActiveArguments -LogPath ($taskActiveEvidence + '.log')
    exit $taskNodeExit
  }
  if ($taskPlan.fixtureScenario -eq 'long-root-external-data') {
    $taskLongEvidence = Join-Path (Split-Path -Parent $taskPlan.evidence) 'application-handoff-long-root-external-data'
    $taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/test/installation/verify-application-handoff.mjs') -NodeArguments @('--long-root-external-data', ('--prepared-report=' + $taskPlan.handoffPreparedReport), ('--evidence=' + $taskLongEvidence)) -LogPath ($taskLongEvidence + '.log')
    exit $taskNodeExit
  }
}
$taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/test/installation/verify-application-handoff.mjs') -NodeArguments @(('--prepared-report=' + $taskPlan.handoffPreparedReport), ('--evidence=' + $taskPlan.handoffEvidence)) -LogPath (Join-Path (Split-Path -Parent $taskPlan.evidence) 'application-handoff.log')
if ($taskNodeExit -ne 0) { exit $taskNodeExit }
$taskLongEvidence = Join-Path (Split-Path -Parent $taskPlan.evidence) 'application-handoff-long-root-external-data'
$taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/test/installation/verify-application-handoff.mjs') -NodeArguments @('--long-root-external-data', ('--prepared-report=' + $taskPlan.handoffPreparedReport), ('--evidence=' + $taskLongEvidence)) -LogPath ($taskLongEvidence + '.log')
if ($taskNodeExit -ne 0) { exit $taskNodeExit }
$taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/test/installation/verify-application-handoff.mjs') -NodeArguments @('--framework-recovery-only', ('--prepared-report=' + $taskPlan.handoffPreparedReport), ('--evidence=' + $taskPlan.frameworkRecoveryEvidence)) -LogPath (Join-Path (Split-Path -Parent $taskPlan.evidence) 'application-framework-recovery.log')
if ($taskNodeExit -ne 0) { exit $taskNodeExit }
if ($taskPlan.fixtureScenario -eq 'chains') { exit 0 }
$taskNodeExit = Invoke-TaskNode -ScriptPath (Join-Path $taskPlan.repository 'tools/release/installation-verifier.mjs') -NodeArguments @(('--delivery=' + $taskPlan.delivery), ('--evidence=' + $taskPlan.evidence), '--isolated-windows') -LogPath (Join-Path (Split-Path -Parent $taskPlan.evidence) 'production-account.log')
exit $taskNodeExit
