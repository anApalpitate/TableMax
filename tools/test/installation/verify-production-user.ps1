[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$DeliveryPath,
  [Parameter(Mandatory)][string]$OutputDirectory,
  [Parameter(Mandatory)][string]$HandoffPreparedReport,
  [switch]$AllowTemporaryAccount
)
$ErrorActionPreference = 'Stop'
$taskRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..')).TrimEnd('\')
$taskOutput = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')
$taskDelivery = [IO.Path]::GetFullPath($DeliveryPath)
$taskHandoffPreparedReport = [IO.Path]::GetFullPath($HandoffPreparedReport)
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
if (-not $taskHandoffPreparedReport.StartsWith($taskRepository + '\artifacts\maintenance\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Prepared handoff evidence must be a workspace maintenance file.' }
Assert-TaskPathNoLinks $taskDelivery
Assert-TaskPathNoLinks $taskHandoffPreparedReport
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
$taskUsername = 'TMVerify_' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$taskWork = Join-Path $taskRepository ('tmp\installation-user-' + [Guid]::NewGuid().ToString('N'))
Assert-TaskPathNoLinks $taskWork
New-Item -ItemType Directory -Path $taskWork | Out-Null
Assert-TaskPathNoLinks $taskWork
New-Item -ItemType Directory -Path $taskOutput | Out-Null
Assert-TaskPathNoLinks $taskOutput
$taskReport = [ordered]@{ schemaVersion = 1; kind = 'temporary-standard-user'; startedAtUtc = [DateTime]::UtcNow.ToString('o'); result = 'started'; account = $taskUsername; ownerSid = $null; freshAccount = $false; standardAccount = $false; profileLoaded = $false; installerSha256 = $taskDeliveryData.executable.sha256; accountRemoved = $false; profileRemoved = $false; errors = @() }
$taskCreatedSid = $null
$taskRunner = $null
try {
  $taskRandom = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($taskRandom)
  $taskPassword = ConvertTo-SecureString ('aA1!' + [Convert]::ToBase64String($taskRandom)) -AsPlainText -Force
  $taskUser = New-LocalUser -Name $taskUsername -Password $taskPassword -Description 'Temporary TableMax installer acceptance; remove after this run.' -AccountNeverExpires -UserMayNotChangePassword
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
  @{ repository = $taskRepository; delivery = $taskDelivery; handoffPreparedReport = $taskHandoffPreparedReport; handoffEvidence = (Join-Path $taskOutput 'application-handoff'); evidence = (Join-Path $taskOutput 'shipping-executable-checks-full.json'); accountSid = $taskCreatedSid.Value; work = $taskWork } | ConvertTo-Json | Set-Content -LiteralPath $taskPlan -Encoding utf8
  $taskChildSource = @'
param([string]$Plan)
$ErrorActionPreference = 'Stop'
$taskPlan = Get-Content -LiteralPath $Plan -Raw -Encoding utf8 | ConvertFrom-Json
if ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne $taskPlan.accountSid) { throw 'Wrong test account.' }
if (([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Installer acceptance must use a standard account.' }
Set-Location -LiteralPath $taskPlan.repository
foreach ($taskVariable in @(Get-ChildItem Env: | Where-Object { $_.Name -like 'TABLEMAX_*' -or $_.Name -in @('NODE_OPTIONS','NODE_PATH') })) {
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
$taskIdentityJson = @{ sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value; profile = $taskProfilePath; hkcu = (Get-Item -LiteralPath 'HKCU:\').Name; standardAccount = $true; inheritedApplicationEnvironmentCleared = $true } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path (Split-Path -Parent $taskPlan.evidence) 'user-identity.json'), $taskIdentityJson + "`n", [Text.UTF8Encoding]::new($false))
foreach ($taskInput in @('tools/release/installation-verifier.mjs','.cache/node/22.14.0/runtime/node.exe')) {
  $taskStream = [IO.File]::OpenRead((Join-Path $taskPlan.repository $taskInput)); $taskStream.Dispose()
}
$taskStream = [IO.File]::OpenRead($taskPlan.delivery); $taskStream.Dispose()
& (Join-Path $taskPlan.repository '.cache/node/22.14.0/runtime/node.exe') (Join-Path $taskPlan.repository 'tools/test/installation/verify-application-handoff.mjs') ('--prepared-report=' + $taskPlan.handoffPreparedReport) ('--evidence=' + $taskPlan.handoffEvidence) *> (Join-Path (Split-Path -Parent $taskPlan.evidence) 'application-handoff.log')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& (Join-Path $taskPlan.repository '.cache/node/22.14.0/runtime/node.exe') (Join-Path $taskPlan.repository 'tools/release/installation-verifier.mjs') ('--delivery=' + $taskPlan.delivery) ('--evidence=' + $taskPlan.evidence) --isolated-windows *> (Join-Path (Split-Path -Parent $taskPlan.evidence) 'production-account.log')
exit $LASTEXITCODE
'@
  $taskRunnerPath = Join-Path $taskWork 'run.ps1'
  Set-Content -LiteralPath $taskRunnerPath -Value $taskChildSource -Encoding utf8
  $taskCredentials = [Management.Automation.PSCredential]::new($env:COMPUTERNAME + '\' + $taskUsername, $taskPassword)
  $taskRunner = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"' + $taskRunnerPath + '"'),'-Plan',('"' + $taskPlan + '"')) -Credential $taskCredentials -LoadUserProfile -WorkingDirectory $taskWork -WindowStyle Hidden -PassThru
  if (-not $taskRunner.WaitForExit(1860000)) { throw 'Isolated installer verification exceeded its bounded budget.' }
  $taskReport.exitCode = $taskRunner.ExitCode
  if ($taskRunner.ExitCode -ne 0) { throw 'Isolated installer verification failed; inspect its saved evidence.' }
  $taskUserIdentity = Get-Content -LiteralPath (Join-Path $taskOutput 'user-identity.json') -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskUserIdentity.sid -ne $taskCreatedSid.Value -or -not $taskUserIdentity.standardAccount -or [IO.Path]::GetFileName($taskUserIdentity.profile) -ne $taskUsername) { throw 'Actual loaded standard-account identity did not match the new account.' }
  $taskHandoffProofPath = Join-Path $taskOutput 'application-handoff/report.json'
  Assert-TaskPathNoLinks $taskHandoffProofPath
  $taskHandoffProof = Get-Content -LiteralPath $taskHandoffProofPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskHandoffProof.result -ne 'passed' -or $taskHandoffProof.failures -ne 0 -or @($taskHandoffProof.steps | Where-Object { $_.result -ne 'passed' }).Count -ne 0) { throw 'The actual Apply chain did not pass; prepared-only or exit-code-only evidence is insufficient.' }
  foreach ($taskRequiredStep in @('actual-old-inno-install','actual-old-host-transport','actual-check-download','real-apply-parent-handoff','actual-new-persistent-host','handoff-helper-and-data')) {
    if (@($taskHandoffProof.steps | Where-Object { $_.id -eq $taskRequiredStep -and $_.result -eq 'passed' }).Count -ne 1) { throw 'The actual Apply proof is missing a required unique step.' }
  }
  $taskReport.handoffEvidencePath = $taskHandoffProofPath.Substring($taskRepository.Length + 1).Replace('\', '/')
  $taskReport.handoffEvidenceSha256 = (Get-FileHash -LiteralPath $taskHandoffProofPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $taskReport.handoffPreparedSha256 = (Get-FileHash -LiteralPath $taskHandoffPreparedReport -Algorithm SHA256).Hash.ToLowerInvariant()
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
      foreach ($taskProcess in Get-CimInstance Win32_Process) {
        $taskHandle = $null
        try { $taskOwner = Invoke-CimMethod -InputObject $taskProcess -MethodName GetOwnerSid }
        catch { continue }
        if ($taskOwner.ReturnValue -ne 0 -or $taskOwner.Sid -ne $taskCreatedSid.Value) { continue }
        try {
          $taskHandle = [Diagnostics.Process]::GetProcessById($taskProcess.ProcessId)
          $null = $taskHandle.Handle
          if ([Math]::Floor($taskHandle.StartTime.ToUniversalTime().Ticks / 10) -ne [Math]::Floor($taskProcess.CreationDate.ToUniversalTime().Ticks / 10)) { continue }
          $taskOwner = Invoke-CimMethod -InputObject $taskProcess -MethodName GetOwnerSid
          if ($taskOwner.Sid -eq $taskCreatedSid.Value) {
            $taskHandle.Kill()
            if (-not $taskHandle.WaitForExit(5000)) { throw 'An isolated-account process did not exit.' }
          }
        } catch [ArgumentException] { }
        catch { $taskReport.errors += ('Isolated process cleanup: ' + $_.Exception.Message) }
        finally { if ($taskHandle) { $taskHandle.Dispose() } }
      }
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
  $taskProofPath = Join-Path $taskOutput 'shipping-executable-checks-full.json'
  Assert-TaskPathNoLinks $taskProofPath
  $taskProof = Get-Content -LiteralPath $taskProofPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($taskProof.result -ne 'passed' -or $taskProof.fixture -or -not $taskProof.isolatedWindows -or -not $taskProof.uninstalled -or $taskProof.ownerSid -ne $taskCreatedSid.Value -or $taskProof.executableSha256 -ne $taskReport.installerSha256) { throw 'Final installed proof did not match the successfully cleaned isolated account.' }
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
