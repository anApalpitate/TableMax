using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;
using File = TableMax.Installation.InstallationFile;
using Directory = TableMax.Installation.InstallationDirectory;

namespace TableMax.Installation
{
    // Shared by the installed entry, native desktop and transient update helper.
    internal static class InstallationCore
    {
#if TABLEMAX_INSTALLATION_TEST
        public const string ProductId = "{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}";
#else
        public const string ProductId = "{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}";
#endif
        public const int Protocol = 1;
        public static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);
        // Run before the first System.IO call in every executable entry point.
        // Standalone csc-built helpers have no targeting config. The switches
        // enable extended syntax; InstallationFile/Directory add the IO prefix.
        public static void InitializeRuntime()
        {
            AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
            AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
        }
        public static string TemporaryPath(string destination) => Path.Combine(Path.GetDirectoryName(destination), ".tm-" + Guid.NewGuid().ToString("N").Substring(0, 16) + ".tmp");
        private static string Ordinary(string path) => path.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase) ? @"\\" + path.Substring(8) : path.StartsWith(@"\\?\", StringComparison.Ordinal) ? path.Substring(4) : path;
        public static string Full(string path) => Path.GetFullPath(Ordinary(path)).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        // Internal IO only: identities and comparisons always retain ordinary
        // canonical paths; callers never gain acceptance for device root input.
        public static string IO(string path)
        {
            var full = Path.GetFullPath(Ordinary(path));
            return full.StartsWith(@"\\", StringComparison.Ordinal) ? @"\\?\UNC\" + full.Substring(2) : @"\\?\" + full;
        }
        public static void ValidateStartupPaths(string root, string dataDirectory)
        {
            var box = Box(root);
            foreach (var file in new[] { Path.Combine(root, "TableMax.exe"), Path.Combine(root, "Updater.exe"), Path.Combine(box, "app", "TableMax.exe"), Path.Combine(box, "app", "node.exe"), Path.Combine(box, "TableMax.config.json") })
                if (Full(file).Length >= 260) throw new IOException("安装位置太深，原生入口无法在此路径启动。请选择较短的安装位置；尚未替换程序。");
            if (dataDirectory != null && new[] { Path.Combine(dataDirectory, "desktop", "webview2"), Path.Combine(dataDirectory, "logs") }.Any(path => Full(path).Length >= 248))
                throw new IOException("配置的数据目录太深，原生浏览器无法在此路径启动。请选择较短的数据目录；尚未替换程序。");
        }
        public static bool Equal(string a, string b) => String.Equals(Full(a), Full(b), StringComparison.OrdinalIgnoreCase);
        public static string Hash(byte[] bytes) { using (var sha = SHA256.Create()) return Hex(sha.ComputeHash(bytes)); }
        public static string HashFile(string path) { Safe(path); using (var sha = SHA256.Create()) using (var stream = File.OpenRead(path)) return Hex(sha.ComputeHash(stream)); }
        private static string Hex(byte[] bytes) => BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        public static string Key(string root) => Hash(Utf8.GetBytes(Full(root).ToLowerInvariant()));
        // The next published installer baseline uses data. Unpublished old
        // installations are rejected by the required managed-file layout.
        public static string Box(string root) => Path.Combine(Full(root), "data");
        public static string IdentityPath(string root) => Path.Combine(Box(root), ".install.json");
        public static string ReceiptPath(string root) => Path.Combine(Box(root), ".installer-receipt.json");
        public static string ControlPipe(string root) => "TableMax.Installation." + Key(root);
        public static void Safe(string path)
        {
            for (var cursor = Path.GetFullPath(path); !String.IsNullOrEmpty(cursor); cursor = Path.GetDirectoryName(cursor))
                if ((File.Exists(cursor) || Directory.Exists(cursor)) && (File.GetAttributes(cursor) & FileAttributes.ReparsePoint) != 0)
                    throw new IOException("安装路径包含链接，原内容已保留。");
        }
        public static string Root(string path)
        {
            // Keep installation identities in one ordinary local-drive syntax.
            // Device/UNC aliases must not bypass protected-directory checks.
            if (String.IsNullOrEmpty(path) || path.Length < 3 || !((path[0] >= 'A' && path[0] <= 'Z') || (path[0] >= 'a' && path[0] <= 'z')) || path[1] != ':' || !(path[2] == '\\' || path[2] == '/'))
                throw new IOException("安装根必须使用本机磁盘的标准绝对路径，不能使用 UNC 或设备路径。");
            var root = Full(path); Safe(root);
            if (String.IsNullOrEmpty(root) || Equal(root, Path.GetPathRoot(root))) throw new IOException("不能安装到磁盘根目录。");
            foreach (var special in new[] { Environment.GetFolderPath(Environment.SpecialFolder.Windows), Environment.GetFolderPath(Environment.SpecialFolder.System), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) })
                if (!String.IsNullOrEmpty(special) && (Equal(root, special) || root.StartsWith(Full(special) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)))
                    throw new IOException("单用户安装不能写入系统保护目录。");
            return root;
        }
        public static string Member(string root, string relative)
        {
            if (String.IsNullOrEmpty(relative) || relative.Contains("\\") || relative.Contains(":") || relative.StartsWith("/") || relative.Split('/').Any(part => part.Length == 0 || part == "." || part == ".." || part.EndsWith(".") || part.EndsWith(" ") || part.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || System.Text.RegularExpressions.Regex.IsMatch(part.Split('.')[0], @"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$", System.Text.RegularExpressions.RegexOptions.IgnoreCase)))
                throw new IOException("安装文件路径无效。");
            var path = Full(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
            if (!path.StartsWith(Full(root) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("安装文件越出目标目录。");
            Safe(path); return path;
        }
        public static void Atomic(string path, object value, int maximumJsonLength = 1024 * 1024)
        {
            Safe(path); Directory.CreateDirectory(Path.GetDirectoryName(path));
            var temporary = TemporaryPath(path); var created = false;
            try
            {
                using (var stream = new FileStream(IO(temporary), FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    created = true;
                    var bytes = Utf8.GetBytes(new JavaScriptSerializer { MaxJsonLength = maximumJsonLength, RecursionLimit = 32 }.Serialize(value)); stream.Write(bytes, 0, bytes.Length); stream.Flush(true);
                }
                if (File.Exists(path)) File.Replace(temporary, path, null); else File.Move(temporary, path);
            }
            finally { if (created && File.Exists(temporary)) { Safe(temporary); File.Delete(temporary); } }
        }
        public static string Encode(object value) => new JavaScriptSerializer { MaxJsonLength = 1024 * 1024, RecursionLimit = 32 }.Serialize(value);
        public static Dictionary<string, object> Object(object value) => value as Dictionary<string, object> ?? throw new IOException("安装描述不是对象。");
        public static string Text(Dictionary<string, object> value, string key) => value.TryGetValue(key, out var result) && result is string text ? text : throw new IOException("安装描述缺少 " + key + "。");
        public static int Number(Dictionary<string, object> value, string key) => value.TryGetValue(key, out var result) && result is decimal number && number == Decimal.Truncate(number) && number >= 0 && number <= Int32.MaxValue ? (int)number : throw new IOException("安装描述数值无效：" + key + "。");
        public static void Keys(Dictionary<string, object> value, params string[] keys) { if (value.Count != keys.Length || keys.Any(key => !value.ContainsKey(key))) throw new IOException("安装描述包含未知或缺失字段。"); }
        public static string Digest(Dictionary<string, object> value, string key) { var text = Text(value, key); if (text.Length != 64 || text.Any(c => !(c >= '0' && c <= '9') && !(c >= 'a' && c <= 'f'))) throw new IOException("摘要格式无效。"); return text; }
        public static Version Version4(string version) { var parts = version.Split('.'); if (parts.Length != 4 || parts.Any(p => p.Length == 0 || (p.Length > 1 && p[0] == '0') || p.Any(c => c < '0' || c > '9')) || !Version.TryParse(version, out var result) || result.Major != 1) throw new IOException("构建版本无效。"); return result; }
        public static Mutex Mutex(string kind, string root)
        {
            var security = new MutexSecurity(); security.AddAccessRule(new MutexAccessRule(WindowsIdentity.GetCurrent().User, MutexRights.FullControl, AccessControlType.Allow));
            return new Mutex(false, "Global\\TableMax-Installation-" + kind + "-" + Key(root), out _, security);
        }
        public static bool Acquire(Mutex mutex, int timeout) { try { return mutex.WaitOne(timeout); } catch (AbandonedMutexException) { return true; } }
    }

    // The Framework path switches remove managed MAX_PATH checks, but plain
    // Win32 paths still require machine policy. These internal adapters use
    // Unicode extended paths directly, independent of that global policy.
    internal static class InstallationFile
    {
        public static bool Exists(string path) => System.IO.File.Exists(InstallationCore.IO(path));
        public static FileAttributes GetAttributes(string path) => System.IO.File.GetAttributes(InstallationCore.IO(path));
        public static FileStream OpenRead(string path) => System.IO.File.OpenRead(InstallationCore.IO(path));
        public static string ReadAllText(string path, Encoding encoding) => System.IO.File.ReadAllText(InstallationCore.IO(path), encoding);
        public static void Copy(string source, string target, bool overwrite) => System.IO.File.Copy(InstallationCore.IO(source), InstallationCore.IO(target), overwrite);
        public static void Delete(string path) => System.IO.File.Delete(InstallationCore.IO(path));
        public static void Move(string source, string target) => System.IO.File.Move(InstallationCore.IO(source), InstallationCore.IO(target));
        public static void Replace(string source, string target, string backup) => System.IO.File.Replace(InstallationCore.IO(source), InstallationCore.IO(target), backup == null ? null : InstallationCore.IO(backup));
    }
    internal static class InstallationDirectory
    {
        public static bool Exists(string path) => System.IO.Directory.Exists(InstallationCore.IO(path));
        public static DirectoryInfo CreateDirectory(string path) => System.IO.Directory.CreateDirectory(InstallationCore.IO(path));
        public static void Delete(string path) => System.IO.Directory.Delete(InstallationCore.IO(path));
        public static string[] GetDirectories(string path) => System.IO.Directory.GetDirectories(InstallationCore.IO(path)).Select(InstallationCore.Full).ToArray();
        public static string[] GetFileSystemEntries(string path) => System.IO.Directory.GetFileSystemEntries(InstallationCore.IO(path)).Select(InstallationCore.Full).ToArray();
    }

    // IO paths may be long; executable module paths used by Framework's
    // CreateProcess(null, commandLine, ...) still must fit MAX_PATH.
    internal sealed class InstallationLaunch
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct SecurityAttributes { public int Length; public IntPtr Descriptor; [MarshalAs(UnmanagedType.Bool)] public bool InheritHandle; }
        [DllImport("kernel32.dll", EntryPoint = "CreateDirectoryW", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CreatePrivateDirectory(string path, ref SecurityAttributes security);
        [DllImport("kernel32.dll", EntryPoint = "CreateFileW", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
        private static extern SafeFileHandle OpenCleanupFile(string path, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
        [StructLayout(LayoutKind.Sequential)]
        private struct CleanupAttributes { public uint Attributes, ReparseTag; }
        [StructLayout(LayoutKind.Sequential)]
        private struct CleanupDisposition { [MarshalAs(UnmanagedType.U1)] public bool Delete; }
        [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GetFileInformationByHandleEx(SafeFileHandle file, int kind, out CleanupAttributes attributes, uint size);
        [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool SetFileInformationByHandle(SafeFileHandle file, int kind, ref CleanupDisposition disposition, uint size);
        private sealed class Record { public string sourcePath, path; public int bytes; public string sha256; public object Public => new { sourcePath, path, bytes, sha256 }; }
        internal sealed class CleanupLease : IDisposable
        {
            private readonly FileStream stream;
            public CleanupLease(string path, long bytes, string sha256)
            {
                InstallationCore.Safe(path);
                // DELETE + GENERIC_READ, no sharing and OPEN_REPARSE_POINT:
                // retain the very object hashed here through handle deletion.
                var handle = OpenCleanupFile(InstallationCore.IO(path), 0x80010000, 0, IntPtr.Zero, 3, 0x00200000, IntPtr.Zero);
                if (handle.IsInvalid) { var code = Marshal.GetLastWin32Error(); handle.Dispose(); throw new IOException("清理成员被占用或无法取得独占句柄，已保留。", new System.ComponentModel.Win32Exception(code)); }
                try
                {
                    if (!GetFileInformationByHandleEx(handle, 9, out var attributes, (uint)Marshal.SizeOf(typeof(CleanupAttributes))) || (attributes.Attributes & (uint)(FileAttributes.ReparsePoint | FileAttributes.Directory | FileAttributes.ReadOnly)) != 0) throw new IOException("清理成员不是可删除的普通文件，已保留。");
                    stream = new FileStream(handle, FileAccess.Read);
                    using (var sha = SHA256.Create()) if (stream.Length != bytes || BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant() != sha256) throw new IOException("清理成员已变化，已保留。");
                }
                catch { if (stream != null) stream.Dispose(); else handle.Dispose(); throw; }
            }
            public void Delete()
            {
                DeleteCleanupHandle(stream.SafeFileHandle);
            }
            public void Dispose() => stream.Dispose();
        }
        private static void DeleteCleanupHandle(SafeFileHandle handle)
        {
            var disposition = new CleanupDisposition { Delete = true };
            if (!SetFileInformationByHandle(handle, 4, ref disposition, (uint)Marshal.SizeOf(typeof(CleanupDisposition)))) throw new IOException("清理原文件句柄未获确认，已保留审计。", new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()));
        }
        private SafeFileHandle OpenCleanupDirectory()
        {
            // Allow child IO, but deny renaming this directory while its known
            // members are verified and removed. Delete the same empty object.
            var handle = OpenCleanupFile(InstallationCore.IO(DirectoryPath), 0x00010080, 3, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
            if (handle.IsInvalid) { var code = Marshal.GetLastWin32Error(); handle.Dispose(); throw new IOException("临时目录正在使用，已保留。", new System.ComponentModel.Win32Exception(code)); }
            try
            {
                if (!GetFileInformationByHandleEx(handle, 9, out var attributes, (uint)Marshal.SizeOf(typeof(CleanupAttributes))) || (attributes.Attributes & (uint)(FileAttributes.ReparsePoint | FileAttributes.Directory)) != (uint)FileAttributes.Directory) throw new IOException("临时目录身份未获确认，已保留。");
                VerifyDirectory(); return handle;
            }
            catch { handle.Dispose(); throw; }
        }
        private readonly Dictionary<string, Record> owned = new Dictionary<string, Record>(StringComparer.OrdinalIgnoreCase);
        private InstallationManifest sourceIdentity;
        private Record helper, installer, target;
        private string ownerSid, parent, auditPath, metadataSha256;
        private bool directoryCreated;
        public string DirectoryPath { get; private set; }
        public string HelperPath => Path.Combine(DirectoryPath, "h.exe");
        public string InstallerPath => Path.Combine(DirectoryPath, "i.exe");
        public string MetadataPath => Path.Combine(DirectoryPath, "launch.json");
        public string MetadataSha256 => metadataSha256;
        public object HelperTuple => helper.Public;
        public object InstallerTuple => installer.Public;
        private static string CurrentSid() { using (var identity = WindowsIdentity.GetCurrent()) return identity.User.Value; }
        private static string TemporaryParent()
        {
            var value = Path.GetTempPath();
            if (String.IsNullOrEmpty(value) || value.Length < 3 || !Char.IsLetter(value[0]) || value[1] != ':' || (value[2] != '\\' && value[2] != '/')) throw new IOException("当前用户的 TEMP 必须是本机磁盘的标准绝对路径。");
            var absolute = Path.GetFullPath(value);
            if (String.Equals(absolute.TrimEnd('\\', '/'), Path.GetPathRoot(absolute).TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase)) throw new IOException("当前用户的 TEMP 不能是磁盘根目录。请设置专用临时目录后重试；未关闭程序。");
            value = InstallationCore.Full(value); InstallationCore.Safe(value);
            if (!Directory.Exists(value)) throw new IOException("当前用户的 TEMP 目录不存在，未关闭程序。");
            return value;
        }
        private static void LaunchPath(string path)
        {
            if (InstallationCore.Full(path).Length >= 260) throw new IOException("当前用户的 TEMP 路径太深，无法安全启动更新。请缩短 TEMP 路径后重试；未关闭程序。");
        }
        private static string HandoffDirectory(InstallationManifest identity, string targetPath)
        {
            targetPath = InstallationCore.Full(targetPath); var directory = Path.GetDirectoryName(targetPath); var name = Path.GetFileName(directory);
            if (Path.GetFileName(targetPath) != "envelope.json" || !InstallationCore.Equal(Path.GetDirectoryName(directory), Path.Combine(identity.boxRoot, "updates")) || !name.StartsWith("handoff-", StringComparison.Ordinal) || !Guid.TryParseExact(name.Substring(8), "N", out _)) throw new IOException("更新启动记录不属于当前安装的交接事务。");
            InstallationCore.Safe(directory); return directory;
        }
        private void VerifyDirectory()
        {
            InstallationCore.Safe(DirectoryPath);
            if (!InstallationCore.Equal(Path.GetDirectoryName(DirectoryPath), parent) || !Directory.Exists(DirectoryPath) || !Path.GetFileName(DirectoryPath).StartsWith("TableMax-update-", StringComparison.Ordinal) || !Guid.TryParseExact(Path.GetFileName(DirectoryPath).Substring(16), "N", out _)) throw new IOException("更新临时目录身份无效。");
            var security = System.IO.Directory.GetAccessControl(InstallationCore.IO(DirectoryPath), AccessControlSections.Owner | AccessControlSections.Access);
            if (!security.AreAccessRulesProtected || security.GetOwner(typeof(SecurityIdentifier)).Value != ownerSid) throw new IOException("更新临时目录未保持当前用户的私有权限。");
            var expected = new HashSet<string>(new[] { ownerSid, "S-1-5-18" }, StringComparer.Ordinal);
            foreach (FileSystemAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier)))
            {
                if (rule.IsInherited || rule.AccessControlType != AccessControlType.Allow || rule.FileSystemRights != FileSystemRights.FullControl || rule.InheritanceFlags != (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit) || rule.PropagationFlags != PropagationFlags.None || !expected.Remove(rule.IdentityReference.Value)) throw new IOException("更新临时目录权限包含未知规则，已保留原内容。");
            }
            if (expected.Count != 0) throw new IOException("更新临时目录权限缺少当前用户或 SYSTEM。");
            LaunchPath(DirectoryPath); LaunchPath(HelperPath); LaunchPath(InstallerPath);
        }
        private void CreateDirectory()
        {
            var security = new DirectorySecurity(); security.SetOwner(new SecurityIdentifier(ownerSid)); security.SetAccessRuleProtection(true, false);
            foreach (var sid in new[] { ownerSid, "S-1-5-18" }.Distinct(StringComparer.Ordinal)) security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid), FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            var bytes = security.GetSecurityDescriptorBinaryForm(); var pinned = GCHandle.Alloc(bytes, GCHandleType.Pinned);
            try
            {
                var attributes = new SecurityAttributes { Length = Marshal.SizeOf(typeof(SecurityAttributes)), Descriptor = pinned.AddrOfPinnedObject(), InheritHandle = false };
                if (!CreatePrivateDirectory(InstallationCore.IO(DirectoryPath), ref attributes)) throw new IOException("无法独占创建私有更新临时目录；未使用或覆盖已有目录。", new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()));
                directoryCreated = true;
            }
            finally { pinned.Free(); }
            VerifyDirectory();
            if (Directory.GetFileSystemEntries(DirectoryPath).Length != 0) throw new IOException("新建更新临时目录含有未知内容，未继续。");
        }
        // Helper-only analysis uses the same atomic private creation boundary.
        // It is never discovered by scanning TEMP or mistaken for a handoff.
        internal static string CreatePrivateWorkDirectory()
        {
            var work = new InstallationLaunch { ownerSid = CurrentSid(), parent = TemporaryParent() };
            work.DirectoryPath = Path.Combine(work.parent, "TableMax-update-" + Guid.NewGuid().ToString("N"));
            LaunchPath(work.DirectoryPath); work.CreateDirectory(); return work.DirectoryPath;
        }
        private static void VerifyFile(Record file)
        {
            InstallationCore.Safe(file.path);
            if (Directory.Exists(file.path) || !File.Exists(file.path) || new FileInfo(InstallationCore.IO(file.path)).Length != file.bytes || InstallationCore.HashFile(file.path) != file.sha256) throw new IOException("更新启动文件的字节身份不匹配，已保留原内容。");
        }
        private void Copy(Record file)
        {
            VerifyDirectory(); InstallationCore.Safe(file.sourcePath); InstallationCore.Safe(file.path);
            using (var input = new FileStream(InstallationCore.IO(file.sourcePath), FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                if (input.Length != file.bytes) throw new IOException("更新启动副本来源长度已变化。");
                using (var output = new FileStream(InstallationCore.IO(file.path), FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None))
                {
                    owned.Add(file.path, file); input.CopyTo(output); output.Flush(true); output.Position = 0;
                    if (output.Length != file.bytes) throw new IOException("更新启动副本长度无效。");
                    using (var sha = SHA256.Create())
                        if (BitConverter.ToString(sha.ComputeHash(output)).Replace("-", "").ToLowerInvariant() != file.sha256) throw new IOException("更新启动副本摘要不匹配。");
                }
            }
            VerifyFile(file);
        }
        private void VerifyMembers()
        {
            VerifyDirectory();
            var expected = new HashSet<string>(new[] { HelperPath, InstallerPath, MetadataPath }, StringComparer.OrdinalIgnoreCase);
            foreach (var path in Directory.GetFileSystemEntries(DirectoryPath)) if (!expected.Remove(path)) throw new IOException("更新临时目录包含未知成员，已保留原内容。");
            if (expected.Count != 0) throw new IOException("更新临时目录缺少已登记成员。");
        }
        private static Record ReadRecord(object value)
        {
            var map = InstallationCore.Object(value); InstallationCore.Keys(map, "sourcePath", "path", "bytes", "sha256");
            var result = new Record { sourcePath = InstallationCore.Full(InstallationCore.Text(map, "sourcePath")), path = InstallationCore.Full(InstallationCore.Text(map, "path")), bytes = InstallationCore.Number(map, "bytes"), sha256 = InstallationCore.Digest(map, "sha256") };
            if (result.bytes < 1 || result.bytes >= 120000000) throw new IOException("更新启动记录长度无效。");
            return result;
        }
        public static InstallationLaunch Create(InstallationManifest identity, string helperSource, string installerSource, string targetPath, string targetBuildVersion, int installerBytes, string installerSha256, string payloadManifestSha256, string currentMappingSha256)
        {
            var stage = new InstallationLaunch { ownerSid = CurrentSid(), parent = TemporaryParent(), sourceIdentity = identity };
            if (stage.ownerSid != identity.ownerSid) throw new IOException("更新临时目录用户与安装用户不匹配。");
            var handoff = HandoffDirectory(identity, targetPath);
            if (!InstallationCore.Equal(helperSource, Path.Combine(handoff, "UpdateHelper.exe")) || !InstallationCore.Equal(installerSource, Path.Combine(identity.boxRoot, "updates", "downloads", installerSha256, Path.GetFileName(installerSource)))) throw new IOException("更新启动来源不属于当前交接事务。");
            stage.DirectoryPath = Path.Combine(stage.parent, "TableMax-update-" + Guid.NewGuid().ToString("N")); stage.auditPath = Path.Combine(handoff, "launch.json");
            LaunchPath(stage.DirectoryPath); LaunchPath(stage.HelperPath); LaunchPath(stage.InstallerPath);
            var helper = identity.files.Single(file => file.path == "UpdateHelper.exe");
            stage.helper = new Record { sourcePath = InstallationCore.Full(helperSource), path = stage.HelperPath, bytes = helper.bytes, sha256 = helper.sha256 };
            stage.installer = new Record { sourcePath = InstallationCore.Full(installerSource), path = stage.InstallerPath, bytes = installerBytes, sha256 = installerSha256 };
            InstallationCore.Safe(targetPath); var targetBytes = new FileInfo(InstallationCore.IO(targetPath)).Length;
            if (targetBytes < 1 || targetBytes > 16384) throw new IOException("更新启动目标签名长度无效。");
            stage.target = new Record { sourcePath = InstallationCore.Full(targetPath), path = InstallationCore.Full(targetPath), bytes = (int)targetBytes, sha256 = InstallationCore.HashFile(targetPath) };
            try
            {
                stage.CreateDirectory(); stage.Copy(stage.helper); stage.Copy(stage.installer);
                var metadata = new { schemaVersion = 1, kind = "TableMax.ApplicationUpdate.Launch", productId = InstallationCore.ProductId, installationId = identity.installationId, ownerSid = stage.ownerSid, root = identity.root, boxRoot = identity.boxRoot, installedBuildVersion = identity.buildVersion, targetBuildVersion, payloadManifestSha256, currentMappingSha256, temporaryParent = stage.parent, temporaryDirectory = stage.DirectoryPath, auditPath = stage.auditPath, helper = stage.helper.Public, installer = stage.installer.Public, target = stage.target.Public };
                InstallationCore.Atomic(stage.MetadataPath, metadata); stage.metadataSha256 = InstallationCore.HashFile(stage.MetadataPath);
                stage.owned.Add(stage.MetadataPath, new Record { sourcePath = stage.MetadataPath, path = stage.MetadataPath, bytes = (int)new FileInfo(InstallationCore.IO(stage.MetadataPath)).Length, sha256 = stage.metadataSha256 });
                InstallationCore.Safe(stage.auditPath); if (File.Exists(stage.auditPath) || Directory.Exists(stage.auditPath)) throw new IOException("更新交接审计记录已存在，未覆盖。");
                InstallationCore.Atomic(stage.auditPath, new { schemaVersion = 1, root = identity.root, installationId = identity.installationId, ownerSid = identity.ownerSid, temporaryDirectory = stage.DirectoryPath, metadataPath = stage.MetadataPath, metadataSha256 = stage.metadataSha256, actualHelper = stage.helper.Public, sourceInstaller = stage.installer.Public, target = stage.target.Public });
                stage.VerifyMembers(); return stage;
            }
            catch (Exception cause)
            {
                var cleanup = stage.CleanupUnstarted();
                if (cleanup != null) throw new IOException(cause.Message + " " + cleanup, cause);
                throw;
            }
        }
        public static InstallationLaunch Read(string runningHelper, InstallationManifest identity, string installerSource, string targetPath, string targetBuildVersion, int installerBytes, string installerSha256, string payloadManifestSha256, string currentMappingSha256)
        {
            var stage = new InstallationLaunch { ownerSid = CurrentSid(), parent = TemporaryParent(), sourceIdentity = identity, DirectoryPath = Path.GetDirectoryName(InstallationCore.Full(runningHelper)) };
            stage.VerifyDirectory(); if (!InstallationCore.Equal(runningHelper, stage.HelperPath) || stage.ownerSid != identity.ownerSid) throw new IOException("更新执行副本与当前安装用户不匹配。");
            InstallationCore.Safe(stage.MetadataPath); if (new FileInfo(InstallationCore.IO(stage.MetadataPath)).Length > 32768) throw new IOException("更新启动元数据过长。");
            var map = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(stage.MetadataPath, InstallationCore.Utf8), true));
            InstallationCore.Keys(map, "schemaVersion", "kind", "productId", "installationId", "ownerSid", "root", "boxRoot", "installedBuildVersion", "targetBuildVersion", "payloadManifestSha256", "currentMappingSha256", "temporaryParent", "temporaryDirectory", "auditPath", "helper", "installer", "target");
            if (InstallationCore.Number(map, "schemaVersion") != 1 || InstallationCore.Text(map, "kind") != "TableMax.ApplicationUpdate.Launch" || InstallationCore.Text(map, "productId") != InstallationCore.ProductId || InstallationCore.Text(map, "installationId") != identity.installationId || InstallationCore.Text(map, "ownerSid") != stage.ownerSid || !InstallationCore.Equal(InstallationCore.Text(map, "root"), identity.root) || !InstallationCore.Equal(InstallationCore.Text(map, "boxRoot"), identity.boxRoot) || InstallationCore.Text(map, "installedBuildVersion") != identity.buildVersion || InstallationCore.Text(map, "targetBuildVersion") != targetBuildVersion || InstallationCore.Digest(map, "payloadManifestSha256") != payloadManifestSha256 || InstallationCore.Digest(map, "currentMappingSha256") != currentMappingSha256 || !InstallationCore.Equal(InstallationCore.Text(map, "temporaryParent"), stage.parent) || !InstallationCore.Equal(InstallationCore.Text(map, "temporaryDirectory"), stage.DirectoryPath)) throw new IOException("更新启动元数据与实际安装或签名目标不匹配。");
            stage.auditPath = Path.Combine(HandoffDirectory(identity, targetPath), "launch.json"); if (!InstallationCore.Equal(InstallationCore.Text(map, "auditPath"), stage.auditPath)) throw new IOException("更新启动审计位置不匹配。");
            stage.helper = ReadRecord(map["helper"]); stage.installer = ReadRecord(map["installer"]); stage.target = ReadRecord(map["target"]);
            var helper = identity.files.Single(file => file.path == "UpdateHelper.exe");
            if (!InstallationCore.Equal(stage.helper.path, stage.HelperPath) || !InstallationCore.Equal(stage.helper.sourcePath, Path.Combine(Path.GetDirectoryName(targetPath), "UpdateHelper.exe")) || stage.helper.bytes != helper.bytes || stage.helper.sha256 != helper.sha256 || !InstallationCore.Equal(stage.installer.path, stage.InstallerPath) || !InstallationCore.Equal(stage.installer.sourcePath, installerSource) || stage.installer.bytes != installerBytes || stage.installer.sha256 != installerSha256 || !InstallationCore.Equal(stage.target.path, targetPath) || !InstallationCore.Equal(stage.target.sourcePath, targetPath) || stage.target.bytes > 16384) throw new IOException("更新启动文件元组与受管协调器或签名安装器不匹配。");
            stage.metadataSha256 = InstallationCore.HashFile(stage.MetadataPath); stage.VerifyMembers(); stage.VerifyAudit(identity);
            foreach (var file in new[] { stage.helper, stage.installer, stage.target }) { VerifyFile(file); VerifyFile(new Record { path = file.sourcePath, bytes = file.bytes, sha256 = file.sha256 }); }
            return stage;
        }
        private void VerifyAudit(InstallationManifest identity)
        {
            InstallationCore.Safe(auditPath); if (new FileInfo(InstallationCore.IO(auditPath)).Length > 32768) throw new IOException("更新启动审计记录过长。");
            var map = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(auditPath, InstallationCore.Utf8), true));
            InstallationCore.Keys(map, "schemaVersion", "root", "installationId", "ownerSid", "temporaryDirectory", "metadataPath", "metadataSha256", "actualHelper", "sourceInstaller", "target");
            if (InstallationCore.Number(map, "schemaVersion") != 1 || !InstallationCore.Equal(InstallationCore.Text(map, "root"), identity.root) || InstallationCore.Text(map, "installationId") != identity.installationId || InstallationCore.Text(map, "ownerSid") != ownerSid || !InstallationCore.Equal(InstallationCore.Text(map, "temporaryDirectory"), DirectoryPath) || !InstallationCore.Equal(InstallationCore.Text(map, "metadataPath"), MetadataPath) || InstallationCore.Digest(map, "metadataSha256") != metadataSha256) throw new IOException("更新启动审计与私有临时目录不匹配。");
            foreach (var item in new[] { new { Key = "actualHelper", File = helper }, new { Key = "sourceInstaller", File = installer }, new { Key = "target", File = target } })
            {
                var actual = ReadRecord(map[item.Key]); if (!InstallationCore.Equal(actual.sourcePath, item.File.sourcePath) || !InstallationCore.Equal(actual.path, item.File.path) || actual.bytes != item.File.bytes || actual.sha256 != item.File.sha256) throw new IOException("更新启动审计文件元组不匹配。");
            }
        }
        public string CleanupUnstarted()
        {
            if (!directoryCreated) return null;
            try
            {
                VerifyDirectory();
                foreach (var file in owned.Values) { if (!File.Exists(file.path) && !Directory.Exists(file.path)) continue; VerifyFile(file); File.Delete(file.path); }
                if (Directory.GetFileSystemEntries(DirectoryPath).Length != 0) return "私有更新临时目录含有未确认内容，已保留：" + DirectoryPath;
                Directory.Delete(DirectoryPath); return null;
            }
            catch (Exception) { return "未能确认清理私有更新临时文件，已保留：" + DirectoryPath; }
        }
        public object CleanupInstaller(bool safeToDelete)
        {
            if (!safeToDelete) return new { installerDeleted = false, selfHelperRetained = true, reason = "Pending or unrecognized installation transaction; launch copies retained." };
            try { VerifyMembers(); if (InstallationCore.HashFile(MetadataPath) != metadataSha256) throw new IOException("Launch metadata changed."); VerifyAudit(sourceIdentity); VerifyFile(installer); File.Delete(installer.path); return new { installerDeleted = true, selfHelperRetained = true, reason = "Only the same-SHA installer copy was removed; the executing helper and public metadata remain." }; }
            catch (Exception) { return new { installerDeleted = false, selfHelperRetained = true, reason = "Launch-copy cleanup was not confirmed; all unconfirmed content retained." }; }
        }
        public void VerifyForLaunch(InstallationManifest identity)
        {
            VerifyMembers();
            if (InstallationCore.HashFile(MetadataPath) != metadataSha256) throw new IOException("更新启动元数据已变化，未启动安装器。");
            VerifyAudit(identity);
            foreach (var file in new[] { helper, installer, target }) { VerifyFile(file); VerifyFile(new Record { path = file.sourcePath, bytes = file.bytes, sha256 = file.sha256 }); }
        }
        private static Dictionary<string, object> CleanupJson(string path)
        {
            InstallationCore.Safe(path);
            if (!File.Exists(path) || new FileInfo(InstallationCore.IO(path)).Length > 32768) throw new IOException("清理记录缺失或过长，已保留。");
            return InstallationCore.Object(StrictJson.Parse(File.ReadAllText(path, InstallationCore.Utf8), true));
        }
        private static bool SameManifest(InstallationManifest left, InstallationManifest right) => InstallationCore.Encode(left) == InstallationCore.Encode(right);
        private static List<string> TerminalTransactions(InstallationManifest current)
        {
            var directory = Path.Combine(current.boxRoot, ".installation-transactions"); InstallationCore.Safe(directory);
            if (!Directory.Exists(directory)) throw new IOException("缺少已完成安装事务，已保留。");
            var completed = new List<string>();
            foreach (var path in Directory.GetFileSystemEntries(directory))
            {
                InstallationCore.Safe(path);
                if (!Directory.Exists(path) || !Guid.TryParseExact(Path.GetFileName(path), "D", out _)) throw new IOException("安装事务含未知成员，已保留。");
                var state = CleanupJson(Path.Combine(path, "state.json")); InstallationCore.Keys(state, "schemaVersion", "root", "phase", "dataDirectory", "databaseFingerprint");
                var phase = InstallationCore.Text(state, "phase");
                if (InstallationCore.Number(state, "schemaVersion") != 1 || !InstallationCore.Equal(InstallationCore.Text(state, "root"), current.root) || (phase != "completed" && phase != "rolled-back" && phase != "preparation-aborted")) throw new IOException("安装事务尚未完成，已保留更新副本。");
                if (phase == "completed") completed.Add(path);
            }
            return completed;
        }
        private static void Observation(Dictionary<string, object> value, Record file, bool isHelper)
        {
            InstallationCore.Keys(value, isHelper ? new[] { "sourcePath", "path", "bytes", "sha256", "expectedPath", "pid", "modulePath", "pathObserved", "processStarted", "queriedFromProcessHandle", "assemblyLocation" } : new[] { "sourcePath", "path", "bytes", "sha256", "expectedPath", "pid", "modulePath", "pathObserved", "processStarted", "queriedFromProcessHandle" });
            if (!InstallationCore.Equal(InstallationCore.Text(value, "sourcePath"), file.sourcePath) || !InstallationCore.Equal(InstallationCore.Text(value, "path"), file.path) || !InstallationCore.Equal(InstallationCore.Text(value, "expectedPath"), file.path) || !InstallationCore.Equal(InstallationCore.Text(value, "modulePath"), file.path) || InstallationCore.Number(value, "bytes") != file.bytes || InstallationCore.Digest(value, "sha256") != file.sha256 || InstallationCore.Number(value, "pid") < 1 || !Object.Equals(value["pathObserved"], true) || !Object.Equals(value["processStarted"], true) || !Object.Equals(value["queriedFromProcessHandle"], true) || (isHelper && !InstallationCore.Equal(InstallationCore.Text(value, "assemblyLocation"), file.path))) throw new IOException("已完成交接缺少实际进程身份，已保留。");
            // PID reuse is deliberately conservative: any still-live recorded
            // process prevents cleanup, without waiting for or terminating it.
            try { using (var process = Process.GetProcessById(InstallationCore.Number(value, "pid"))) { _ = process.Handle; if (!process.HasExited) throw new IOException("更新进程仍在运行，稍后启动再清理。"); } }
            catch (ArgumentException) { }
            foreach (var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(file.path))) using (process)
                if (!process.HasExited && InstallationCore.Equal(process.MainModule.FileName, file.path)) throw new IOException("更新执行副本仍在运行，已保留。");
        }
        // Called only locally on a later installed-host startup. The verifier is
        // the caller's existing RSA verifier; Core remains usable by the small
        // launcher without adding update-protocol or network dependencies.
        public static object CleanupFinished(InstallationManifest current, InstallerReceipt receipt, Action<string, InstallationManifest, InstallerReceipt> verifySignedTarget)
        {
            var results = new List<object>();
            if (current == null || receipt == null || verifySignedTarget == null) return new { schemaVersion = 1, results };
            try
            {
                using (var operation = InstallationCore.Mutex("Operation", current.root))
                {
                    if (!InstallationCore.Acquire(operation, 0)) return new { schemaVersion = 1, results };
                    try
                    {
                        if (current.ownerSid != CurrentSid() || !SameManifest(current, InstallationManifest.Load(current.root))) throw new IOException("当前安装身份已变化，未清理。");
                        var receiptPath = InstallationCore.ReceiptPath(current.root); var receiptHash = InstallationCore.HashFile(receiptPath);
                        if (InstallationCore.Encode(receipt) != InstallationCore.Encode(InstallerReceipt.Read(receiptPath, current))) throw new IOException("当前安装器身份已变化，未清理。");
                        var completed = TerminalTransactions(current); var updates = Path.Combine(current.boxRoot, "updates"); InstallationCore.Safe(updates);
                        if (!Directory.Exists(updates)) return new { schemaVersion = 1, results };
                        foreach (var directory in Directory.GetDirectories(updates))
                        {
                            var name = Path.GetFileName(directory);
                            if (!name.StartsWith("handoff-", StringComparison.Ordinal) || !Guid.TryParseExact(name.Substring(8), "N", out _)) continue;
                            try { CleanupFinishedHandoff(current, receipt, receiptHash, completed, directory, verifySignedTarget); results.Add(new { handoff = directory, status = "cleaned", reason = "Only completed same-SHA launch copies were removed." }); }
                            catch (Exception cause) { results.Add(new { handoff = directory, status = "retained", reason = cause.Message }); }
                        }
                    }
                    finally { operation.ReleaseMutex(); }
                }
            }
            catch (Exception cause) { results.Add(new { handoff = (string)null, status = "retained", reason = cause.Message }); }
            return new { schemaVersion = 1, results };
        }
        private static void CleanupFinishedHandoff(InstallationManifest current, InstallerReceipt receipt, string receiptHash, List<string> completed, string directory, Action<string, InstallationManifest, InstallerReceipt> verifySignedTarget)
        {
            InstallationCore.Safe(directory); var cleanupPath = Path.Combine(directory, "cleanup.json"); InstallationCore.Safe(cleanupPath);
            if (File.Exists(cleanupPath) || Directory.Exists(cleanupPath)) throw new IOException("已有清理审计，未重复删除任何内容。");
            var expected = new HashSet<string>(new[] { "UpdateHelper.exe", "envelope.json", "launch.json", "handoff.json" }, StringComparer.Ordinal);
            foreach (var file in Directory.GetFileSystemEntries(directory)) { InstallationCore.Safe(file); if (!expected.Remove(Path.GetFileName(file)) || Directory.Exists(file)) throw new IOException("交接目录含未知成员，已保留。"); }
            if (expected.Count != 0) throw new IOException("交接目录缺少已登记成员，已保留。");
            var audit = Path.Combine(directory, "launch.json"); var recordPath = Path.Combine(directory, "handoff.json"); var targetPath = Path.Combine(directory, "envelope.json");
            var finished = CleanupJson(recordPath); InstallationCore.Keys(finished, "schemaVersion", "root", "buildVersion", "status", "exitCode", "actualHelper", "actualInstaller", "sourceInstaller", "launchMetadataPath", "launchMetadataSha256", "cleanup");
            if (InstallationCore.Number(finished, "schemaVersion") != 1 || !InstallationCore.Equal(InstallationCore.Text(finished, "root"), current.root) || InstallationCore.Version4(InstallationCore.Text(finished, "buildVersion")) > InstallationCore.Version4(current.buildVersion) || InstallationCore.Text(finished, "status") != "installer-finished" || InstallationCore.Number(finished, "exitCode") != 0) throw new IOException("交接不是已安装目标的成功终态，已保留。");
            var launchAudit = CleanupJson(audit);
            var stage = new InstallationLaunch { ownerSid = CurrentSid(), parent = TemporaryParent(), DirectoryPath = InstallationCore.Full(InstallationCore.Text(launchAudit, "temporaryDirectory")), auditPath = audit, metadataSha256 = InstallationCore.Digest(launchAudit, "metadataSha256") };
            stage.VerifyDirectory(); var metadata = CleanupJson(stage.MetadataPath);
            InstallationCore.Keys(metadata, "schemaVersion", "kind", "productId", "installationId", "ownerSid", "root", "boxRoot", "installedBuildVersion", "targetBuildVersion", "payloadManifestSha256", "currentMappingSha256", "temporaryParent", "temporaryDirectory", "auditPath", "helper", "installer", "target");
            if (InstallationCore.Number(metadata, "schemaVersion") != 1 || InstallationCore.Text(metadata, "kind") != "TableMax.ApplicationUpdate.Launch" || InstallationCore.Text(metadata, "productId") != InstallationCore.ProductId || InstallationCore.Text(metadata, "installationId") != current.installationId || InstallationCore.Text(metadata, "ownerSid") != current.ownerSid || !InstallationCore.Equal(InstallationCore.Text(metadata, "root"), current.root) || !InstallationCore.Equal(InstallationCore.Text(metadata, "boxRoot"), current.boxRoot) || InstallationCore.Text(metadata, "targetBuildVersion") != InstallationCore.Text(finished, "buildVersion") || !InstallationCore.Equal(InstallationCore.Text(metadata, "temporaryParent"), stage.parent) || !InstallationCore.Equal(InstallationCore.Text(metadata, "temporaryDirectory"), stage.DirectoryPath) || !InstallationCore.Equal(InstallationCore.Text(metadata, "auditPath"), audit) || InstallationCore.HashFile(stage.MetadataPath) != stage.metadataSha256 || !InstallationCore.Equal(InstallationCore.Text(finished, "launchMetadataPath"), stage.MetadataPath) || InstallationCore.Digest(finished, "launchMetadataSha256") != stage.metadataSha256) throw new IOException("清理元数据与当前安装或原审计不匹配，已保留。");
            InstallationManifest previous = null, completedTarget = null; InstallerReceipt completedReceipt = null; string completedReceiptHash = null;
            foreach (var transaction in completed)
            {
                var next = InstallationManifest.Read(Path.Combine(transaction, "target.json"), true);
                if (next.installationId != current.installationId || next.ownerSid != current.ownerSid || !InstallationCore.Equal(next.root, current.root) || !InstallationCore.Equal(next.boxRoot, current.boxRoot) || next.buildVersion != InstallationCore.Text(metadata, "targetBuildVersion") || next.payloadManifestSha256 != InstallationCore.Digest(metadata, "payloadManifestSha256") || next.currentMappingSha256 != InstallationCore.Digest(metadata, "currentMappingSha256") || InstallationCore.Version4(next.buildVersion) > InstallationCore.Version4(current.buildVersion)) continue;
                var nextReceiptPath = Path.Combine(transaction, "target-receipt.json"); var nextReceipt = InstallerReceipt.Read(nextReceiptPath, next); var nextReceiptHash = InstallationCore.HashFile(nextReceiptPath);
                if (next.buildVersion == current.buildVersion && (!SameManifest(next, current) || nextReceiptHash != receiptHash || InstallationCore.Encode(nextReceipt) != InstallationCore.Encode(receipt))) continue;
                var priorPath = Path.Combine(transaction, "previous.json"); if (!File.Exists(priorPath)) continue;
                var prior = InstallationManifest.Read(priorPath, true);
                if (prior.installationId == current.installationId && prior.ownerSid == current.ownerSid && InstallationCore.Equal(prior.root, current.root) && InstallationCore.Equal(prior.boxRoot, current.boxRoot) && prior.buildVersion == InstallationCore.Text(metadata, "installedBuildVersion") && InstallationCore.Version4(prior.buildVersion) < InstallationCore.Version4(next.buildVersion)) { previous = prior; completedTarget = next; completedReceipt = nextReceipt; completedReceiptHash = nextReceiptHash; break; }
            }
            if (previous == null) throw new IOException("没有匹配原安装身份的已完成事务，已保留。");
            stage.sourceIdentity = previous; stage.helper = ReadRecord(metadata["helper"]); stage.installer = ReadRecord(metadata["installer"]); stage.target = ReadRecord(metadata["target"]);
            var oldHelper = previous.files.Single(file => file.path == "UpdateHelper.exe");
            if (!InstallationCore.Equal(stage.helper.path, stage.HelperPath) || !InstallationCore.Equal(stage.helper.sourcePath, Path.Combine(directory, "UpdateHelper.exe")) || stage.helper.bytes != oldHelper.bytes || stage.helper.sha256 != oldHelper.sha256 || !InstallationCore.Equal(stage.installer.path, stage.InstallerPath) || !InstallationCore.Equal(stage.installer.sourcePath, Path.Combine(current.boxRoot, "updates", "downloads", completedReceipt.sha256, "TableMax-" + completedTarget.releaseVersion + "-installer-win-x64.exe")) || stage.installer.bytes != completedReceipt.bytes || stage.installer.sha256 != completedReceipt.sha256 || !InstallationCore.Equal(stage.target.path, targetPath) || !InstallationCore.Equal(stage.target.sourcePath, targetPath) || stage.target.bytes > 16384) throw new IOException("清理文件元组不匹配原协调器或已完成签名目标，已保留。");
            stage.VerifyAudit(previous); VerifyFile(stage.target); verifySignedTarget(File.ReadAllText(targetPath, InstallationCore.Utf8), completedTarget, completedReceipt);
            var sourceInstaller = ReadRecord(finished["sourceInstaller"]);
            if (InstallationCore.Encode(sourceInstaller.Public) != InstallationCore.Encode(stage.installer.Public)) throw new IOException("已完成安装器元组与原审计不同，已保留。");
            var priorCleanup = InstallationCore.Object(finished["cleanup"]); InstallationCore.Keys(priorCleanup, "installerDeleted", "selfHelperRetained", "reason");
            if (!(priorCleanup["installerDeleted"] is bool) || !Object.Equals(priorCleanup["selfHelperRetained"], true) || !(priorCleanup["reason"] is string)) throw new IOException("原清理结果格式无效，已保留。");
            Observation(InstallationCore.Object(finished["actualHelper"]), stage.helper, true); Observation(InstallationCore.Object(finished["actualInstaller"]), stage.installer, false);
            var allowed = new HashSet<string>(new[] { stage.HelperPath, stage.InstallerPath, stage.MetadataPath }, StringComparer.OrdinalIgnoreCase);
            foreach (var path in Directory.GetFileSystemEntries(stage.DirectoryPath)) if (!allowed.Remove(path) || Directory.Exists(path)) throw new IOException("临时目录含未知成员，已保留。");
            if (allowed.Contains(stage.HelperPath) || allowed.Contains(stage.MetadataPath)) throw new IOException("临时目录缺少原helper或元数据，已保留。");
            if ((bool)priorCleanup["installerDeleted"] != !File.Exists(stage.InstallerPath)) throw new IOException("安装器副本与原清理结果不匹配，已保留。");
            var retainedInstaller = new Record { sourcePath = stage.installer.sourcePath, path = stage.installer.sourcePath, bytes = stage.installer.bytes, sha256 = stage.installer.sha256 }; VerifyFile(retainedInstaller);
            var files = new List<Record> { stage.helper };
            if (File.Exists(stage.InstallerPath)) files.Add(stage.installer);
            files.Add(new Record { sourcePath = stage.MetadataPath, path = stage.MetadataPath, bytes = (int)new FileInfo(InstallationCore.IO(stage.MetadataPath)).Length, sha256 = stage.metadataSha256 });
            files.Add(new Record { sourcePath = stage.helper.sourcePath, path = stage.helper.sourcePath, bytes = stage.helper.bytes, sha256 = stage.helper.sha256 });
            using (var directoryLease = stage.OpenCleanupDirectory())
            {
            var leases = new List<CleanupLease>();
            try
            {
                foreach (var file in files)
                {
                    leases.Add(new CleanupLease(file.path, file.bytes, file.sha256));
                }
                var auditHash = InstallationCore.HashFile(audit); var handoffHash = InstallationCore.HashFile(recordPath);
                Action<string> journal = status => InstallationCore.Atomic(cleanupPath, new { schemaVersion = 1, kind = "TableMax.ApplicationUpdate.Cleanup", status, root = current.root, boxRoot = current.boxRoot, installationId = current.installationId, ownerSid = current.ownerSid, currentBuildVersion = current.buildVersion, buildVersion = completedTarget.buildVersion, payloadManifestSha256 = completedTarget.payloadManifestSha256, currentMappingSha256 = completedTarget.currentMappingSha256, receiptSha256 = completedReceiptHash, launchAuditSha256 = auditHash, handoffSha256 = handoffHash, launchMetadataPath = stage.MetadataPath, launchMetadataSha256 = stage.metadataSha256, targetEnvelopeSha256 = stage.target.sha256, temporaryDirectory = stage.DirectoryPath, removed = files.Select(file => file.Public).ToArray(), retainedSourceInstaller = retainedInstaller.Public });
                journal("prepared");
                foreach (var lease in leases) lease.Delete();
                foreach (var stream in leases) stream.Dispose(); leases.Clear();
                stage.VerifyDirectory(); if (Directory.GetFileSystemEntries(stage.DirectoryPath).Length != 0) throw new IOException("临时目录出现未确认内容，已保留。");
                DeleteCleanupHandle(directoryLease);
                journal("completed");
            }
            finally { foreach (var stream in leases) stream.Dispose(); }
            }
        }
    }

    // JavaScriptSerializer accepts duplicate object keys. Signed and destructive
    // contracts use this bounded parser before any deserialization or side effect.
    internal sealed class StrictJson
    {
        private readonly string source; private readonly bool canonicalIntegers; private int cursor;
        private StrictJson(string source, bool canonicalIntegers, int maximumLength) { if (source.Length > maximumLength) throw new IOException("JSON 描述过长。"); this.source = source; this.canonicalIntegers = canonicalIntegers; }
        public static object Parse(string source, bool canonicalIntegers = false, int maximumLength = 1024 * 1024) { var parser = new StrictJson(source, canonicalIntegers, maximumLength); var value = parser.Value(0); parser.Space(); if (parser.cursor != source.Length) throw new IOException("JSON 尾部无效。"); return value; }
        private void Space() { while (cursor < source.Length && " \r\n\t".IndexOf(source[cursor]) >= 0) cursor++; }
        private char Take() { if (cursor >= source.Length) throw new IOException("JSON 意外结束。"); return source[cursor++]; }
        private bool At(char c) { Space(); return cursor < source.Length && source[cursor] == c; }
        private object Value(int depth)
        {
            if (depth > (canonicalIntegers ? 16 : 32)) throw new IOException("JSON 嵌套过深。"); Space();
            if (At('{')) { cursor++; var map = new Dictionary<string, object>(StringComparer.Ordinal); if (At('}')) { cursor++; return map; } do { Space(); var key = String(); if (map.ContainsKey(key)) throw new IOException("JSON 字段重复。"); if (!At(':')) throw new IOException("JSON 字段无效。"); cursor++; map.Add(key, Value(depth + 1)); if (At('}')) { cursor++; return map; } if (!At(',')) throw new IOException("JSON 对象无效。"); cursor++; } while (true); }
            if (At('[')) { cursor++; var list = new List<object>(); if (At(']')) { cursor++; return list.ToArray(); } do { list.Add(Value(depth + 1)); if (At(']')) { cursor++; return list.ToArray(); } if (!At(',')) throw new IOException("JSON 数组无效。"); cursor++; } while (true); }
            if (At('"')) return String();
            foreach (var literal in new[] { "true", "false", "null" }) if (source.Substring(cursor).StartsWith(literal, StringComparison.Ordinal)) { cursor += literal.Length; return literal == "null" ? null : (object)(literal == "true"); }
            var start = cursor; if (At('-')) cursor++; if (cursor >= source.Length) throw new IOException("JSON 数值无效。");
            if (source[cursor] == '0') cursor++; else { if (source[cursor] < '1' || source[cursor] > '9') throw new IOException("JSON 数值无效。"); while (cursor < source.Length && Char.IsDigit(source[cursor])) cursor++; }
            if (cursor < source.Length && source[cursor] == '.') { cursor++; var digit = cursor; while (cursor < source.Length && Char.IsDigit(source[cursor])) cursor++; if (digit == cursor) throw new IOException("JSON 数值无效。"); }
            if (cursor < source.Length && (source[cursor] == 'e' || source[cursor] == 'E')) { cursor++; if (cursor < source.Length && (source[cursor] == '+' || source[cursor] == '-')) cursor++; var digit = cursor; while (cursor < source.Length && Char.IsDigit(source[cursor])) cursor++; if (digit == cursor) throw new IOException("JSON 数值无效。"); }
            var raw = source.Substring(start, cursor - start);
            if (!Decimal.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var number)) throw new IOException("JSON 数值超出范围。");
            if (canonicalIntegers && (!System.Text.RegularExpressions.Regex.IsMatch(raw, @"^(0|[1-9][0-9]*)$") || number > 9007199254740991M)) throw new IOException("签名JSON仅允许安全的标准整数。"); return number;
        }
        private string String()
        {
            if (Take() != '"') throw new IOException("JSON 字符串无效。"); var text = new StringBuilder();
            while (true) { var c = Take(); if (c == '"') return text.ToString(); if (c < 32) throw new IOException("JSON 包含控制字符。"); if (c != '\\') { text.Append(c); continue; } c = Take(); switch (c) { case '"': case '\\': case '/': text.Append(c); break; case 'b': text.Append('\b'); break; case 'f': text.Append('\f'); break; case 'n': text.Append('\n'); break; case 'r': text.Append('\r'); break; case 't': text.Append('\t'); break; case 'u': var hex = ""; for (var i = 0; i < 4; i++) hex += Take(); if (!UInt16.TryParse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var code)) throw new IOException("JSON 转义无效。"); text.Append((char)code); break; default: throw new IOException("JSON 转义无效。"); } }
        }
    }

    internal sealed class ManagedFile
    {
        public string path { get; set; } public int bytes { get; set; } public string sha256 { get; set; }
    }
    internal sealed class InstallerReceipt
    {
        public int schemaVersion { get; set; } public string productId { get; set; } public string installationId { get; set; } public string buildVersion { get; set; } public int bytes { get; set; } public string sha256 { get; set; }
        public static InstallerReceipt Read(string path, InstallationManifest identity)
        {
            InstallationCore.Safe(path); var value = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(path, InstallationCore.Utf8))); InstallationCore.Keys(value, "schemaVersion", "productId", "installationId", "buildVersion", "bytes", "sha256");
            var result = new InstallerReceipt { schemaVersion = InstallationCore.Number(value, "schemaVersion"), productId = InstallationCore.Text(value, "productId"), installationId = InstallationCore.Text(value, "installationId"), buildVersion = InstallationCore.Text(value, "buildVersion"), bytes = InstallationCore.Number(value, "bytes"), sha256 = InstallationCore.Digest(value, "sha256") };
            if (result.schemaVersion != 1 || result.productId != InstallationCore.ProductId || result.installationId != identity.installationId || result.buildVersion != identity.buildVersion || result.bytes < 1 || result.bytes >= 120000000) throw new IOException("安装器字节身份与安装实例不匹配。"); return result;
        }
    }
    internal sealed class InstallationManifest
    {
        public int schemaVersion { get; set; } public string productId { get; set; } public string arch { get; set; } public int installProtocol { get; set; }
        public string releaseVersion { get; set; } public string buildVersion { get; set; } public string payloadManifestSha256 { get; set; } public string currentMappingSha256 { get; set; } public ManagedFile[] files { get; set; }
        public string installationId { get; set; } public string root { get; set; } public string boxRoot { get; set; } public string ownerSid { get; set; }
        public static InstallationManifest Read(string path, bool installed)
        {
            InstallationCore.Safe(path); if (new FileInfo(InstallationCore.IO(path)).Length > 1024 * 1024) throw new IOException("安装清单过长。");
            var map = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(path, InstallationCore.Utf8), true));
            var required = new[] { "schemaVersion", "productId", "arch", "installProtocol", "releaseVersion", "buildVersion", "payloadManifestSha256", "currentMappingSha256", "files" };
            InstallationCore.Keys(map, installed ? required.Concat(new[] { "installationId", "root", "boxRoot", "ownerSid" }).ToArray() : required);
            if (InstallationCore.Number(map, "schemaVersion") != 1 || InstallationCore.Text(map, "productId") != InstallationCore.ProductId || InstallationCore.Text(map, "arch") != "x64" || InstallationCore.Number(map, "installProtocol") != 1) throw new IOException("安装清单产品不匹配。");
            var version = InstallationCore.Text(map, "buildVersion"); var release = InstallationCore.Text(map, "releaseVersion"); if (InstallationCore.Version4(version).ToString(3) != release) throw new IOException("公开版本与构建不匹配。");
            var list = map["files"] as object[]; if (list == null || list.Length == 0 || list.Length > 20000) throw new IOException("安装文件集合无效。");
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var files = new List<ManagedFile>(); long total = 0;
            foreach (var entry in list) { var file = InstallationCore.Object(entry); InstallationCore.Keys(file, "path", "bytes", "sha256"); var relative = InstallationCore.Text(file, "path"); InstallationCore.Member(Path.GetTempPath(), relative); if (!(relative == "TableMax.exe" || relative == "UpdateHelper.exe" || relative == "Updater.exe" || relative.StartsWith("data/app/", StringComparison.Ordinal)) || !names.Add(relative)) throw new IOException("安装文件归属或重复路径无效。"); var length = InstallationCore.Number(file, "bytes"); total += length; files.Add(new ManagedFile { path = relative, bytes = length, sha256 = InstallationCore.Digest(file, "sha256") }); }
            if (new[] { "TableMax.exe", "UpdateHelper.exe", "Updater.exe", "data/app/TableMax.exe", "data/app/node.exe", "data/app/server.cjs", "data/app/.tablemax-release.json", "data/app/preinstalled-games/bootstrap.json" }.Any(name => !names.Contains(name)) || total >= 120000000) throw new IOException("安装文件不完整或超过体积限制。");
            var result = new InstallationManifest { schemaVersion = 1, productId = InstallationCore.ProductId, arch = "x64", installProtocol = 1, releaseVersion = release, buildVersion = version, payloadManifestSha256 = InstallationCore.Digest(map, "payloadManifestSha256"), currentMappingSha256 = InstallationCore.Digest(map, "currentMappingSha256"), files = files.ToArray() };
            if (installed) { result.installationId = InstallationCore.Text(map, "installationId"); if (!Guid.TryParse(result.installationId, out _)) throw new IOException("安装实例无效。"); result.root = InstallationCore.Root(InstallationCore.Text(map, "root")); result.boxRoot = InstallationCore.Full(InstallationCore.Text(map, "boxRoot")); if (!InstallationCore.Equal(result.boxRoot, InstallationCore.Box(result.root))) throw new IOException("安装配置根不匹配。"); result.ownerSid = InstallationCore.Text(map, "ownerSid"); if (result.ownerSid != WindowsIdentity.GetCurrent().User.Value) throw new IOException("此安装属于另一 Windows 用户，请在原用户账户运行。"); }
            return result;
        }
        public static InstallationManifest Load(string root) { var result = Read(InstallationCore.IdentityPath(root), true); if (!InstallationCore.Equal(result.root, root)) throw new IOException("安装根不匹配。"); return result; }
        public void Verify(string directory)
        {
            foreach (var file in files) { var path = InstallationCore.Member(directory, file.path); if (!File.Exists(path) || new FileInfo(InstallationCore.IO(path)).Length != file.bytes || InstallationCore.HashFile(path) != file.sha256) throw new IOException("安装文件校验失败：" + file.path); }
            if (InstallationCore.HashFile(InstallationCore.Member(directory, "data/app/.tablemax-release.json")) != payloadManifestSha256 || InstallationCore.HashFile(InstallationCore.Member(directory, "data/app/preinstalled-games/bootstrap.json")) != currentMappingSha256) throw new IOException("完整载荷或当前游戏映射身份不匹配。");
        }
    }
}
