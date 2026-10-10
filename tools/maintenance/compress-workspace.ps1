[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$ProjectRoot,
  [ValidateRange(4096, 1073741824)][long]$MinimumBytes = 65536
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Transparent workspace compression requires Windows NTFS.' }
$workspace = [IO.Path]::GetFullPath($(if ($ProjectRoot) { $ProjectRoot } else { Join-Path $PSScriptRoot '../..' })).TrimEnd('\')
$rootItem = Get-Item -LiteralPath $workspace -Force
if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked workspace roots are not supported.' }
if (-not (Test-Path -LiteralPath (Join-Path $workspace '.git'))) { throw 'The selected directory is not a Git workspace.' }
if ([IO.DriveInfo]::new([IO.Path]::GetPathRoot($workspace)).DriveFormat -ne 'NTFS') { throw 'The workspace volume is not NTFS.' }
$gitRoot = (& git -C $workspace rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($gitRoot).TrimEnd('\') -ne $workspace) { throw 'Select the exact repository root.' }
function Assert-Within([string]$Path) {
  $resolved = [IO.Path]::GetFullPath($Path)
  if (-not $resolved.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes workspace: $resolved" }
  return $resolved
}
function Assert-Idle {
  # A relative node/pnpm command does not expose its working directory through
  # Win32_Process. Preserve the existing cleanup tool's conservative guard.
  $filter = "Name='TableMax.exe' OR Name='node.exe' OR Name='electron.exe' OR Name='dotnet.exe' OR Name='MSBuild.exe' OR Name='VBCSCompiler.exe' OR Name='vitest.exe' OR Name='vite.exe' OR Name='esbuild.exe' OR Name='msedgewebview2.exe' OR Name='7za.exe' OR Name='7z.exe'"
  foreach ($process in Get-CimInstance Win32_Process -Filter $filter) {
    if ($process.ProcessId -eq $PID) { continue }
    $line = [string]$process.CommandLine
    $normalizedLine = $line.Replace('/', '\')
    $normalizedExecutable = ([string]$process.ExecutablePath).Replace('/', '\')
    $projectProcess = $normalizedLine.IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or $normalizedExecutable.IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -ge 0
    $relativeTool = $line -match '(tools[\\/](?:dev|build|release|test|assets|analysis|maintenance)[\\/]|apps[\\/]desktop[\\/]native|electron-builder|vitest|\b(pnpm|npm)\b.*\b(build|dev|test|check|package:win|verify:\w+)\b)'
    if (-not $line -or $process.Name -ieq 'TableMax.exe' -or $projectProcess -or $relativeTool) {
      throw "A workspace application, build or verification process is still active: $($process.Name) ($($process.ProcessId))."
    }
  }
}
if (-not ('TableMaxNtfsCompression' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32.SafeHandles;
public sealed class TableMaxFileStorage {
  public string Identity;
  public long LogicalBytes, StorageBytes;
  public uint Links;
  public bool Compressed;
}
public sealed class TableMaxCompressionResult {
  public long Before, After;
  public string Sha256;
  public bool Changed;
}
public static class TableMaxNtfsCompression {
  [StructLayout(LayoutKind.Sequential)] struct Info {
    public uint Attr;
    public System.Runtime.InteropServices.ComTypes.FILETIME Created, Accessed, Written;
    public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
  }
  [StructLayout(LayoutKind.Sequential)] struct Standard {
    public long Allocation, End;
    public uint Links;
    [MarshalAs(UnmanagedType.U1)] public bool Pending, Directory;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFileW(string p,uint access,uint share,IntPtr security,uint mode,uint flags,IntPtr template);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info value);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetFileInformationByHandleEx(SafeFileHandle h,int kind,out Standard value,uint size);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern uint GetCompressedFileSizeW(string p,out uint high);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern uint GetFinalPathNameByHandleW(SafeFileHandle h,StringBuilder path,uint size,uint flags);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool DeviceIoControl(SafeFileHandle h,uint control,ref ushort input,int inputSize,IntPtr output,int outputSize,out uint returned,IntPtr overlapped);
  static void Check(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  static string NativePath(string path) { return path.StartsWith(@"\\?\") ? path : @"\\?\"+path; }
  static string FinalPath(SafeFileHandle handle) {
    var buffer=new StringBuilder(512);
    while (true) {
      uint length=GetFinalPathNameByHandleW(handle,buffer,(uint)buffer.Capacity,0);
      if (length==0) throw new Win32Exception(Marshal.GetLastWin32Error());
      if (length<buffer.Capacity) break;
      buffer=new StringBuilder(checked((int)length+1));
    }
    string path=buffer.ToString();
    if (path.StartsWith(@"\\?\UNC\",StringComparison.OrdinalIgnoreCase)) path=@"\\"+path.Substring(8);
    else if (path.StartsWith(@"\\?\",StringComparison.Ordinal)) path=path.Substring(4);
    return Path.GetFullPath(path);
  }
  static void AssertFinalWithin(SafeFileHandle handle,string workspace) {
    string root=Path.GetFullPath(workspace).TrimEnd('\\')+"\\";
    string path=FinalPath(handle);
    if (!path.StartsWith(root,StringComparison.OrdinalIgnoreCase)) throw new IOException("Opened file resolves outside audited workspace: "+path);
  }
  static void ValidateAliases(string[] aliases,string workspace,string identity) {
    foreach (string alias in aliases) {
      using (var handle=CreateFileW(NativePath(alias),0,7,IntPtr.Zero,3,0x80,IntPtr.Zero)) {
        if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
        AssertFinalWithin(handle,workspace);
        if (Read(alias,handle).Identity!=identity) throw new IOException("Candidate alias changed after preview.");
      }
    }
  }
  static TableMaxFileStorage Read(string path,SafeFileHandle handle) {
    Info info; Standard standard;
    Check(GetFileInformationByHandle(handle,out info));
    Check(GetFileInformationByHandleEx(handle,1,out standard,(uint)Marshal.SizeOf(typeof(Standard))));
    bool compressed=(info.Attr & 0x800)!=0;
    long bytes=standard.Allocation;
    if (compressed) {
      uint high; uint low=GetCompressedFileSizeW(NativePath(path),out high);
      if (low==uint.MaxValue && Marshal.GetLastWin32Error()!=0) throw new Win32Exception(Marshal.GetLastWin32Error());
      bytes=(long)(((ulong)high<<32)|low);
    }
    return new TableMaxFileStorage { Identity=info.Volume.ToString("x8")+":"+info.IndexHigh.ToString("x8")+info.IndexLow.ToString("x8"), LogicalBytes=standard.End, StorageBytes=bytes, Links=info.Links, Compressed=compressed };
  }
  public static TableMaxFileStorage Inspect(string path) {
    using (var handle=CreateFileW(NativePath(path),0,7,IntPtr.Zero,3,0x80,IntPtr.Zero)) {
      if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
      return Read(path,handle);
    }
  }
  static string Hash(FileStream stream) {
    stream.Position=0;
    using (var sha=SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
  }
  static void Set(SafeFileHandle handle,ushort mode) {
    uint returned;
    Check(DeviceIoControl(handle,0x9c040,ref mode,2,IntPtr.Zero,0,out returned,IntPtr.Zero));
  }
  public static TableMaxCompressionResult Compress(string path,string identity,long logical,uint links,string workspace,string[] aliases) {
    // This handle excludes concurrent writers and deletion while content is checked.
    using (var handle=CreateFileW(NativePath(path),0xc0000000,1,IntPtr.Zero,3,0x80,IntPtr.Zero)) {
      if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
      AssertFinalWithin(handle,workspace);
      var before=Read(path,handle);
      if (before.Identity!=identity || before.LogicalBytes!=logical || before.Links!=links) throw new IOException("File or hard-link scope changed after preview.");
      if (aliases==null || aliases.Length!=links) throw new IOException("Hard-link aliases differ from audited scope.");
      ValidateAliases(aliases,workspace,identity);
      using (var stream=new FileStream(handle,FileAccess.Read)) {
        string hash=Hash(stream);
        AssertFinalWithin(handle,workspace);
        ValidateAliases(aliases,workspace,identity);
        Set(handle,1);
        var after=Read(path,handle);
        if (Hash(stream)!=hash) throw new IOException("Transparent compression changed semantic content.");
        // Incompressible data is restored rather than increasing its allocation.
        if (after.StorageBytes>=before.StorageBytes && !before.Compressed) { Set(handle,0); after=Read(path,handle); }
        return new TableMaxCompressionResult { Before=before.StorageBytes, After=after.StorageBytes, Sha256=hash, Changed=after.StorageBytes<before.StorageBytes };
      }
    }
  }
}
'@
}
if ([TableMaxNtfsCompression].GetMethod('Compress').GetParameters().Length -ne 6) { throw 'A stale compression native type is loaded; run this version in a fresh PowerShell process.' }
if ($Apply) { Assert-Idle }
$timer = [Diagnostics.Stopwatch]::StartNew()
$groups = @{}
$skipped = [Collections.Generic.List[object]]::new()
$pending = [Collections.Generic.Stack[string]]::new()
$pending.Push($workspace)
$logicalPathBytes = [long]0
$fileCount = 0
while ($pending.Count) {
  $directory = $pending.Pop()
  foreach ($entry in [IO.DirectoryInfo]::new($directory).EnumerateFileSystemInfos()) {
    $path = Assert-Within $entry.FullName
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { $skipped.Add(@{ path=$path; reason='link preserved' }); continue }
    if ($entry -is [IO.DirectoryInfo]) {
      if ($path -ne (Join-Path $workspace '.git') -and (Test-Path -LiteralPath (Join-Path $path '.git'))) { $skipped.Add(@{ path=$path; reason='nested repository preserved' }); continue }
      $pending.Push($path)
      continue
    }
    $fileCount++
    $logicalPathBytes += $entry.Length
    try { $storage = [TableMaxNtfsCompression]::Inspect($path) }
    catch { $skipped.Add(@{ path=$path; reason=$_.Exception.Message }); continue }
    if (-not $groups.ContainsKey($storage.Identity)) { $groups[$storage.Identity] = @{ storage=$storage; paths=[Collections.Generic.List[string]]::new() } }
    $groups[$storage.Identity].paths.Add($path)
  }
}
$physicalBefore = [long]0
$uniqueLogical = [long]0
$candidates = [Collections.Generic.List[object]]::new()
foreach ($group in $groups.Values) {
  $storage = $group.storage
  $physicalBefore += $storage.StorageBytes
  $uniqueLogical += $storage.LogicalBytes
  if ($storage.Links -ne $group.paths.Count) { $skipped.Add(@{ path=$group.paths[0]; reason='hard links outside audited workspace preserved'; links=$storage.Links; localLinks=$group.paths.Count }); continue }
  if ($storage.Compressed -or $storage.LogicalBytes -lt $MinimumBytes) { continue }
  $item = Get-Item -LiteralPath $group.paths[0] -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReadOnly) -ne 0) { $skipped.Add(@{ path=$item.FullName; reason='readonly file preserved' }); continue }
  if (($item.Attributes -band ([IO.FileAttributes]::Encrypted -bor [IO.FileAttributes]::SparseFile)) -ne 0 -or $item.Name -like '*.lock') { $skipped.Add(@{ path=$item.FullName; reason='encrypted, sparse or lock file preserved' }); continue }
  $candidates.Add(@{ path=$item.FullName; identity=$storage.Identity; logicalBytes=$storage.LogicalBytes; storageBytes=$storage.StorageBytes; aliases=@($group.paths); sha256=$null; result='preview' })
}
$preview = @{ workspace=$workspace; apply=[bool]$Apply; fileCount=$fileCount; uniqueFileCount=$groups.Count; logicalPathBytes=$logicalPathBytes; uniqueLogicalBytes=$uniqueLogical; storageBytesBefore=$physicalBefore; candidateCount=$candidates.Count; minimumBytes=$MinimumBytes; skippedCount=$skipped.Count }
$preview | ConvertTo-Json
if (-not $Apply) { return }
Assert-Idle
$digest = [Security.Cryptography.SHA256]::Create()
try { $lockId = [BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($workspace.ToLowerInvariant()))).Replace('-', '') } finally { $digest.Dispose() }
$mutex = [Threading.Mutex]::new($false, 'Local\TableMax-Cleanup-' + $lockId)
$held = $false
$report = $null
$reportPath = $null
$auditPath = $null
function Write-DurableText([string]$Path, [string]$Text, [bool]$Append = $false) {
  $mode = $(if ($Append) { [IO.FileMode]::Append } else { [IO.FileMode]::Create })
  $stream = [IO.FileStream]::new((Assert-Within $Path), $mode, [IO.FileAccess]::Write, [IO.FileShare]::Read)
  try {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes($Text)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally { $stream.Dispose() }
}
function Write-Report {
  $temporaryPath = Assert-Within ($reportPath + '.writing')
  Write-DurableText $temporaryPath (($report | ConvertTo-Json -Depth 8) + "`n")
  Move-Item -LiteralPath $temporaryPath -Destination $reportPath -Force
}
function Write-Audit([hashtable]$Entry) {
  $Entry.at = [DateTime]::UtcNow.ToString('o')
  Write-DurableText $auditPath (($Entry | ConvertTo-Json -Depth 8 -Compress) + "`n") $true
}
try {
  try { $held=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held=$true }
  if (-not $held) { throw 'Another workspace maintenance operation is active.' }
  $reportRoot = Assert-Within (Join-Path $workspace ('artifacts/maintenance/workspace-compression-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')))
  New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
  $reportPath = Join-Path $reportRoot 'compression.json'
  $auditPath = Join-Path $reportRoot 'compression-items.jsonl'
  $report = @{ result='started'; startedAt=[DateTime]::UtcNow.ToString('o'); preview=$preview; savedBytes=[long]0; changedCount=0; checkedCount=0; candidates=$candidates; skipped=$skipped; auditPath=$auditPath; storageBytesAfterScope='audited source files; excludes newly created reports' }
  # A terminated process leaves the started snapshot and completed JSONL items.
  # An item with no completed record has an unconfirmed outcome, never a pass.
  Write-Report
  Write-Audit @{ event='run-started'; workspace=$workspace; reportPath=$reportPath; candidateCount=$candidates.Count }
  $checkedSinceGuard = 0
  foreach ($candidate in $candidates) {
    if ($checkedSinceGuard -eq 0) { Assert-Idle }
    $invoked = $false
    $confirmed = $false
    try {
      $candidate.result='started; completion not confirmed'
      Write-Audit @{ event='started'; path=$candidate.path; identity=$candidate.identity; aliases=$candidate.aliases; logicalBytes=$candidate.logicalBytes; storageBytesBefore=$candidate.storageBytes }
      foreach ($alias in $candidate.aliases) {
        $item = Get-Item -LiteralPath (Assert-Within $alias) -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [TableMaxNtfsCompression]::Inspect($alias).Identity -ne $candidate.identity) { throw 'Candidate alias changed.' }
      }
      $invoked = $true
      $result = [TableMaxNtfsCompression]::Compress((Assert-Within $candidate.path), $candidate.identity, $candidate.logicalBytes, $candidate.aliases.Count, $workspace, [string[]]$candidate.aliases)
      $confirmed = $true
      $candidate.sha256=$result.Sha256
      $candidate.result=$(if ($result.Changed) { 'compressed; content hash unchanged' } else { 'incompressible; original allocation retained' })
      $candidate.storageBytesAfter=$result.After
      $report.checkedCount++
      $checkedSinceGuard = ($checkedSinceGuard + 1) % 25
      if ($result.Changed) { $report.changedCount++; $report.savedBytes += $result.Before - $result.After }
      Write-Audit @{ event='completed'; path=$candidate.path; identity=$candidate.identity; sha256=$result.Sha256; storageBytesBefore=$result.Before; storageBytesAfter=$result.After; changed=$result.Changed; result=$candidate.result }
      if ($report.checkedCount % 500 -eq 0) { Write-Host ('Checked ' + $report.checkedCount + '/' + $candidates.Count + '; saved ' + [Math]::Round($report.savedBytes/1GB, 2) + ' GiB.') }
    }
    catch {
      $candidate.error=$_.Exception.Message
      if (-not $confirmed) { $candidate.result=$(if ($invoked) { 'failed; outcome requires inspection' } else { 'not modified; validation or audit failed' }) }
      try { Write-Audit @{ event='failed'; path=$candidate.path; result=$candidate.result; error=$candidate.error; contentConfirmed=$confirmed } } catch { }
      throw
    }
  }
  Assert-Idle
  $report.result='passed'
}
catch {
  if ($report) {
    $report.result='failed'
    $report.error=$_.Exception.Message
    try { Write-Audit @{ event='run-failed'; checked=$report.checkedCount; savedBytes=$report.savedBytes; error=$report.error } } catch { }
  }
  throw
}
finally {
  $timer.Stop()
  try {
    if ($report) {
      $report.seconds=$timer.Elapsed.TotalSeconds
      $report.finishedAt=[DateTime]::UtcNow.ToString('o')
      $report.storageBytesAfter=$physicalBefore-$report.savedBytes
      $report.unconfirmedCount=@($candidates | Where-Object result -eq 'failed; outcome requires inspection').Count
      Write-Report
      Write-Host "Compression report: $reportPath"
    }
  } finally {
    if ($held) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
  }
}
@{ result=$report.result; checked=$report.checkedCount; compressed=$report.changedCount; savedBytes=$report.savedBytes; storageBytesAfter=$report.storageBytesAfter; seconds=$report.seconds } | ConvertTo-Json
