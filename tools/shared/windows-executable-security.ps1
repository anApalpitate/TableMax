[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$LiteralPath,
  [ValidateSet('Read', 'NormalizeBuilt')][string]$Mode = 'Read'
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
# All native source is static. File paths enter only through explicit parameters.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class TableMaxExecutableSecurity {
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode)] static extern uint GetNamedSecurityInfo(string path, int kind, uint information, out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool ConvertSecurityDescriptorToStringSecurityDescriptor(IntPtr descriptor, uint revision, uint information, out IntPtr text, out uint length);
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool ConvertSidToStringSid(IntPtr sid, out IntPtr text);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetAce(IntPtr acl, uint index, out IntPtr ace);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
  static string Sddl(IntPtr descriptor, uint information) {
    IntPtr text; uint length;
    if (!ConvertSecurityDescriptorToStringSecurityDescriptor(descriptor, 1, information, out text, out length)) throw new Win32Exception(Marshal.GetLastWin32Error());
    try { return Marshal.PtrToStringUni(text); } finally { LocalFree(text); }
  }
  static string Sid(IntPtr sid) {
    IntPtr text;
    if (!ConvertSidToStringSid(sid, out text)) throw new Win32Exception(Marshal.GetLastWin32Error());
    try { return Marshal.PtrToStringUni(text); } finally { LocalFree(text); }
  }
  public static object Read(string path) {
    IntPtr owner, group, dacl, sacl, descriptor;
    // OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION | LABEL_SECURITY_INFORMATION.
    uint error = GetNamedSecurityInfo(path, 1, 0x15, out owner, out group, out dacl, out sacl, out descriptor);
    if (error != 0) throw new Win32Exception((int)error);
    try {
      var labels = new List<object>();
      if (sacl != IntPtr.Zero) {
        int count = (ushort)Marshal.ReadInt16(sacl, 4);
        for (uint i = 0; i < count; i++) {
          IntPtr ace;
          if (!GetAce(sacl, i, out ace)) throw new Win32Exception(Marshal.GetLastWin32Error());
          if (Marshal.ReadByte(ace) != 0x11) throw new InvalidOperationException("Unexpected ACE in LABEL_SECURITY_INFORMATION");
          string sid = Sid(IntPtr.Add(ace, 8));
          labels.Add(new { sid, rid = UInt32.Parse(sid.Substring(sid.LastIndexOf('-') + 1)), inherited = (Marshal.ReadByte(ace, 1) & 0x10) != 0, mask = (uint)Marshal.ReadInt32(ace, 4) });
        }
      }
      return new { ownerSid = Sid(owner), ownerSddl = Sddl(descriptor, 1), daclSddl = Sddl(descriptor, 4), labelSddl = Sddl(descriptor, 0x10), labels = labels.ToArray() };
    } finally { LocalFree(descriptor); }
  }
}
'@
function Get-TaskSha256([byte[]]$Bytes) {
  $taskSha = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($taskSha.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant() }
  finally { $taskSha.Dispose() }
}
function Assert-TaskSafeFile([string]$Path) {
  if ($Path -notmatch '^[a-zA-Z]:\\' -or $Path.Substring(2).Contains(':') -or $Path -match '[\x00-\x1f<>"|?*]' -or $Path -notmatch '(?i)\.exe$') { throw 'Only an ordinary local EXE path is allowed.' }
  foreach ($taskPart in $Path.Substring(3).Split('\')) {
    if (-not $taskPart -or $taskPart -in @('.', '..') -or $taskPart -match '[. ]$') { throw 'Ambiguous executable path.' }
  }
  for ($taskCursor = $Path; $taskCursor; $taskCursor = [IO.Path]::GetDirectoryName($taskCursor)) {
    $taskItem = Get-Item -LiteralPath $taskCursor -Force
    if ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked executable path is forbidden.' }
  }
  if (-not [IO.File]::Exists($Path)) { throw 'Executable must be an existing file.' }
}
function Read-TaskSecurity([string]$Path) {
  Assert-TaskSafeFile $Path
  $taskFile = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  try {
    $taskSha = [Security.Cryptography.SHA256]::Create()
    try { $taskDigest = [BitConverter]::ToString($taskSha.ComputeHash($taskFile)).Replace('-', '').ToLowerInvariant() }
    finally { $taskSha.Dispose() }
    $taskSecurity = [TableMaxExecutableSecurity]::Read($Path)
    $taskStreams = @()
    foreach ($taskStream in @(Get-Item -LiteralPath $Path -Stream '*' -ErrorAction Stop | Sort-Object Stream)) {
      if ($taskStream.Stream -eq ':$DATA' -or $taskStream.Stream -eq '$DATA') { continue }
      $taskStreamBytes = [IO.File]::ReadAllBytes($Path + ':' + $taskStream.Stream)
      if ($taskStreamBytes.LongLength -ne $taskStream.Length) { throw 'Alternate stream changed during inspection.' }
      $taskZoneId = $null
      if ($taskStream.Stream -ieq 'Zone.Identifier') {
        $taskMemory = [IO.MemoryStream]::new($taskStreamBytes, $false)
        $taskReader = [IO.StreamReader]::new($taskMemory, [Text.Encoding]::UTF8, $true)
        try { $taskZoneText = $taskReader.ReadToEnd() } finally { $taskReader.Dispose() }
        $taskZoneMatches = [regex]::Matches($taskZoneText, '(?im)^\s*ZoneId\s*=\s*(\d+)\s*$')
        if ($taskZoneMatches.Count -eq 1) { $taskZoneId = [long]::Parse($taskZoneMatches[0].Groups[1].Value) }
      }
      $taskStreams += [ordered]@{ name = $taskStream.Stream; bytes = $taskStreamBytes.LongLength; sha256 = (Get-TaskSha256 $taskStreamBytes); zoneId = $taskZoneId }
    }
    $taskSignature = Get-AuthenticodeSignature -LiteralPath $Path
    $taskCertificate = $null
    if ($taskSignature.SignerCertificate) { $taskCertificate = Get-TaskSha256 $taskSignature.SignerCertificate.RawData }
    $taskTimestampCertificate = $null
    if ($taskSignature.TimeStamperCertificate) { $taskTimestampCertificate = Get-TaskSha256 $taskSignature.TimeStamperCertificate.RawData }
    $taskLabels = @($taskSecurity.labels)
    $taskRid = 8192
    if ($taskLabels.Count -eq 1) { $taskRid = $taskLabels[0].rid }
    elseif ($taskLabels.Count -gt 1) { $taskRid = $null }
    return [ordered]@{
      schemaVersion = 1; kind = 'windows-executable-security'; path = $Path; bytes = $taskFile.Length; sha256 = $taskDigest
      securityInformation = 21; ownerSid = $taskSecurity.ownerSid; ownerSddl = $taskSecurity.ownerSddl; ownerSha256 = (Get-TaskSha256 ([Text.Encoding]::UTF8.GetBytes($taskSecurity.ownerSddl))); daclSddl = $taskSecurity.daclSddl; daclSha256 = (Get-TaskSha256 ([Text.Encoding]::UTF8.GetBytes($taskSecurity.daclSddl)))
      labelSddl = $taskSecurity.labelSddl; integritySid = $(if ($null -eq $taskRid) { $null } else { 'S-1-16-' + $taskRid }); integrity = [ordered]@{ source = $(if ($taskLabels.Count -eq 0) { 'windows-default-medium' } else { 'mandatory-label' }); rid = $taskRid; labels = $taskLabels }
      streams = @($taskStreams); authenticode = [ordered]@{ status = $taskSignature.Status.ToString(); signerCertificateSha256 = $taskCertificate; timestampCertificateSha256 = $taskTimestampCertificate }
    }
  } finally { $taskFile.Dispose() }
}
$taskPath = $LiteralPath.Replace('/', '\')
Assert-TaskSafeFile $taskPath
$taskBefore = Read-TaskSecurity $taskPath
if ($Mode -eq 'Read') { $taskResult = $taskBefore }
else {
  $taskRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
  $taskDevelopmentExecutable = [String]::Equals($taskPath, $taskRepository + '\build\desktop\TableMax.exe', [StringComparison]::OrdinalIgnoreCase) -and [IO.File]::Exists($taskRepository + '\build\desktop\.tablemax-development.json')
  if (-not $taskPath.StartsWith($taskRepository + '\artifacts\', [StringComparison]::OrdinalIgnoreCase) -and -not $taskPath.StartsWith($taskRepository + '\tmp\', [StringComparison]::OrdinalIgnoreCase) -and -not $taskDevelopmentExecutable) { throw 'Normalization is restricted to trusted local artifacts, temporary EXEs or the marked development entry.' }
  if (@($taskBefore.streams | Where-Object { $_.name -ieq 'Zone.Identifier' }).Count -ne 0 -or $taskBefore.authenticode.status -notin @('NotSigned', 'Valid')) { throw 'Refusing to normalize MOTW or abnormal Authenticode status.' }
  if ($taskBefore.integrity.rid -notin @(4096, 8192) -or @($taskBefore.integrity.labels).Count -gt 1) { throw 'Only Low to Medium normalization is allowed.' }
  foreach ($taskLabel in @($taskBefore.integrity.labels)) {
    if ($taskLabel.sid -ne ('S-1-16-' + $taskLabel.rid) -or $taskLabel.mask -ne 1) { throw 'Refusing to normalize an abnormal mandatory label or policy.' }
  }
  $taskChanged = $taskBefore.integrity.rid -eq 4096
  # Prevent replacement or content writes throughout the single-file metadata operation.
  $taskGuard = [IO.File]::Open($taskPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  try {
    $taskGuardedBefore = Read-TaskSecurity $taskPath
    if (($taskBefore | ConvertTo-Json -Depth 20 -Compress) -cne ($taskGuardedBefore | ConvertTo-Json -Depth 20 -Compress)) { throw 'Executable security changed before the normalization guard was acquired.' }
    if ($taskChanged) {
      $taskIcacls = Join-Path $env:WINDIR 'System32/icacls.exe'
      $taskIcaclsOutput = & $taskIcacls $taskPath '/setintegritylevel' 'M' '/Q' 2>&1
      if ($LASTEXITCODE -ne 0) { throw ('Single-file integrity normalization failed with code ' + $LASTEXITCODE) }
    }
    $taskAfter = Read-TaskSecurity $taskPath
    foreach ($taskKey in @('path', 'bytes', 'sha256', 'ownerSid', 'ownerSddl', 'ownerSha256', 'daclSddl', 'daclSha256', 'streams', 'authenticode')) {
      if (($taskBefore[$taskKey] | ConvertTo-Json -Depth 20 -Compress) -cne ($taskAfter[$taskKey] | ConvertTo-Json -Depth 20 -Compress)) { throw ('Integrity normalization changed protected metadata: ' + $taskKey) }
    }
    if ($taskAfter.integrity.rid -ne 8192) { throw 'Integrity normalization did not produce Medium.' }
    $taskResult = [ordered]@{ schemaVersion = 1; kind = 'windows-executable-security-normalization'; changed = $taskChanged; before = $taskBefore; after = $taskAfter }
  } finally { $taskGuard.Dispose() }
}
[Console]::WriteLine(($taskResult | ConvertTo-Json -Depth 20 -Compress))
