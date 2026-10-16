using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using File = TableMax.Installation.InstallationFile;
using Directory = TableMax.Installation.InstallationDirectory;

#if TABLEMAX_INSTALLATION_HANDOFF_TEST && !TABLEMAX_INSTALLATION_TEST
#error Application handoff harness requires the isolated fixture product.
#endif

namespace TableMax.Installation
{
    internal static class UpdateHelper
    {
        private sealed class HelperError : IOException { public int Code { get; } public HelperError(int code, string message) : base(message) { Code = code; } }
        private static Dictionary<string, string> options;
        private static bool progressRequested;
        private static void Progress(string phase, int completed = 0, int total = 0)
        {
            if (!progressRequested) return;
            // Display-only telemetry must not interrupt a file transaction.
            try { Console.WriteLine("TABLEMAX-INSTALL-PROGRESS-V1|" + phase + "|" + completed.ToString(System.Globalization.CultureInfo.InvariantCulture) + "|" + total.ToString(System.Globalization.CultureInfo.InvariantCulture)); }
            catch (IOException) { progressRequested = false; }
        }
        private static string diagnosticStage = "main.initialize", diagnosticMember;
        private static void Stage(string value, string relativePath = null) { diagnosticStage = value; diagnosticMember = relativePath; }
        private static void Diagnostic(Exception cause) => Console.Error.WriteLine("TableMax.Helper stage=" + diagnosticStage + " exceptionType=" + cause.GetType().FullName + " HResult=0x" + cause.HResult.ToString("X8", System.Globalization.CultureInfo.InvariantCulture) + (diagnosticMember == null ? "" : " relativePath=" + diagnosticMember));
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeServerProcessId(Microsoft.Win32.SafeHandles.SafePipeHandle pipe, out uint processId);
        [DllImport("kernel32.dll", EntryPoint = "QueryFullProcessImageNameW", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder path, ref int size);
        [DllImport("user32.dll", EntryPoint = "MessageBoxW", CharSet = CharSet.Unicode, ExactSpelling = true)]
        private static extern int Information(IntPtr owner, string text, string caption, uint kind);
        private static string Get(string key, bool required = true) => options.TryGetValue(key, out var value) && !String.IsNullOrEmpty(value) ? value : required ? throw new HelperError(10, "安装参数缺少 " + key + "。") : null;
        private static string Quote(string value) { if (value.Contains("\"") || value.EndsWith("\\", StringComparison.Ordinal)) throw new HelperError(10, "安装路径不能安全传递。"); return "\"" + value + "\""; }
        private static string TransactionRoot(string root) => Path.Combine(InstallationCore.Box(root), ".installation-transactions");
        private static readonly string[] DatabaseMembers = { "foundation.sqlite", "foundation.sqlite-wal", "foundation.sqlite-shm", "foundation.sqlite-journal", "room.sqlite", "room.sqlite-wal", "room.sqlite-shm", "room.sqlite-journal", "room.sqlite.migration.json", "room.sqlite.migration.lock" };
        private static string Fingerprint(Func<string, string> hash) => InstallationCore.Hash(InstallationCore.Utf8.GetBytes(String.Join("\n", DatabaseMembers.Select(name => name + ":" + hash(name)))));
        private sealed class MigrationLease : IDisposable
        {
            private sealed class Held { public string Path; public FileStream Stream; public long Bytes; public string Sha256; }
            internal sealed class SourceFile { public string path; public long bytes; public string sha256; }
            private readonly Dictionary<string, Held> held = new Dictionary<string, Held>(StringComparer.OrdinalIgnoreCase);
            private readonly List<string> paths = new List<string>();
            private readonly List<string> databasePaths = new List<string>();
            private readonly List<SourceFile> sourceFiles = new List<SourceFile>();
            private readonly string installationRoot;
            private string[] recoveryShape;
            private Mutex mutex; private bool acquired, disposed;
            public string SourceRoot { get; }
            public string SourceDataDirectory { get; }
            public string DestinationDataDirectory { get; }
            public IReadOnlyList<SourceFile> SourceFiles => sourceFiles;
            public bool RecoveryUncertain { get; private set; }
            public MigrationLease(string root, string migration)
            {
                installationRoot = InstallationCore.Full(root);
                SourceRoot = migration == null ? null : InstallationCore.Full(migration);
                if (SourceRoot != null)
                {
                    InstallationCore.Safe(SourceRoot); var box = InstallationCore.Box(root);
                    var sameRoot = InstallationCore.Equal(SourceRoot, root);
                    if (!sameRoot && (InstallationCore.Equal(SourceRoot, box) || SourceRoot.StartsWith(box + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || box.StartsWith(SourceRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))) throw new HelperError(10, "便携迁移根与安装目标重叠。");
                    if (Directory.Exists(box) && Directory.GetFileSystemEntries(box).Length != 0) throw new HelperError(10, "迁移目标 data 已有内容，未覆盖。");
                    SourceDataDirectory = ReadDataDirectory(SourceRoot, true);
                    if (InstallationCore.Equal(SourceDataDirectory, box) || SourceDataDirectory.StartsWith(box + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(10, "原数据指针位于迁移目标内，已保留并停止。");
                    DestinationDataDirectory = InstallationCore.Equal(SourceDataDirectory, SourceRoot) ? box : SourceDataDirectory;
                }
                else { SourceDataDirectory = ReadDataDirectory(InstallationCore.Box(root), false); DestinationDataDirectory = SourceDataDirectory; }
                var key = InstallationCore.Hash(InstallationCore.Utf8.GetBytes(SourceDataDirectory.ToUpperInvariant())).Substring(0, 32).ToUpperInvariant();
                mutex = new Mutex(false, "Local\\TableMax-" + key);
                try
                {
                    if (!(acquired = InstallationCore.Acquire(mutex, 0))) throw new HelperError(20, "原数据目录仍被 TableMax 使用；未写入迁移目标。");
                    databasePaths.AddRange(DatabaseMembers.Select(name => Path.Combine(SourceDataDirectory, name)));
                    recoveryShape = RecoveryShape();
                    if (Directory.Exists(SourceDataDirectory))
                        foreach (var backup in Directory.GetDirectories(SourceDataDirectory).Where(path => System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(path), @"^room-v1-backup-[a-f0-9-]{36}$")))
                        {
                            InstallationCore.Safe(backup);
                            databasePaths.AddRange(new[] { "room.sqlite", "room.sqlite-wal", "room.sqlite-shm", "room.sqlite-journal" }.Select(name => Path.Combine(backup, name)));
                            if (!File.Exists(Path.Combine(backup, "room.sqlite"))) RecoveryUncertain = true;
                        }
                    RecoveryUncertain = RecoveryUncertain || File.Exists(Path.Combine(SourceDataDirectory, "room.sqlite.migration.json")) || File.Exists(Path.Combine(SourceDataDirectory, "room.sqlite.migration.lock")) || recoveryShape.Any(name => !DatabaseMembers.Contains(name) && !System.Text.RegularExpressions.Regex.IsMatch(name, @"^room-v1-backup-[a-f0-9-]{36}(/(room\.sqlite(-wal|-shm|-journal)?|migration-completed\.json|migration-rolled-back\.json))?$"));
                    paths.AddRange(databasePaths);
                    var configurationRoot = SourceRoot ?? InstallationCore.Box(root);
                    if (SourceRoot != null || File.Exists(Path.Combine(configurationRoot, "TableMax.config.json"))) paths.Add(Path.Combine(configurationRoot, "TableMax.config.json"));
                    foreach (var path in paths)
                    {
                        InstallationCore.Safe(path); if (Directory.Exists(path)) throw new HelperError(20, "数据库成员被文件夹占用；原内容已保留。");
                        if (!File.Exists(path)) continue;
                        var stream = new FileStream(InstallationCore.IO(path), FileMode.Open, FileAccess.Read, FileShare.None);
                        var record = new Held { Path = path, Stream = stream }; held.Add(path, record); record.Bytes = stream.Length; record.Sha256 = Hash(stream);
                    }
                    if (held.TryGetValue(Path.Combine(configurationRoot, "TableMax.config.json"), out var config))
                    {
                        config.Stream.Position = 0;
                        using (var reader = new StreamReader(config.Stream, InstallationCore.Utf8, false, 4096, true))
                            if (!InstallationCore.Equal(ParseDataDirectory(configurationRoot, reader.ReadToEnd()), SourceDataDirectory)) throw new HelperError(20, "原数据目录配置在租约建立前变化；未迁移。");
                    }
                    if (SourceRoot != null)
                    {
                        // Freeze before creating data: the one parent/child
                        // exception must never recursively discover its copies.
                        foreach (var path in MigrationFiles(SourceRoot, installationRoot))
                            sourceFiles.Add(new SourceFile { path = path.Substring(SourceRoot.Length + 1).Replace('\\', '/'), bytes = new FileInfo(InstallationCore.IO(path)).Length, sha256 = held.TryGetValue(path, out var item) ? item.Sha256 : InstallationCore.HashFile(path) });
                    }
                    Verify();
                }
                catch (IOException cause) { Dispose(); if (cause is HelperError) throw; throw new HelperError(20, "数据目录仍被其他实例使用，或文件尚未释放；未写入迁移目标。"); }
                catch { Dispose(); throw; }
            }
            private static string Hash(FileStream stream) { stream.Position = 0; using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant(); }
            public void Verify()
            {
                if (disposed) throw new HelperError(20, "数据租约已释放，未继续复制。");
                if (!recoveryShape.SequenceEqual(RecoveryShape(), StringComparer.OrdinalIgnoreCase)) throw new HelperError(20, "可恢复数据库集合已变化，未继续安装或清理。");
                foreach (var path in paths)
                {
                    InstallationCore.Safe(path); var exists = File.Exists(path);
                    if (Directory.Exists(path) || exists != held.ContainsKey(path)) throw new HelperError(20, "原数据文件集合已变化，未继续安装；原档已保留。");
                    if (exists) { var record = held[path]; if (record.Stream.Length != record.Bytes || Hash(record.Stream) != record.Sha256) throw new HelperError(20, "原数据文件在租约期间变化，未继续安装。"); }
                }
                if (SourceRoot != null && !sourceFiles.Select(file => file.path).SequenceEqual(MigrationFiles(SourceRoot, installationRoot).Select(path => path.Substring(SourceRoot.Length + 1).Replace('\\', '/')), StringComparer.OrdinalIgnoreCase)) throw new HelperError(20, "原迁移文件清单已变化；原件已保留。");
            }
            private string[] RecoveryShape()
            {
                var names = new List<string>();
                if (Directory.Exists(SourceDataDirectory)) foreach (var path in Directory.GetFileSystemEntries(SourceDataDirectory))
                {
                    var name = Path.GetFileName(path); if (!name.StartsWith("room", StringComparison.OrdinalIgnoreCase) && !name.StartsWith("foundation", StringComparison.OrdinalIgnoreCase)) continue;
                    InstallationCore.Safe(path); names.Add(name);
                    if (Directory.Exists(path)) foreach (var child in Directory.GetFileSystemEntries(path)) { InstallationCore.Safe(child); names.Add(name + "/" + Path.GetFileName(child)); }
                }
                return names.OrderBy(name => name, StringComparer.OrdinalIgnoreCase).ToArray();
            }
            public object[] CopyDatabaseInputs(string destination, Action<string, long, string> ownCopy)
            {
                Verify(); var result = new List<object>();
                foreach (var source in databasePaths.Where(path => Path.GetFileName(path) == "room.sqlite" && held.ContainsKey(path)))
                {
                    var relative = source.Substring(SourceDataDirectory.Length + 1).Replace('\\', '/');
                    var target = InstallationCore.Member(destination, relative);
                    foreach (var suffix in new[] { "", "-wal", "-journal" }) if (held.ContainsKey(source + suffix)) CopyHeld(source + suffix, target + suffix, ownCopy);
                    var record = held[source]; result.Add(new { path = target, sourcePath = source, bytes = record.Bytes, sha256 = record.Sha256 });
                }
                return result.ToArray();
            }
            public string BindDestinationConfiguration(string box)
            {
                var path = Path.Combine(box, "TableMax.config.json");
                if (!File.Exists(path)) InstallationCore.Atomic(path, new { dataDirectory = "." });
                if (!held.TryGetValue(path, out var record))
                {
                    InstallationCore.Safe(path); var stream = new FileStream(InstallationCore.IO(path), FileMode.Open, FileAccess.Read, FileShare.None);
                    record = new Held { Path = path, Stream = stream }; held.Add(path, record); paths.Add(path); record.Bytes = stream.Length; record.Sha256 = Hash(stream);
                }
                record.Stream.Position = 0;
                using (var reader = new StreamReader(record.Stream, InstallationCore.Utf8, false, 4096, true))
                    if (!InstallationCore.Equal(ParseDataDirectory(box, reader.ReadToEnd()), DestinationDataDirectory)) throw new HelperError(20, "目标配置指针与迁移租约不符，未替换程序。");
                return DestinationDataDirectory;
            }
            public bool CopyHeld(string source, string target, Action<string, long, string> ownCopy = null)
            {
                if (disposed) throw new HelperError(20, "数据租约已释放，未继续复制。");
                if (!held.TryGetValue(InstallationCore.Full(source), out var record)) return false;
                InstallationCore.Safe(target); Directory.CreateDirectory(Path.GetDirectoryName(target));
                record.Stream.Position = 0;
                using (var output = new FileStream(InstallationCore.IO(target), FileMode.CreateNew, FileAccess.Write, FileShare.None)) { ownCopy?.Invoke(target, record.Bytes, record.Sha256); record.Stream.CopyTo(output); output.Flush(true); }
                if (new FileInfo(InstallationCore.IO(target)).Length != record.Bytes || InstallationCore.HashFile(target) != record.Sha256 || Hash(record.Stream) != record.Sha256) throw new HelperError(30, "持有的数据流复制校验失败；原件已保留。");
                return true;
            }
            public string Fingerprint(string directory)
            {
                if (!InstallationCore.Equal(directory, SourceDataDirectory)) return DatabaseFingerprint(directory);
                Verify();
                return UpdateHelper.Fingerprint(name => held.TryGetValue(Path.Combine(directory, name), out var record) ? record.Sha256 : "missing");
            }
            public void Dispose()
            {
                if (disposed) return; disposed = true;
                try { foreach (var record in held.Values) record.Stream.Dispose(); }
                finally { held.Clear(); try { if (acquired) { mutex.ReleaseMutex(); acquired = false; } } finally { mutex?.Dispose(); mutex = null; } }
            }
        }
        private static int Main(string[] arguments)
        {
            InstallationCore.InitializeRuntime();
            if (arguments.Length == 0)
            {
                Information(IntPtr.Zero, "这是 TableMax 的内部安装与卸载协调程序，不是日常更新入口。\n\n请打开同一安装目录中的 Updater.exe（程序更新），或从主机盒子的“程序更新”面板检查更新。存档和配置不会因此改变。", "TableMax 程序更新", 0x40);
                return 0;
            }
            Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), InstallationCore.Utf8) { AutoFlush = true });
            Console.SetError(new StreamWriter(Console.OpenStandardError(), InstallationCore.Utf8) { AutoFlush = true });
            try
            {
                Stage("main.arguments");
                options = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var arg in arguments) { if (!arg.StartsWith("--", StringComparison.Ordinal)) throw new HelperError(10, "安装参数无效。"); var separator = arg.IndexOf('='); var key = separator < 0 ? arg.Substring(2) : arg.Substring(2, separator - 2); if (options.ContainsKey(key)) throw new HelperError(10, "安装参数重复。"); options.Add(key, separator < 0 ? "true" : arg.Substring(separator + 1)); }
                var modes = new[] { "commit", "uninstall", "recover", "inspect-install", "apply-installer", "verify-vectors" }.Where(options.ContainsKey).ToArray();
                if (modes.Length != 1 || options.Keys.Any(key => !new[] { "commit", "uninstall", "recover", "inspect-install", "apply-installer", "verify-vectors", "root", "candidate", "manifest", "target", "installer", "installer-source", "parent-pid", "migration-root", "health-timeout", "vectors", "progress" }.Contains(key))) throw new HelperError(10, "安装操作或参数无效。");
                progressRequested = options.ContainsKey("progress");
                if (progressRequested && (modes[0] != "commit" || Get("progress") != "true")) throw new HelperError(10, "安装进度参数仅适用于完整安装。");
                if (modes[0] == "verify-vectors") return VerifyVectors();
                Stage("main.root"); var root = InstallationCore.Root(Get("root"));
                if (modes[0] == "inspect-install") { Console.WriteLine(InstallationCore.Encode(InstallationManifest.Load(root))); return 0; }
                if (modes[0] == "apply-installer") return ApplyInstaller(root);
                Stage("main.operation-lock");
                using (var operation = InstallationCore.Mutex("Operation", root))
                {
                    if (!InstallationCore.Acquire(operation, 30000)) throw new HelperError(20, "另一安装、更新或卸载正在进行。");
                    try
                    {
                        Progress("recover"); Stage("main.recover"); Recover(root);
                        if (modes[0] == "recover") { Console.WriteLine("{\"status\":\"recovered\"}"); return 0; }
                        if (modes[0] == "uninstall") { Uninstall(root); Console.WriteLine("{\"status\":\"uninstalled-data-retained\"}"); return 0; }
                        Stage("main.commit"); Commit(root); Console.WriteLine("{\"status\":\"confirmed\"}"); return 0;
                    }
                    finally { operation.ReleaseMutex(); }
                }
            }
            catch (HelperError cause) { Diagnostic(cause); Console.Error.WriteLine(cause.Message); return cause.Code; }
            catch (Exception cause) { Diagnostic(cause); Console.Error.WriteLine(cause is IOException || cause is UnauthorizedAccessException ? cause.Message : "安装协调失败；原数据及事务记录已保留。"); return 10; }
        }
        private static int VerifyVectors()
        {
            var fixture = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(Get("vectors"), InstallationCore.Utf8)));
            var keys = new Dictionary<string, string> { [InstallationCore.Text(fixture, "keyId")] = InstallationCore.Text(fixture, "publicKeyXml") };
            var results = new List<object>(); var failed = 0;
            foreach (var raw in (object[])fixture["vectors"])
            {
                var item = InstallationCore.Object(raw);
                foreach (var mode in new[] { "envelopeJson", "body" }.Where(item.ContainsKey))
                {
                    var accepted = false;
                    try { var envelope = mode == "envelopeJson" ? InstallationCore.Text(item, mode) : UpdateDescriptor.Extract(InstallationCore.Text(item, mode), out _); UpdateDescriptor.Verify(envelope, keys); accepted = true; } catch (Exception) { }
                    var passed = accepted == (InstallationCore.Text(item, "expected") == "valid"); if (!passed) failed++;
                    results.Add(new { id = InstallationCore.Text(item, "id") + ":" + mode, passed, accepted });
                }
            }
            var valid = ((object[])fixture["vectors"]).Select(InstallationCore.Object).First(item => InstallationCore.Text(item, "expected") == "valid");
            foreach (var test in new[] { new { Id = "mixed-machine-versions", Body = InstallationCore.Text(valid, "body") + "\n<!-- TABLEMAX-APPLICATION-UPDATE-V2:AAAA -->" }, new { Id = "body-limit", Body = new string('x', 131073) + InstallationCore.Text(valid, "body") } })
            {
                var accepted = false; try { UpdateDescriptor.Verify(UpdateDescriptor.Extract(test.Body, out _), keys); accepted = true; } catch (Exception) { }
                if (accepted) failed++; results.Add(new { id = test.Id, passed = !accepted, accepted });
            }
            Console.WriteLine(InstallationCore.Encode(new { passed = failed == 0, failures = failed, results })); return failed == 0 ? 0 : 1;
        }
        private static UpdateDescriptor Target(string pathname)
        {
            InstallationCore.Safe(pathname); if (new FileInfo(InstallationCore.IO(pathname)).Length > 16384) throw new HelperError(10, "更新签名描述过长。");
            return UpdateDescriptor.Verify(File.ReadAllText(pathname, InstallationCore.Utf8), TrustRoots.Read(typeof(UpdateHelper).Assembly));
        }
        private static int ApplyInstaller(string root)
        {
            var identity = InstallationManifest.Load(root); identity.Verify(root);
            var target = InstallationCore.Full(Get("target")); var descriptor = Target(target); var installer = InstallationCore.Full(Get("installer")); InstallationCore.Safe(installer);
            var expected = Path.Combine(identity.boxRoot, "updates", "downloads", descriptor.sha256, descriptor.assetName);
            if (!InstallationCore.Equal(installer, expected) || new FileInfo(InstallationCore.IO(installer)).Length != descriptor.bytes || InstallationCore.HashFile(installer) != descriptor.sha256 || InstallationCore.Version4(descriptor.buildVersion) <= InstallationCore.Version4(identity.buildVersion)) throw new HelperError(10, "更新候选、位置或版本不匹配。");
            var launch = InstallationLaunch.Read(Assembly.GetExecutingAssembly().Location, identity, installer, target, descriptor.buildVersion, descriptor.bytes, descriptor.sha256, descriptor.payloadManifestSha256, descriptor.currentMappingSha256);
            Dictionary<string, object> actualHelper;
            using (var self = Process.GetCurrentProcess())
            {
                var path = ProcessImage(self);
                if (!InstallationCore.Equal(path, launch.HelperPath) || !InstallationCore.Equal(Assembly.GetExecutingAssembly().Location, path)) throw new HelperError(10, "实际协调器模块与私有启动副本不匹配。");
                actualHelper = LaunchEvidence(launch.HelperTuple, self.Id, path, null, Assembly.GetExecutingAssembly().Location);
            }
            if (!Int32.TryParse(Get("parent-pid"), out var pid) || pid < 1) throw new HelperError(10, "更新父进程无效。");
            try
            {
                using (var parent = Process.GetProcessById(pid))
                {
                    _ = parent.Handle;
                    if (!InstallationCore.Equal(parent.MainModule.FileName, Path.Combine(identity.boxRoot, "app", "TableMax.exe"))) throw new HelperError(10, "更新父进程不属于此安装。");
                    var name = Environment.GetEnvironmentVariable("TABLEMAX_PARENT_HANDOFF_PIPE"); var token = Environment.GetEnvironmentVariable("TABLEMAX_PARENT_HANDOFF_TOKEN");
                    Environment.SetEnvironmentVariable("TABLEMAX_PARENT_HANDOFF_PIPE", null); Environment.SetEnvironmentVariable("TABLEMAX_PARENT_HANDOFF_TOKEN", null);
                    if (name == null || !name.StartsWith("TableMax.Handoff.", StringComparison.Ordinal) || token == null || token.Length != 64) throw new HelperError(20, "原进程句柄交接未获授权。");
                    using (var pipe = new NamedPipeClientStream(".", name, PipeDirection.InOut)) { pipe.Connect(5000); if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle, out var owner) || owner != (uint)pid) throw new HelperError(20, "原进程交接管道身份不匹配。"); using (var output = new StreamWriter(pipe, InstallationCore.Utf8, 4096, true) { AutoFlush = true }) output.WriteLine(InstallationCore.Encode(new { token, helperPid = Process.GetCurrentProcess().Id })); }
                    if (!parent.WaitForExit(15000) || parent.ExitCode != 0) throw new HelperError(20, "原程序尚未完成正常保存退出；未启动安装器。");
                }
            }
            catch (ArgumentException) { throw new HelperError(20, "原进程已退出但未取得可信关闭结果，未启动安装器。"); }
            launch.VerifyForLaunch(identity);
            var record = Path.Combine(Path.GetDirectoryName(target), "handoff.json");
            var actualInstaller = LaunchEvidence(launch.InstallerTuple, 0, null, null, null);
            int? installerExitCode = null;
            InstallationCore.Atomic(record, new { schemaVersion = 1, root, buildVersion = descriptor.buildVersion, status = "installer-starting", actualHelper, actualInstaller, sourceInstaller = launch.InstallerTuple, launchMetadataPath = launch.MetadataPath, launchMetadataSha256 = launch.MetadataSha256 });
            var start = new ProcessStartInfo(launch.InstallerPath, "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR=" + Quote(root) + " /TABLEMAXTARGET=" + Quote(target)) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = launch.DirectoryPath };
            try
            {
                using (var child = Process.Start(start))
                {
                    if (child == null) throw new HelperError(40, "安装器未返回实际进程句柄。");
                    actualInstaller = LaunchEvidence(launch.InstallerTuple, child.Id, null, null, null);
                    Exception observationError = null;
                    try
                    {
                        var path = ProcessImage(child); actualInstaller = LaunchEvidence(launch.InstallerTuple, child.Id, path, null, null);
                        if (!InstallationCore.Equal(path, launch.InstallerPath)) throw new IOException("实际安装器模块与已核验的私有副本不匹配。");
                    }
                    catch (Exception cause) { observationError = cause; actualInstaller["observationError"] = cause.Message; }
                    InstallationCore.Atomic(record, new { schemaVersion = 1, root, buildVersion = descriptor.buildVersion, status = "installer-running", actualHelper, actualInstaller, sourceInstaller = launch.InstallerTuple, launchMetadataPath = launch.MetadataPath, launchMetadataSha256 = launch.MetadataSha256 });
                    if (!child.WaitForExit(1860000)) throw new HelperError(40, "已创建安装器进程，但它未在时间预算内完成；副本与事务已保留。");
                    installerExitCode = child.ExitCode;
                    if (observationError != null) throw new IOException("已创建安装器进程，但实际模块路径未获确认；已等待其退出并保留副本。", observationError);
                    var cleanup = launch.CleanupInstaller(child.ExitCode == 0 && LaunchCleanupAllowed(root, identity, descriptor));
                    InstallationCore.Atomic(record, new { schemaVersion = 1, root, buildVersion = descriptor.buildVersion, status = child.ExitCode == 0 ? "installer-finished" : "installer-failed", exitCode = child.ExitCode, actualHelper, actualInstaller, sourceInstaller = launch.InstallerTuple, launchMetadataPath = launch.MetadataPath, launchMetadataSha256 = launch.MetadataSha256, cleanup });
                    return child.ExitCode == 0 ? 0 : 40;
                }
            }
            catch (Exception cause)
            {
                InstallationCore.Atomic(record, new { schemaVersion = 1, root, buildVersion = descriptor.buildVersion, status = "installer-failed", exitCode = installerExitCode, error = cause.Message, actualHelper, actualInstaller, sourceInstaller = launch.InstallerTuple, launchMetadataPath = launch.MetadataPath, launchMetadataSha256 = launch.MetadataSha256, cleanup = launch.CleanupInstaller(false) });
                throw new HelperError(40, "安装器启动或完成未获确认；完整更新副本与事务记录已保留。");
            }
        }
        private static string ProcessImage(Process process)
        {
            var path = new StringBuilder(32768); var size = path.Capacity;
            if (!QueryFullProcessImageName(process.Handle, 0, path, ref size)) { var code = Marshal.GetLastWin32Error(); throw new IOException("实际进程模块路径查询失败（代码 " + code + "）。", new System.ComponentModel.Win32Exception(code)); }
            var result = InstallationCore.Full(path.ToString()); InstallationCore.Safe(result);
            if (result.Length >= 260) throw new IOException("实际启动模块路径超过支持的进程边界。");
            return result;
        }
        private static Dictionary<string, object> LaunchEvidence(object tuple, int pid, string modulePath, string observationError, string assemblyLocation)
        {
            var result = InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(tuple), true));
            result["expectedPath"] = result["path"]; result["path"] = modulePath; result["pid"] = pid; result["modulePath"] = modulePath; result["pathObserved"] = modulePath != null; result["processStarted"] = pid > 0; result["queriedFromProcessHandle"] = modulePath != null;
            if (observationError != null) result["observationError"] = observationError;
            if (assemblyLocation != null) result["assemblyLocation"] = InstallationCore.Full(assemblyLocation);
            return result;
        }
        private static bool LaunchCleanupAllowed(string root, InstallationManifest previous, UpdateDescriptor target)
        {
            try
            {
                var current = InstallationManifest.Load(root); var receipt = InstallerReceipt.Read(InstallationCore.ReceiptPath(root), current);
                if (current.installationId != previous.installationId || current.ownerSid != previous.ownerSid || current.buildVersion != target.buildVersion || current.payloadManifestSha256 != target.payloadManifestSha256 || current.currentMappingSha256 != target.currentMappingSha256 || receipt.bytes != target.bytes || receipt.sha256 != target.sha256) return false;
                var transactions = TransactionRoot(root); InstallationCore.Safe(transactions); if (!Directory.Exists(transactions)) return false;
                foreach (var path in Directory.GetFileSystemEntries(transactions))
                {
                    if (!Directory.Exists(path) || !Guid.TryParse(Path.GetFileName(path), out _) || !File.Exists(Path.Combine(path, "state.json"))) return false;
                    var state = ReadState(path); var phase = InstallationCore.Text(state, "phase");
                    if (!InstallationCore.Equal(InstallationCore.Text(state, "root"), root) || (phase != "completed" && phase != "rolled-back" && phase != "preparation-aborted")) return false;
                }
                return true;
            }
            catch (Exception) { return false; }
        }
        private static bool Stop(string root, bool update)
        {
            Stage("stop.probe-run-open");
            using (var run = InstallationCore.Mutex("Run", root))
            {
                Stage("stop.probe-run-acquire");
                if (InstallationCore.Acquire(run, 0)) { Stage("stop.probe-run-release"); run.ReleaseMutex(); Stage("stop.probe-run-dispose"); return true; }
                Stage("stop.probe-run-dispose");
            }
            Stage("stop.identity"); var identity = InstallationManifest.Load(root);
            Stage("stop.pipe-open");
            using (var pipe = new NamedPipeClientStream(".", InstallationCore.ControlPipe(root), PipeDirection.InOut, PipeOptions.Asynchronous))
            {
                Stage("stop.pipe-connect");
                try { pipe.Connect(3000); } catch (TimeoutException) { throw new HelperError(20, "安装实例正在其他会话运行，或尚未能安全关闭。"); }
                Stage("stop.pipe-owner");
                if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle, out var owner)) throw new HelperError(20, "无法取得原生安装实例句柄。");
                using (var desktop = Process.GetProcessById((int)owner))
                {
                    _ = desktop.Handle;
                    Stage("stop.desktop-image");
                    if (!InstallationCore.Equal(desktop.MainModule.FileName, Path.Combine(identity.boxRoot, "app", "TableMax.exe"))) throw new HelperError(20, "控制管道不属于此安装实例。");
                    Stage("stop.writer-open");
                    using (var writer = new StreamWriter(pipe, InstallationCore.Utf8, 4096, true) { AutoFlush = true })
                    {
                        Stage("stop.reader-open");
                        using (var reader = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                        {
                            Stage("stop.request-write"); writer.WriteLine(InstallationCore.Encode(new { schemaVersion = 1, root, operation = update ? "update" : "uninstall" }));
                            Stage("stop.ack-read"); var answer = InstallationCore.Object(StrictJson.Parse(ReadLine(reader, 16384, 10000)));
                            Stage("stop.ack-validate"); InstallationCore.Keys(answer, "schemaVersion", "installationId", "root", "desktopPid", "confirmed", "running");
                            if (InstallationCore.Number(answer, "schemaVersion") != 1 || InstallationCore.Text(answer, "installationId") != identity.installationId || !InstallationCore.Equal(InstallationCore.Text(answer, "root"), root) || !(answer["confirmed"] is bool confirmed) || !confirmed) throw new HelperError(20, "对局未结束，或保存关闭未获确认；未替换程序。");
                            Stage("stop.native-exit");
                            if (InstallationCore.Number(answer, "desktopPid") != desktop.Id || !desktop.WaitForExit(15000) || desktop.ExitCode != 0) throw new HelperError(20, "原程序或浏览器没有确认正常退出；未替换程序。");
                            Stage("stop.reader-dispose-after-exit0");
                        }
                        Stage("stop.writer-dispose-after-exit0");
                    }
                    Stage("stop.desktop-dispose-after-exit0");
                }
                Stage("stop.pipe-dispose-after-exit0");
            }
            Stage("stop.final-run-open");
            using (var run = InstallationCore.Mutex("Run", root)) { Stage("stop.final-run-acquire"); if (!InstallationCore.Acquire(run, 5000)) throw new HelperError(20, "安装运行锁尚未释放。"); Stage("stop.final-run-release"); run.ReleaseMutex(); Stage("stop.final-run-dispose"); }
            Stage("stop.completed");
            return true;
        }
        private static void CheckUnknownApp(string root, InstallationManifest identity)
        {
            var app = Path.Combine(InstallationCore.Box(root), "app"); if (!Directory.Exists(app)) return;
            var known = new HashSet<string>((identity?.files ?? new ManagedFile[0]).Select(file => InstallationCore.Member(root, file.path)), StringComparer.OrdinalIgnoreCase);
            Walk(app, file => { if (!known.Contains(InstallationCore.Full(file))) throw new HelperError(10, "程序目录包含未知文件，已保留并停止替换。"); });
        }
        private static void Walk(string directory, Action<string> file)
        {
            InstallationCore.Safe(directory); foreach (var path in Directory.GetFileSystemEntries(directory)) { InstallationCore.Safe(path); if (Directory.Exists(path)) Walk(path, file); else file(path); }
        }
        private static void Commit(string root)
        {
            Progress("verify");
            var candidate = InstallationCore.Full(Get("candidate")); InstallationCore.Safe(candidate);
            if (InstallationCore.Equal(candidate, root) || candidate.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(10, "安装候选必须位于独立暂存目录。");
            var manifestPath = InstallationCore.Full(Get("manifest")); if (!manifestPath.StartsWith(candidate + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(10, "候选清单越界。");
            var next = InstallationManifest.Read(manifestPath, false); next.Verify(candidate);
            var installerSource = InstallationCore.Full(Get("installer-source")); InstallationCore.Safe(installerSource); var installerLength = new FileInfo(InstallationCore.IO(installerSource)).Length;
            if (installerLength < 1 || installerLength >= 120000000) throw new HelperError(10, "完整安装器长度无效。");
            var newReceipt = new InstallerReceipt { schemaVersion = 1, productId = InstallationCore.ProductId, bytes = (int)installerLength, sha256 = InstallationCore.HashFile(installerSource), buildVersion = next.buildVersion };
            var descriptorPath = Get("target", false);
            if (descriptorPath != null) { var target = Target(descriptorPath); if (target.buildVersion != next.buildVersion || target.bytes != newReceipt.bytes || target.sha256 != newReceipt.sha256 || target.payloadManifestSha256 != next.payloadManifestSha256 || target.currentMappingSha256 != next.currentMappingSha256) throw new HelperError(10, "安装目标与已签名更新不匹配。"); }
            var previous = File.Exists(InstallationCore.IdentityPath(root)) ? InstallationManifest.Load(root) : null;
            InstallationCore.ValidateStartupPaths(root, null);
            var retainedIdentity = Path.Combine(InstallationCore.Box(root), ".uninstalled.json");
            if (previous == null && File.Exists(retainedIdentity)) InstallationManifest.Read(retainedIdentity, true);
            var previousReceipt = previous == null ? null : InstallerReceipt.Read(InstallationCore.ReceiptPath(root), previous);
            if (previous != null)
            {
                var comparison = InstallationCore.Version4(next.buildVersion).CompareTo(InstallationCore.Version4(previous.buildVersion));
                if (comparison < 0 || (comparison == 0 && (next.payloadManifestSha256 != previous.payloadManifestSha256 || next.currentMappingSha256 != previous.currentMappingSha256 || newReceipt.sha256 != previousReceipt.sha256 || newReceipt.bytes != previousReceipt.bytes))) throw new HelperError(10, "降级或相同构建不同内容已被拒绝。");
            }
            else foreach (var file in next.files) { var destination = InstallationCore.Member(root, file.path); if (File.Exists(destination) || Directory.Exists(destination)) throw new HelperError(10, "首次安装的受管目标已有未知内容，已保留。"); }
            Progress("stop"); CheckUnknownApp(root, previous); Stop(root, true);
            var migration = Get("migration-root", false);
            Progress("preserve");
            using (var lease = new MigrationLease(root, migration))
            {
            TableMax.Portable.LegacyGames.Preserve(Path.Combine(InstallationCore.Box(root), "app"), Path.Combine(InstallationCore.Box(root), "games"));
            if (migration != null) Migrate(root, migration, lease);
            Directory.CreateDirectory(InstallationCore.Box(root));
            var activeData = lease.BindDestinationConfiguration(InstallationCore.Box(root)); InstallationCore.ValidateStartupPaths(root, activeData); lease.Verify();
            var transaction = Path.Combine(TransactionRoot(root), Guid.NewGuid().ToString("D")); InstallationCore.Safe(transaction); Directory.CreateDirectory(transaction);
            next.installationId = previous?.installationId ?? Guid.NewGuid().ToString("D"); next.root = root; next.boxRoot = InstallationCore.Box(root); next.ownerSid = WindowsIdentity.GetCurrent().User.Value;
            newReceipt.installationId = next.installationId;
            InstallationCore.Atomic(Path.Combine(transaction, "target.json"), next);
            InstallationCore.Atomic(Path.Combine(transaction, "target-receipt.json"), newReceipt);
            if (previousReceipt != null) InstallationCore.Atomic(Path.Combine(transaction, "previous-receipt.json"), previousReceipt);
            if (previous != null) InstallationCore.Atomic(Path.Combine(transaction, "previous.json"), previous);
            State(transaction, "preparing", root);
            Dictionary<string, ManagedFile> snapshot = null;
            if (previous != null) snapshot = Snapshot(root, transaction, previous);
            var staged = 0; Progress("stage", 0, next.files.Length);
            foreach (var file in next.files) { CopyVerified(InstallationCore.Member(candidate, file.path), InstallationCore.Member(Path.Combine(transaction, "next-files"), file.path), file); Progress("stage", ++staged, next.files.Length); }
            lease.Verify();
            State(transaction, "prepared", root);
            try
            {
                using (var run = InstallationCore.Mutex("Run", root))
                {
                    if (!InstallationCore.Acquire(run, 0)) throw new HelperError(20, "安装实例在关闭后再次运行，未替换程序。");
                    try
                    {
                        lease.Verify();
                        State(transaction, "switching", root);
                        var obsolete = ((IEnumerable<ManagedFile>)snapshot?.Values ?? Enumerable.Empty<ManagedFile>()).Where(file => !next.files.Any(item => String.Equals(item.path, file.path, StringComparison.OrdinalIgnoreCase))).ToArray();
                        var switched = 0; var switchingTotal = next.files.Length + obsolete.Length; Progress("switch", 0, switchingTotal);
                        foreach (var file in next.files) { ReplaceVerified(InstallationCore.Member(Path.Combine(transaction, "next-files"), file.path), InstallationCore.Member(root, file.path), file, snapshot != null && snapshot.TryGetValue(file.path, out var recorded) ? recorded : null); Progress("switch", ++switched, switchingTotal); }
                        foreach (var file in obsolete) { DeleteVerified(InstallationCore.Member(root, file.path), file); Progress("switch", ++switched, switchingTotal); }
                        InstallationCore.Atomic(InstallationCore.IdentityPath(root), next); InstallationCore.Atomic(InstallationCore.ReceiptPath(root), newReceipt); State(transaction, "installed", root);
                    }
                    finally { run.ReleaseMutex(); }
                }
                var dataDirectory = activeData; var before = lease.Fingerprint(dataDirectory);
                State(transaction, "launching", root, dataDirectory, before);
                // A service must open the same files itself. The target's
                // foundation exclusive lock decides this bounded handoff; a
                // competing old process makes health fail, never two hosts.
                lease.Verify(); lease.Dispose();
                Confirm(next, dataDirectory);
                State(transaction, "completed", root, dataDirectory, before);
            }
            catch (Exception cause)
            {
                var state = ReadState(transaction); var phase = InstallationCore.Text(state, "phase");
                if (phase != "launching") { Rollback(root, transaction, next, previous); State(transaction, "rolled-back", root); throw new HelperError(30, "程序切换失败，已恢复原程序文件；数据未回退。" ); }
                State(transaction, "health-failed", root, InstallationCore.Text(state, "dataDirectory"), InstallationCore.Text(state, "databaseFingerprint"));
                throw new HelperError(40, "新版未通过完整健康确认；原程序文件、数据与事务已保留，不自动启动旧版。" + (cause is TimeoutException ? "确认超时。" : ""));
            }
            // Only confirmed snapshots are retired. These copies are never the
            // running transient helper or user's original portable directory.
            Progress("cleanup"); CleanupCompleted(transaction, next, previous);
            }
            Progress("confirmed");
        }
        private static string ParseDataDirectory(string box, string json)
        {
            var value = InstallationCore.Object(StrictJson.Parse(json)); InstallationCore.Keys(value, "dataDirectory"); var configured = InstallationCore.Text(value, "dataDirectory"); if (String.IsNullOrWhiteSpace(configured)) throw new HelperError(10, "数据目录配置无效。");
            var result = InstallationCore.Full(Path.IsPathRooted(configured) ? configured : Path.Combine(box, configured)); InstallationCore.Safe(result); return result;
        }
        private static string ReadDataDirectory(string box, bool required)
        {
            var config = Path.Combine(box, "TableMax.config.json"); InstallationCore.Safe(config);
            if (!File.Exists(config)) { if (required) throw new HelperError(10, "原便携配置目录缺少 TableMax.config.json。"); return InstallationCore.Full(box); }
            return ParseDataDirectory(box, File.ReadAllText(config, InstallationCore.Utf8));
        }
        private static string DataDirectory(string root)
        {
            var config = Path.Combine(InstallationCore.Box(root), "TableMax.config.json");
            if (!File.Exists(config)) InstallationCore.Atomic(config, new { dataDirectory = "." });
            return ReadDataDirectory(InstallationCore.Box(root), true);
        }
        private static string DatabaseFingerprint(string directory)
        {
            return Fingerprint(name => File.Exists(Path.Combine(directory, name)) ? InstallationCore.HashFile(Path.Combine(directory, name)) : "missing");
        }
        private static void State(string transaction, string phase, string root, string dataDirectory = null, string databaseFingerprint = null) => InstallationCore.Atomic(Path.Combine(transaction, "state.json"), new { schemaVersion = 1, root, phase, dataDirectory, databaseFingerprint });
        private static Dictionary<string, object> ReadState(string transaction) { var result = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(Path.Combine(transaction, "state.json"), InstallationCore.Utf8))); InstallationCore.Keys(result, "schemaVersion", "root", "phase", "dataDirectory", "databaseFingerprint"); if (InstallationCore.Number(result, "schemaVersion") != 1) throw new HelperError(10, "事务格式无效。"); return result; }
        private static bool SamePayload(InstallationManifest left, InstallationManifest right)
        {
            return left.schemaVersion == right.schemaVersion && left.productId == right.productId && left.arch == right.arch && left.installProtocol == right.installProtocol && left.releaseVersion == right.releaseVersion && left.buildVersion == right.buildVersion && left.payloadManifestSha256 == right.payloadManifestSha256 && left.currentMappingSha256 == right.currentMappingSha256 && left.files.Length == right.files.Length && left.files.All(file => right.files.Any(other => other.path == file.path && other.bytes == file.bytes && other.sha256 == file.sha256));
        }
        private static void RepairPendingCoordinator(string root, string transaction, InstallationManifest target, InstallationManifest current, string data)
        {
            // Only a complete installer commit may bootstrap this one owned file.
            // A standalone recover/uninstall never trusts an arbitrary replacement.
            if (!options.ContainsKey("commit")) return;
            var coordinator = target.files.Single(file => file.path == "UpdateHelper.exe"); var live = InstallationCore.Member(root, coordinator.path);
            if (File.Exists(live) && new FileInfo(InstallationCore.IO(live)).Length == coordinator.bytes && InstallationCore.HashFile(live) == coordinator.sha256) return;
            if (!SamePayload(current, target) || current.installationId != target.installationId || !InstallationCore.Equal(target.root, root) || !InstallationCore.Equal(current.boxRoot, target.boxRoot) || current.ownerSid != target.ownerSid) throw new HelperError(10, "协调器修复的当前身份与恢复目标不匹配，已保留原内容。");
            var candidate = InstallationCore.Full(Get("candidate")); InstallationCore.Safe(candidate);
            if (InstallationCore.Equal(candidate, root) || candidate.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(10, "协调器修复候选必须位于独立暂存目录。");
            var manifest = InstallationCore.Full(Get("manifest")); InstallationCore.Safe(manifest);
            if (!manifest.StartsWith(candidate + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(10, "协调器修复候选清单越界。");
            var supplied = InstallationManifest.Read(manifest, false);
            if (!SamePayload(supplied, target)) throw new HelperError(10, "完整安装包与待恢复目标不完全相同，未修复协调器。");
            supplied.Verify(candidate);
            var receipt = InstallerReceipt.Read(Path.Combine(transaction, "target-receipt.json"), target); var installedReceipt = InstallerReceipt.Read(InstallationCore.ReceiptPath(root), current);
            var installer = InstallationCore.Full(Get("installer-source")); InstallationCore.Safe(installer);
            if (receipt.bytes != installedReceipt.bytes || receipt.sha256 != installedReceipt.sha256 || !File.Exists(installer) || new FileInfo(InstallationCore.IO(installer)).Length != receipt.bytes || InstallationCore.HashFile(installer) != receipt.sha256 || InstallationCore.HashFile(Assembly.GetExecutingAssembly().Location) != coordinator.sha256) throw new HelperError(10, "完整安装包、恢复协调器或原安装器字节身份不匹配，已保留原内容。");
            var descriptorPath = Get("target", false);
            if (descriptorPath != null) { var descriptor = Target(descriptorPath); if (descriptor.buildVersion != target.buildVersion || descriptor.bytes != receipt.bytes || descriptor.sha256 != receipt.sha256 || descriptor.payloadManifestSha256 != target.payloadManifestSha256 || descriptor.currentMappingSha256 != target.currentMappingSha256) throw new HelperError(10, "协调器修复与已签名更新目标不匹配。"); }
            CheckUnknownApp(root, current);
            foreach (var file in current.files) { var path = InstallationCore.Member(root, file.path); if (Directory.Exists(path) || (File.Exists(path) && new FileInfo(InstallationCore.IO(path)).Length >= 120000000)) throw new HelperError(10, "协调器修复遇到异常受管文件，原内容已保留。"); }
            using (var run = InstallationCore.Mutex("Run", root))
            {
                if (!InstallationCore.Acquire(run, 0)) throw new HelperError(20, "安装实例在协调器修复前再次运行，未替换程序。");
                try
                {
                    using (var lease = new MigrationLease(root, null))
                    {
                        if (!InstallationCore.Equal(lease.DestinationDataDirectory, data)) throw new HelperError(20, "协调器修复期间数据目录已变化，原内容已保留。");
                        lease.Verify(); var before = lease.Fingerprint(data);
                        var prior = File.Exists(live) ? new ManagedFile { path = coordinator.path, bytes = (int)new FileInfo(InstallationCore.IO(live)).Length, sha256 = InstallationCore.HashFile(live) } : null;
                        var repair = Path.Combine(transaction, "coordinator-repair-" + Guid.NewGuid().ToString("N")); InstallationCore.Safe(repair); Directory.CreateDirectory(repair);
                        var record = Path.Combine(repair, "record.json");
                        Action<string> journal = status => InstallationCore.Atomic(record, new { schemaVersion = 1, root, installationId = target.installationId, buildVersion = target.buildVersion, status, file = coordinator, previousMissing = prior == null, previous = prior, databaseFingerprint = before });
                        journal("preparing");
                        if (prior != null) CopyVerified(live, Path.Combine(repair, "original-helper"), prior);
                        var verified = Path.Combine(repair, "verified-helper"); CopyVerified(InstallationCore.Member(candidate, coordinator.path), verified, coordinator);
                        lease.Verify(); if (lease.Fingerprint(data) != before) throw new HelperError(20, "协调器修复期间数据库已有变化，已保留原内容。");
                        journal("prepared"); ReplaceVerified(verified, live, coordinator, prior); journal("restored");
                    }
                }
                finally { run.ReleaseMutex(); }
            }
        }
        private static void Recover(string root)
        {
            var transactions = TransactionRoot(root); InstallationCore.Safe(transactions); if (!Directory.Exists(transactions)) return;
            foreach (var path in Directory.GetDirectories(transactions))
            {
                if (!Guid.TryParse(Path.GetFileName(path), out _)) continue; InstallationCore.Safe(path);
                if (!File.Exists(Path.Combine(path, "state.json"))) continue;
                var state = ReadState(path); if (!InstallationCore.Equal(InstallationCore.Text(state, "root"), root)) throw new HelperError(10, "恢复事务安装根不匹配。");
                var phase = InstallationCore.Text(state, "phase");
                if (phase == "preparing")
                {
                    // No live program file has changed at this boundary. Remove
                    // only complete, hash-identified copies; retain a partial or
                    // modified copy and stop instead of accumulating more stages.
                    var preparingTarget = InstallationManifest.Read(Path.Combine(path, "target.json"), true);
                    foreach (var file in preparingTarget.files) DeleteVerified(InstallationCore.Member(Path.Combine(path, "next-files"), file.path), file);
                    var prior = Path.Combine(path, "previous.json");
                    if (File.Exists(prior))
                    {
                        var preparingPrevious = InstallationManifest.Read(prior, true);
                        var snapshots = File.Exists(Path.Combine(path, "previous-snapshot.json")) ? ReadSnapshot(path, preparingPrevious).Values : (IEnumerable<ManagedFile>)preparingPrevious.files;
                        foreach (var file in snapshots) DeleteVerified(InstallationCore.Member(Path.Combine(path, "previous-files"), file.path), file);
                    }
                    RemoveEmpty(Path.Combine(path, "next-files")); RemoveEmpty(Path.Combine(path, "previous-files")); State(path, "preparation-aborted", root); continue;
                }
                if (phase == "preparation-aborted") continue;
                if (phase == "completed" || phase == "rolled-back")
                {
                    var completedTarget = InstallationManifest.Read(Path.Combine(path, "target.json"), true); var completedPrevious = Path.Combine(path, "previous.json");
                    CleanupCompleted(path, completedTarget, File.Exists(completedPrevious) ? InstallationManifest.Read(completedPrevious, true) : null); continue;
                }
                Stop(root, !options.ContainsKey("uninstall"));
                var next = InstallationManifest.Read(Path.Combine(path, "target.json"), true);
                var previousPath = Path.Combine(path, "previous.json"); var previous = File.Exists(previousPath) ? InstallationManifest.Read(previousPath, true) : null;
                if (phase == "launching" || phase == "health-failed")
                {
                    var data = InstallationCore.Text(state, "dataDirectory");
                    if (DatabaseFingerprint(data) != InstallationCore.Text(state, "databaseFingerprint"))
                    {
                        // A restart of the same verified target can finish a lost
                        // confirmation. A changed database is never opened by the
                        // old program and is never restored from a byte snapshot.
                        var current = InstallationManifest.Load(root); if (current.installationId != next.installationId || current.buildVersion != next.buildVersion || current.payloadManifestSha256 != next.payloadManifestSha256 || current.currentMappingSha256 != next.currentMappingSha256) throw new HelperError(40, "数据库已有变化且新程序身份不匹配；保留原数据和恢复记录。");
                        if (options.ContainsKey("uninstall"))
                        {
                            // Uninstall observes and quarantines damaged owned
                            // bytes itself. Check its preservation boundary before
                            // retiring verified stages, without requiring health.
                            CheckUnknownApp(root, current);
                            foreach (var file in current.files) { var live = InstallationCore.Member(root, file.path); if (File.Exists(live) && new FileInfo(InstallationCore.IO(live)).Length >= 120000000) throw new HelperError(10, "异常程序文件过大，已保留并停止卸载。"); }
                        }
                        else
                        {
                            RepairPendingCoordinator(root, path, next, current, data);
                            try { next.Verify(root); }
                            catch (Exception) { throw new HelperError(40, "数据库已有变化，当前新版程序文件未通过核验；数据与事务已保留。请默认卸载以保留数据，再运行同一或更高版本的完整安装器；未启动旧版。"); }
                            try { Confirm(next, data); }
                            catch (Exception) { throw new HelperError(40, "数据库已变化；同一新版仍未通过健康确认。请默认卸载以保留数据，再运行同一或更高版本的完整安装器；未启动旧版或覆盖数据。"); }
                        }
                        State(path, "completed", root, data, InstallationCore.Text(state, "databaseFingerprint")); CleanupCompleted(path, next, previous); continue;
                    }
                }
                else if (phase != "prepared" && phase != "switching" && phase != "installed") throw new HelperError(10, "未知升级事务阶段，已保留。");
                Rollback(root, path, next, previous); State(path, "rolled-back", root);
            }
        }
        private static void Rollback(string root, string transaction, InstallationManifest next, InstallationManifest previous)
        {
            var snapshot = previous == null ? new Dictionary<string, ManagedFile>(StringComparer.OrdinalIgnoreCase) : ReadSnapshot(transaction, previous);
            foreach (var file in next.files) { var current = InstallationCore.Member(root, file.path); snapshot.TryGetValue(file.path, out var old); if (File.Exists(current) && InstallationCore.HashFile(current) != file.sha256 && (old == null || InstallationCore.HashFile(current) != old.sha256)) throw new HelperError(30, "恢复目标包含已改变文件，未覆盖未知内容。"); }
            foreach (var file in snapshot.Values) ReplaceVerified(InstallationCore.Member(Path.Combine(transaction, "previous-files"), file.path), InstallationCore.Member(root, file.path), file, next.files.FirstOrDefault(item => String.Equals(item.path, file.path, StringComparison.OrdinalIgnoreCase)), true);
            foreach (var file in next.files) if (!snapshot.ContainsKey(file.path)) DeleteVerified(InstallationCore.Member(root, file.path), file);
            if (previous != null) InstallationCore.Atomic(InstallationCore.IdentityPath(root), previous); else if (File.Exists(InstallationCore.IdentityPath(root))) { var actual = InstallationManifest.Load(root); if (actual.installationId != next.installationId) throw new HelperError(30, "安装身份已改变，未删除。"); File.Delete(InstallationCore.IdentityPath(root)); }
            var receipt = Path.Combine(transaction, "previous-receipt.json");
            if (previous != null) InstallationCore.Atomic(InstallationCore.ReceiptPath(root), InstallerReceipt.Read(receipt, previous));
            else if (File.Exists(InstallationCore.ReceiptPath(root))) { InstallerReceipt.Read(InstallationCore.ReceiptPath(root), next); File.Delete(InstallationCore.ReceiptPath(root)); }
        }
        private static void CopyVerified(string source, string target, ManagedFile file)
        {
            if (!File.Exists(source) || new FileInfo(InstallationCore.IO(source)).Length != file.bytes || InstallationCore.HashFile(source) != file.sha256) throw new HelperError(30, "复制源身份不匹配。"); InstallationCore.Safe(target); Directory.CreateDirectory(Path.GetDirectoryName(target)); File.Copy(source, target, false); if (InstallationCore.HashFile(target) != file.sha256) throw new HelperError(30, "复制结果校验失败。");
        }
        private static Dictionary<string, ManagedFile> Snapshot(string root, string transaction, InstallationManifest previous)
        {
            var records = new List<object>(); var result = new Dictionary<string, ManagedFile>(StringComparer.OrdinalIgnoreCase);
            var inspected = 0; Progress("snapshot", 0, previous.files.Length);
            foreach (var file in previous.files)
            {
                var source = InstallationCore.Member(root, file.path);
                if (Directory.Exists(source)) throw new HelperError(10, "旧程序受管文件被未知文件夹占用，已保留。");
                if (!File.Exists(source)) { records.Add(new { path = file.path, missing = true, bytes = 0, sha256 = new string('0', 64) }); Progress("snapshot", ++inspected, previous.files.Length); continue; }
                var length = new FileInfo(InstallationCore.IO(source)).Length; if (length >= 120000000) throw new HelperError(10, "旧程序异常文件过大，保留原件并停止修复。");
                var actual = new ManagedFile { path = file.path, bytes = (int)length, sha256 = InstallationCore.HashFile(source) };
                CopyVerified(source, InstallationCore.Member(Path.Combine(transaction, "previous-files"), file.path), actual); result.Add(file.path, actual);
                records.Add(new { path = file.path, missing = false, bytes = actual.bytes, sha256 = actual.sha256 });
                Progress("snapshot", ++inspected, previous.files.Length);
            }
            InstallationCore.Atomic(Path.Combine(transaction, "previous-snapshot.json"), new { schemaVersion = 1, files = records }); return result;
        }
        private static Dictionary<string, ManagedFile> ReadSnapshot(string transaction, InstallationManifest previous)
        {
            var map = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(Path.Combine(transaction, "previous-snapshot.json"), InstallationCore.Utf8))); InstallationCore.Keys(map, "schemaVersion", "files");
            if (InstallationCore.Number(map, "schemaVersion") != 1 || !(map["files"] is object[] list) || list.Length != previous.files.Length) throw new HelperError(30, "旧程序保全快照格式无效。");
            var known = new HashSet<string>(previous.files.Select(file => file.path), StringComparer.OrdinalIgnoreCase); var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var result = new Dictionary<string, ManagedFile>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in list) { var record = InstallationCore.Object(entry); InstallationCore.Keys(record, "path", "missing", "bytes", "sha256"); var path = InstallationCore.Text(record, "path"); if (!known.Contains(path) || !seen.Add(path) || !(record["missing"] is bool missing)) throw new HelperError(30, "旧程序保全路径无效。"); var file = new ManagedFile { path = path, bytes = InstallationCore.Number(record, "bytes"), sha256 = InstallationCore.Digest(record, "sha256") }; if (!missing) result.Add(path, file); else if (file.bytes != 0 || file.sha256 != new string('0', 64)) throw new HelperError(30, "缺失文件保全标记无效。"); }
            return result;
        }
        private static void ReplaceVerified(string source, string target, ManagedFile file, ManagedFile prior = null, bool allowExistingSame = false)
        {
            InstallationCore.Safe(target);
            if (File.Exists(target)) { var current = InstallationCore.HashFile(target); if ((prior == null || current != prior.sha256) && !(allowExistingSame && current == file.sha256)) throw new HelperError(30, "切换目标已改变或包含未知内容，未覆盖。"); }
            if (Directory.Exists(target)) throw new HelperError(30, "切换目标被文件夹占用，已保留。");
            Directory.CreateDirectory(Path.GetDirectoryName(target)); var temporary = InstallationCore.TemporaryPath(target); var created = false;
            try
            {
                using (var output = new FileStream(InstallationCore.IO(temporary), FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    created = true;
                    Console.Error.WriteLine("切换临时文件（当前操作创建）：" + temporary);
                    using (var input = File.OpenRead(source)) input.CopyTo(output);
                    output.Flush(true);
                }
                if (new FileInfo(InstallationCore.IO(temporary)).Length != file.bytes || InstallationCore.HashFile(temporary) != file.sha256) throw new HelperError(30, "切换文件校验失败。");
                if (File.Exists(target)) File.Replace(temporary, target, null); else File.Move(temporary, target);
            }
            finally { if (created && File.Exists(temporary)) { InstallationCore.Safe(temporary); File.Delete(temporary); } }
        }
        private static void DeleteVerified(string target, ManagedFile file) { InstallationCore.Safe(target); if (!File.Exists(target)) return; if (new FileInfo(InstallationCore.IO(target)).Length != file.bytes || InstallationCore.HashFile(target) != file.sha256) throw new HelperError(30, "文件已改变，已保留。"); File.Delete(target); }
        private static void CleanupCompleted(string transaction, InstallationManifest target, InstallationManifest previous)
        {
            foreach (var file in target.files) DeleteVerified(InstallationCore.Member(Path.Combine(transaction, "next-files"), file.path), file);
            if (previous != null)
            {
                var snapshot = ReadSnapshot(transaction, previous);
                // Damaged owned bytes are retained as a repair quarantine. They
                // are never presented as a runnable previous version.
                foreach (var file in snapshot.Values)
                {
                    var original = previous.files.Single(item => String.Equals(item.path, file.path, StringComparison.OrdinalIgnoreCase));
                    if (file.bytes == original.bytes && file.sha256 == original.sha256) DeleteVerified(InstallationCore.Member(Path.Combine(transaction, "previous-files"), file.path), file);
                }
            }
            RemoveEmpty(Path.Combine(transaction, "next-files")); RemoveEmpty(Path.Combine(transaction, "previous-files"));
        }
        private static void RemoveEmpty(string directory)
        {
            InstallationCore.Safe(directory); if (!Directory.Exists(directory)) return;
            foreach (var child in Directory.GetDirectories(directory)) RemoveEmpty(child);
            if (Directory.GetFileSystemEntries(directory).Length == 0) Directory.Delete(directory);
        }
        private static void Uninstall(string root)
        {
            Stage("uninstall.identity"); var identity = InstallationManifest.Load(root);
            Stage("uninstall.receipt"); InstallerReceipt.Read(InstallationCore.ReceiptPath(root), identity);
            Stage("uninstall.unknown-app"); CheckUnknownApp(root, identity);
            Stage("uninstall.stop"); Stop(root, false);
            Stage("uninstall.reacquire-run-open");
            using (var run = InstallationCore.Mutex("Run", root))
            {
                Stage("uninstall.reacquire-run-acquire");
                if (!InstallationCore.Acquire(run, 0)) throw new HelperError(20, "卸载实例仍在运行。");
                try
                {
                    using (var dataLease = new MigrationLease(root, null))
                    {
                    var quarantine = Path.Combine(identity.boxRoot, "updates", "uninstall-quarantine-" + Guid.NewGuid().ToString("N"));
                    var actual = new List<ManagedFile>();
                    foreach (var file in identity.files)
                    {
                        Stage("uninstall.scan", file.path);
                        var path = InstallationCore.Member(root, file.path); if (!File.Exists(path)) continue;
                        var length = new FileInfo(InstallationCore.IO(path)).Length; if (length >= 120000000) throw new HelperError(10, "异常程序文件过大，已保留并停止卸载。");
                        var observed = new ManagedFile { path = file.path, bytes = (int)length, sha256 = InstallationCore.HashFile(path) };
                        if (observed.bytes != file.bytes || observed.sha256 != file.sha256) { Stage("uninstall.quarantine", file.path); CopyVerified(path, InstallationCore.Member(quarantine, file.path), observed); }
                        actual.Add(observed);
                    }
                    Stage("uninstall.quarantine-inventory");
                    if (Directory.Exists(quarantine)) InstallationCore.Atomic(Path.Combine(quarantine, "inventory.json"), new { schemaVersion = 1, installationId = identity.installationId, root, files = actual.Where(file => identity.files.Any(original => original.path == file.path && (original.bytes != file.bytes || original.sha256 != file.sha256))).ToArray() });
                    Stage("uninstall.resource-plan"); CleanupResources(identity, dataLease);
                    foreach (var file in actual.OrderBy(file => file.path == "UpdateHelper.exe" ? 1 : 0)) { Stage("uninstall.delete", file.path); DeleteVerified(InstallationCore.Member(root, file.path), file); }
                    RemoveEmptyDirectories(Path.Combine(identity.boxRoot, "app"), actual.Where(file => file.path.StartsWith("data/app/", StringComparison.Ordinal)).Select(file => InstallationCore.Member(root, file.path)));
                    Stage("uninstall.finalize-marker"); InstallationCore.Atomic(Path.Combine(identity.boxRoot, ".uninstalled.json"), identity);
                    Stage("uninstall.finalize-identity"); File.Delete(InstallationCore.IdentityPath(root));
                    }
                    Stage("uninstall.release-run");
                }
                finally { run.ReleaseMutex(); }
            }
            Stage("uninstall.completed");
        }
        private const int ResourceAuditLimit = 16 * 1024 * 1024;
        private sealed class AnalysisSource : IDisposable
        {
            private readonly FileStream stream;
            public readonly string SourcePath, CopyPath, Sha256;
            public readonly long Bytes;
            public object Record => new { path = CopyPath, sourcePath = SourcePath, bytes = Bytes, sha256 = Sha256 };
            public AnalysisSource(string source, string copy, ManagedFile expected, Action<string, long, string> ownCopy)
            {
                InstallationCore.Safe(source); InstallationCore.Safe(copy);
                SourcePath = source; CopyPath = copy;
                stream = new FileStream(InstallationCore.IO(source), FileMode.Open, FileAccess.Read, FileShare.None);
                try
                {
                    Bytes = stream.Length; if (Bytes > 8 * 1024 * 1024) throw new IOException("资源索引过大，已保留资源。");
                    Sha256 = StreamHash(stream);
                    if (expected != null && (Bytes != expected.bytes || Sha256 != expected.sha256)) throw new IOException("当前资源目录身份不符，已保留资源。");
                    stream.Position = 0;
                    using (var output = new FileStream(InstallationCore.IO(copy), FileMode.CreateNew, FileAccess.Write, FileShare.None)) { ownCopy(copy, Bytes, Sha256); stream.CopyTo(output); output.Flush(true); }
                    if (InstallationCore.HashFile(copy) != Sha256) throw new IOException("分析副本不一致，已保留资源。");
                }
                catch { stream.Dispose(); throw; }
            }
            public void Dispose() => stream.Dispose();
        }
        private static string ReadBoundedText(StreamReader reader, int limit)
        {
            var value = new StringBuilder(); var block = new char[4096]; int count;
            while ((count = reader.Read(block, 0, block.Length)) != 0) { if (value.Length + count > limit) throw new IOException("资源分析输出过长，已保留资源。"); value.Append(block, 0, count); }
            return value.ToString();
        }
        private static Dictionary<string, object> RunResourcePlanner(InstallationManifest identity, object input, string work)
        {
            var node = identity.files.Single(file => file.path == "data/app/node.exe"); var path = InstallationCore.Member(identity.root, node.path);
            if (!File.Exists(path) || new FileInfo(InstallationCore.IO(path)).Length != node.bytes || InstallationCore.HashFile(path) != node.sha256) throw new IOException("受管分析运行时不可用，已保留游戏资源。");
            string script;
            using (var resource = typeof(UpdateHelper).Assembly.GetManifestResourceStream("TableMax.InstallationCleanupPlan.mjs"))
            {
                if (resource == null) throw new IOException("缺少只读资源分析器，已保留游戏资源。");
                using (var reader = new StreamReader(resource, InstallationCore.Utf8)) script = ReadBoundedText(reader, 1024 * 1024);
            }
            var start = new ProcessStartInfo(path, "--input-type=module") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = work, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = InstallationCore.Utf8, StandardErrorEncoding = InstallationCore.Utf8 };
            start.EnvironmentVariables.Remove("NODE_OPTIONS"); start.EnvironmentVariables.Remove("NODE_PATH"); start.EnvironmentVariables["TEMP"] = work; start.EnvironmentVariables["TMP"] = work;
            using (var process = Process.Start(start))
            {
                if (process == null) throw new IOException("资源分析器未启动，已保留游戏资源。");
                _ = process.Handle;
                var output = Task.Run(() => ReadBoundedText(process.StandardOutput, ResourceAuditLimit));
                var error = Task.Run(() => ReadBoundedText(process.StandardError, 32768));
                try
                {
                    if (!InstallationCore.Equal(ProcessImage(process), path)) throw new IOException("资源分析进程身份不符，已保留游戏资源。");
                    var code = InstallationCore.Utf8.GetBytes("globalThis.TABLEMAX_UNINSTALL_ANALYSIS_INPUT=" + InstallationCore.Encode(input) + ";\n" + script);
                    process.StandardInput.BaseStream.Write(code, 0, code.Length); process.StandardInput.BaseStream.Flush(); process.StandardInput.Close();
                    if (!process.WaitForExit(120000) || !Task.WaitAll(new Task[] { output, error }, 5000)) throw new IOException("只读资源分析超时，已保留游戏资源。");
                    if (process.ExitCode != 0) throw new IOException("只读资源分析未完成，已保留游戏资源。");
                    return InstallationCore.Object(StrictJson.Parse(output.Result, false, ResourceAuditLimit));
                }
                finally
                {
                    if (!process.HasExited) { process.Kill(); if (!process.WaitForExit(5000)) throw new IOException("自有资源分析进程未退出，已保留临时副本与资源。"); }
                }
            }
        }
        private static Dictionary<string, object> ResourceFile(string relative, long bytes, string sha256, string reason) => new Dictionary<string, object> { ["path"] = relative, ["bytes"] = bytes, ["sha256"] = sha256, ["reason"] = reason };
        private static void RetainedInventory(string box, List<object> retained, List<object> entries, string reason)
        {
            var games = Path.Combine(box, "games"); if (!Directory.Exists(games)) return;
            Action<string> visit = null; visit = directory =>
            {
                InstallationCore.Safe(directory);
                foreach (var path in Directory.GetFileSystemEntries(directory))
                {
                    var relative = path.Substring(box.Length + 1).Replace('\\', '/');
                    try
                    {
                        InstallationCore.Safe(path);
                        if (Directory.Exists(path)) visit(path);
                        else retained.Add(ResourceFile(relative, new FileInfo(InstallationCore.IO(path)).Length, InstallationCore.HashFile(path), reason));
                    }
                    catch (IOException) { entries.Add(new { path = relative, kind = "unreadable-or-link", bytes = (long?)null, sha256 = (string)null, reason = "此成员无法可靠读取，原位保留且不跟随链接。" }); }
                    catch (UnauthorizedAccessException) { entries.Add(new { path = relative, kind = "unreadable", bytes = (long?)null, sha256 = (string)null, reason = "此成员无读取权限，原位保留。" }); }
                }
            };
            try { visit(games); }
            catch (IOException) { entries.Add(new { path = "games/", kind = "unreadable-or-link", bytes = (long?)null, sha256 = (string)null, reason }); }
            catch (UnauthorizedAccessException) { entries.Add(new { path = "games/", kind = "unreadable", bytes = (long?)null, sha256 = (string)null, reason }); }
        }
        private static void WriteResourceReceipt(InstallationManifest identity, string audit, Dictionary<string, object> value)
        {
            var stable = Path.Combine(identity.boxRoot, ".uninstall-resources.json");
            if (File.Exists(stable))
            {
                var raw = File.ReadAllText(stable, InstallationCore.Utf8); var prior = InstallationCore.Object(StrictJson.Parse(raw, false, ResourceAuditLimit));
                if (InstallationCore.Number(prior, "schemaVersion") != 1 || InstallationCore.Text(prior, "productId") != identity.productId || InstallationCore.Text(prior, "ownerSid") != identity.ownerSid || !InstallationCore.Equal(InstallationCore.Text(prior, "root"), identity.root) || !InstallationCore.Equal(InstallationCore.Text(prior, "boxRoot"), identity.boxRoot)) throw new IOException("卸载资源审计位置包含未知内容，未覆盖。");
                if (!InstallationCore.Equal(InstallationCore.Text(prior, "auditPath"), audit))
                {
                    var history = Path.Combine(Path.GetDirectoryName(audit), "previous-resource-receipt.json");
                    if (File.Exists(history)) throw new IOException("卸载资源审计历史位置已有内容，未覆盖。");
                    var bytes = InstallationCore.Utf8.GetBytes(raw); var file = new ManagedFile { bytes = bytes.Length, sha256 = InstallationCore.Hash(bytes) };
                    CopyVerified(stable, history, file);
                }
            }
            InstallationCore.Atomic(audit, value, ResourceAuditLimit); InstallationCore.Atomic(stable, value, ResourceAuditLimit);
        }
        private static void CleanupResources(InstallationManifest identity, MigrationLease lease)
        {
            const string conservative = "无法可靠确认全部存档与发行依赖，游戏资源已保留。";
            var auditDirectory = Path.Combine(identity.boxRoot, "updates", "uninstall-cleanup-" + Guid.NewGuid().ToString("N")); var audit = Path.Combine(auditDirectory, "receipt.json");
            Directory.CreateDirectory(auditDirectory);
            var deleted = new List<object>(); var retained = new List<object>(); var deferred = new List<object>(); var entries = new List<object>();
            var receipt = new Dictionary<string, object> { ["schemaVersion"] = 1, ["productId"] = identity.productId, ["installationId"] = identity.installationId, ["ownerSid"] = identity.ownerSid, ["root"] = identity.root, ["boxRoot"] = identity.boxRoot, ["dataDirectory"] = lease.SourceDataDirectory, ["buildVersion"] = identity.buildVersion, ["databaseFingerprint"] = lease.Fingerprint(lease.SourceDataDirectory), ["auditPath"] = audit, ["result"] = "retained", ["reason"] = conservative, ["deleted"] = deleted, ["retained"] = retained, ["deferred"] = deferred, ["entries"] = entries, ["referencedReleaseIds"] = new string[0], ["retainedBlobIds"] = new string[0] };
            string work = null; var sources = new List<AnalysisSource>(); var privateCopies = new List<Dictionary<string, object>>();
            var privateDeleted = new List<object>(); var privateRetained = new List<object>();
            var analysisWork = new Dictionary<string, object> { ["path"] = null, ["copies"] = privateCopies, ["deleted"] = privateDeleted, ["retained"] = privateRetained, ["result"] = "not-created" };
            receipt["analysisWork"] = analysisWork;
            // Register ownership immediately after CreateNew. A partial copy
            // retains its expected identity; it is never reported as verified.
            Action<string, long, string> ownCopy = (path, bytes, sha256) => privateCopies.Add(new Dictionary<string, object> { ["path"] = path, ["expectedBytes"] = bytes, ["expectedSha256"] = sha256 });
            try
            {
                work = InstallationLaunch.CreatePrivateWorkDirectory();
                analysisWork["path"] = work; analysisWork["result"] = "prepared";
                var catalogFile = identity.files.Single(file => file.path == "data/app/preinstalled-games/catalog.json");
                var catalog = new AnalysisSource(InstallationCore.Member(identity.root, catalogFile.path), Path.Combine(work, "catalog.json"), catalogFile, ownCopy); sources.Add(catalog);
                var mappingFile = identity.files.Single(file => file.path == "data/app/preinstalled-games/bootstrap.json");
                if (mappingFile.sha256 != identity.currentMappingSha256) throw new IOException("当前映射与安装身份不符，已保留资源。");
                var mapping = new AnalysisSource(InstallationCore.Member(identity.root, mappingFile.path), Path.Combine(work, "bootstrap.json"), mappingFile, ownCopy); sources.Add(mapping);
                var indexPath = Path.Combine(identity.boxRoot, "games", "index.json"); AnalysisSource index = null;
                if (File.Exists(indexPath)) { index = new AnalysisSource(indexPath, Path.Combine(work, "index.json"), null, ownCopy); sources.Add(index); }
                var databases = lease.CopyDatabaseInputs(work, ownCopy);
                receipt["sources"] = new { catalog = catalog.Record, mapping = mapping.Record, index = index?.Record, databases };
                var plan = RunResourcePlanner(identity, new { schemaVersion = 1, productId = identity.productId, installationId = identity.installationId, root = identity.root, boxRoot = identity.boxRoot, dataDirectory = lease.SourceDataDirectory, databaseFingerprint = receipt["databaseFingerprint"], databases, catalog = catalog.Record, mapping = mapping.Record, index = index?.Record, recoveryUncertain = lease.RecoveryUncertain }, work);
                foreach (var key in new[] { "productId", "installationId", "root", "boxRoot", "dataDirectory", "databaseFingerprint" }) if (InstallationCore.Text(plan, key) != (string)receipt[key]) throw new IOException("资源分析身份不匹配，已保留资源。");
                var files = plan["files"] as object[] ?? throw new IOException("资源分析成员无效。"); var pending = new List<Tuple<string, Dictionary<string, object>>>();
                foreach (var value in files)
                {
                    var file = InstallationCore.Object(value); var name = InstallationCore.Text(file, "path");
                    if (!name.StartsWith("games/", StringComparison.Ordinal)) throw new IOException("资源分析越出游戏仓库，已保留。");
                    if (InstallationCore.Text(file, "kind") != "file") { entries.Add(file); continue; }
                    var target = InstallationCore.Member(identity.boxRoot, name);
                    var tuple = ResourceFile(name, Convert.ToInt64(file["bytes"]), InstallationCore.Digest(file, "sha256"), InstallationCore.Text(file, "reason"));
                    if (InstallationCore.Text(file, "action") == "delete") pending.Add(Tuple.Create(target, tuple)); else retained.Add(tuple);
                }
                receipt["referencedReleaseIds"] = plan["referencedReleaseIds"]; receipt["retainedBlobIds"] = plan["retainedBlobIds"];
                if (InstallationCore.Text(plan, "status") != "complete") throw new IOException(conservative);
                var leases = new List<InstallationLaunch.CleanupLease>();
                try
                {
                    lease.Verify();
                    foreach (var item in pending) leases.Add(new InstallationLaunch.CleanupLease(item.Item1, Convert.ToInt64(item.Item2["bytes"]), (string)item.Item2["sha256"]));
                    receipt["result"] = "prepared"; receipt["planned"] = pending.Select(item => item.Item2).ToArray(); receipt["reason"] = "已确认存档依赖与全部原文件句柄，仅删除无引用的当前受管资源。"; WriteResourceReceipt(identity, audit, receipt);
                    for (var n = 0; n < leases.Count; n++) { leases[n].Delete(); deleted.Add(pending[n].Item2); }
                }
                catch
                {
                    foreach (var item in pending.Where(item => !deleted.Contains(item.Item2))) { var tuple = item.Item2; tuple["reason"] = "成员被占用、变化或删除未获确认，原位保留。"; deferred.Add(tuple); }
                    receipt["result"] = deleted.Count == 0 ? "retained" : "partial"; throw;
                }
                finally { foreach (var held in leases) held.Dispose(); }
                RemoveEmptyDirectories(Path.Combine(identity.boxRoot, "games"), pending.Select(item => item.Item1));
                receipt["result"] = "completed"; receipt["reason"] = "已删除无引用的当前受管资源；存档、外置数据、历史与未知资料均保留。"; WriteResourceReceipt(identity, audit, receipt);
            }
            catch (Exception cause) when (cause is IOException || cause is UnauthorizedAccessException || cause is InvalidOperationException || cause is ArgumentException || cause is AggregateException)
            {
                if (deleted.Count != 0) { receipt["result"] = "partial"; receipt["reason"] = "资源清理部分完成，未确认成员已保留；请查看精确审计。"; WriteResourceReceipt(identity, audit, receipt); throw new HelperError(10, (string)receipt["reason"]); }
                foreach (var source in sources) source.Dispose(); sources.Clear();
                retained.Clear(); entries.Clear(); deferred.Clear(); RetainedInventory(identity.boxRoot, retained, entries, conservative);
                receipt["result"] = "retained"; receipt["reason"] = conservative; WriteResourceReceipt(identity, audit, receipt); Console.Error.WriteLine(conservative);
            }
            finally
            {
                foreach (var source in sources) source.Dispose();
                if (work != null)
                {
                    try
                    {
                        // SQLite may create only its volatile SHM in this new
                        // private copy directory; original D remains leased.
                        foreach (var path in privateCopies.Select(file => (string)file["path"]).Where(path => path.EndsWith("room.sqlite", StringComparison.Ordinal)).ToArray())
                        {
                            var shm = path + "-shm"; if (!File.Exists(shm) || privateCopies.Any(file => (string)file["path"] == shm)) continue;
                            InstallationCore.Safe(shm); ownCopy(shm, new FileInfo(InstallationCore.IO(shm)).Length, InstallationCore.HashFile(shm));
                        }
                        foreach (var copy in privateCopies)
                        {
                            try
                            {
                                var path = (string)copy["path"]; if (!File.Exists(path)) continue;
                                using (var file = new InstallationLaunch.CleanupLease(path, (long)copy["expectedBytes"], (string)copy["expectedSha256"])) file.Delete();
                                privateDeleted.Add(copy);
                            }
                            catch (IOException) { privateRetained.Add(copy); }
                            catch (UnauthorizedAccessException) { privateRetained.Add(copy); }
                        }
                        RemoveEmptyDirectories(work, privateCopies.Select(file => (string)file["path"]));
                        analysisWork["result"] = Directory.Exists(work) ? "retained" : "completed";
                    }
                    catch (IOException) { analysisWork["result"] = "retained"; }
                    catch (UnauthorizedAccessException) { analysisWork["result"] = "retained"; }
                    analysisWork["reason"] = (string)analysisWork["result"] == "completed" ? "自建只读分析副本已按原句柄与精确 SHA 清理。" : "只读分析副本或未知成员未完全释放，按所记工作目录保留；未修改原存档。";
                    if ((string)analysisWork["result"] == "retained") Console.Error.WriteLine((string)analysisWork["reason"]);
                    WriteResourceReceipt(identity, audit, receipt);
                }
            }
        }
        private static void RemoveEmptyDirectories(string boundary, IEnumerable<string> files)
        {
            var roots = new HashSet<string>(StringComparer.OrdinalIgnoreCase); boundary = InstallationCore.Full(boundary);
            foreach (var file in files) for (var directory = Path.GetDirectoryName(file); directory != null && (InstallationCore.Equal(directory, boundary) || directory.StartsWith(boundary + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)); directory = Path.GetDirectoryName(directory)) roots.Add(directory);
            roots.Add(boundary);
            foreach (var directory in roots.OrderByDescending(path => path.Length)) { InstallationCore.Safe(directory); if (Directory.Exists(directory) && Directory.GetFileSystemEntries(directory).Length == 0) Directory.Delete(directory); }
        }
        private static void Migrate(string root, string source, MigrationLease lease)
        {
            source = InstallationCore.Full(source); InstallationCore.Safe(source);
            var box = InstallationCore.Box(root); if (!InstallationCore.Equal(source, root) && (InstallationCore.Equal(source, box) || source.StartsWith(box + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || box.StartsWith(source + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))) throw new HelperError(10, "便携迁移根与安装目标重叠。");
            if (!InstallationCore.Equal(source, lease.SourceRoot)) throw new HelperError(20, "迁移源与持续租约不匹配。"); var data = lease.SourceDataDirectory; lease.Verify();
            int selfPid; using (var self = Process.GetCurrentProcess()) selfPid = self.Id;
            foreach (var process in Process.GetProcesses()) using (process) { try { var executable = process.MainModule.FileName; if (process.Id == selfPid || InstallationCore.Equal(executable, Get("installer-source"))) continue; if (executable.StartsWith(source + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(20, "原便携程序仍在运行，未迁移。"); } catch (System.ComponentModel.Win32Exception) { } catch (InvalidOperationException) { } }
            if (Directory.Exists(box) && Directory.GetFileSystemEntries(box).Length != 0) throw new HelperError(10, "迁移目标已有内容，未覆盖。"); Directory.CreateDirectory(box);
            foreach (var file in lease.SourceFiles)
            {
                if (!InstallationCore.Equal(data, source) && !file.path.StartsWith("games/", StringComparison.OrdinalIgnoreCase)) continue;
                var path = InstallationCore.Member(source, file.path); var target = InstallationCore.Member(box, file.path);
                if (lease.CopyHeld(path, target)) continue;
                using (var input = new FileStream(InstallationCore.IO(path), FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    if (input.Length != file.bytes || StreamHash(input) != file.sha256) throw new HelperError(30, "原迁移成员已变化，未复制；原件已保留。");
                    Directory.CreateDirectory(Path.GetDirectoryName(target)); input.Position = 0;
                    using (var output = new FileStream(InstallationCore.IO(target), FileMode.CreateNew, FileAccess.Write, FileShare.None)) { input.CopyTo(output); output.Flush(true); }
                    if (InstallationCore.HashFile(target) != file.sha256 || StreamHash(input) != file.sha256) throw new HelperError(30, "便携复制校验失败，原件已保留。");
                }
            }
            lease.Verify();
            TableMax.Portable.LegacyGames.Preserve(source, Path.Combine(box, "games"));
            TableMax.Portable.LegacyGames.Preserve(Path.Combine(source, "app"), Path.Combine(box, "games"));
            InstallationCore.Atomic(Path.Combine(box, "TableMax.config.json"), new { dataDirectory = InstallationCore.Equal(data, source) ? "." : data });
        }
        private static string StreamHash(FileStream stream)
        {
            stream.Position = 0; using (var hash = SHA256.Create()) return BitConverter.ToString(hash.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }
        private static string[] MigrationFiles(string source, string installationRoot)
        {
            var files = new List<string>(); var nestedTarget = InstallationCore.Equal(source, installationRoot);
            var excluded = new HashSet<string>(new[] { "app", "updates", ".installation-transactions", ".install.json", ".installer-receipt.json", ".uninstalled.json", ".uninstall-resources.json", "TableMax.config.json", "TableMax.exe", "UpdateHelper.exe", "Updater.exe" }, StringComparer.OrdinalIgnoreCase);
            Action<string> visit = null; visit = directory =>
            {
                InstallationCore.Safe(directory);
                foreach (var path in Directory.GetFileSystemEntries(directory).OrderBy(value => value, StringComparer.OrdinalIgnoreCase))
                {
                    var relative = path.Substring(source.Length + 1).Replace('\\', '/'); var first = relative.Split('/')[0];
                    if (excluded.Contains(first) || (nestedTarget && String.Equals(first, "data", StringComparison.OrdinalIgnoreCase)) || (Get("installer-source", false) is string installer && InstallationCore.Equal(path, installer))) continue;
                    InstallationCore.Safe(path); if (Directory.Exists(path)) visit(path); else files.Add(InstallationCore.Full(path));
                }
            };
            visit(source); return files.OrderBy(path => path, StringComparer.OrdinalIgnoreCase).ToArray();
        }
        private static void Confirm(InstallationManifest target, string dataDirectory)
        {
            Progress("health");
            var name = "TableMax.Health." + Guid.NewGuid().ToString("N"); var token = new byte[32]; using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(token); var secret = BitConverter.ToString(token).Replace("-", "").ToLowerInvariant();
            var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false); security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.FullControl, AccessControlType.Allow));
            using (var pipe = new NamedPipeServerStream(name, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 16384, 16384, security))
            {
                var start = new ProcessStartInfo(Path.Combine(target.root, "TableMax.exe")) { UseShellExecute = false, WorkingDirectory = target.root };
                start.EnvironmentVariables["TABLEMAX_INSTALLATION_HEALTH_PIPE"] = name; start.EnvironmentVariables["TABLEMAX_INSTALLATION_HEALTH_TOKEN"] = secret;
#if TABLEMAX_INSTALLATION_TEST && TABLEMAX_INSTALLATION_HANDOFF_TEST
                start.Arguments = "--foundation-test --application-handoff-persistent";
                start.CreateNoWindow = true; start.EnvironmentVariables["TABLEMAX_HOST"] = "127.0.0.1"; start.EnvironmentVariables["TABLEMAX_PORT"] = "0";
#else
                var checking = Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_CHECK") == "1";
#if TABLEMAX_INSTALLATION_TEST
                checking = true;
#endif
                if (checking) { start.Arguments = "--foundation-check"; start.CreateNoWindow = true; start.EnvironmentVariables["TABLEMAX_HOST"] = "127.0.0.1"; start.EnvironmentVariables["TABLEMAX_PORT"] = "0"; }
#endif
                var began = DateTime.UtcNow; using (var entry = Process.Start(start))
                {
                    var timeout = 1860000; if (Get("health-timeout", false) is string configured && (!Int32.TryParse(configured, out timeout) || timeout < 1000 || timeout > 1860000)) throw new HelperError(10, "健康确认预算无效。");
                    var waiting = pipe.WaitForConnectionAsync(); var budget = Stopwatch.StartNew();
                    while (!waiting.Wait(500)) { if (entry.HasExited) throw new HelperError(40, "新版原生进程在健康确认前退出。"); if (budget.ElapsedMilliseconds >= timeout) throw new TimeoutException("Installation health timed out."); }
                    using (var input = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                    {
                        var actual = InstallationCore.Object(StrictJson.Parse(ReadLine(input, 16384, 10000))); InstallationCore.Keys(actual, "schemaVersion", "token", "installationId", "root", "boxRoot", "dataDirectory", "buildVersion", "payloadManifestSha256", "currentMappingSha256", "desktopPid", "servicePid", "health");
                        if (InstallationCore.Number(actual, "schemaVersion") != 1 || InstallationCore.Text(actual, "token") != secret || InstallationCore.Text(actual, "installationId") != target.installationId || !InstallationCore.Equal(InstallationCore.Text(actual, "root"), target.root) || !InstallationCore.Equal(InstallationCore.Text(actual, "boxRoot"), target.boxRoot) || !InstallationCore.Equal(InstallationCore.Text(actual, "dataDirectory"), dataDirectory) || InstallationCore.Text(actual, "buildVersion") != target.buildVersion || InstallationCore.Text(actual, "payloadManifestSha256") != target.payloadManifestSha256 || InstallationCore.Text(actual, "currentMappingSha256") != target.currentMappingSha256 || InstallationCore.Text(actual, "health") != "ready") throw new HelperError(40, "新版健康身份不匹配。");
                        foreach (var item in new[] { new { Key = "desktopPid", File = "TableMax.exe" }, new { Key = "servicePid", File = "node.exe" } })
                            using (var process = Process.GetProcessById(InstallationCore.Number(actual, item.Key))) if (!InstallationCore.Equal(process.MainModule.FileName, Path.Combine(target.boxRoot, "app", item.File)) || process.StartTime.ToUniversalTime() < began.AddSeconds(-1)) throw new HelperError(40, "健康确认进程不属于实际新版实例。");
                        target.Verify(target.root);
                        using (var output = new StreamWriter(pipe, InstallationCore.Utf8, 4096, true) { AutoFlush = true }) output.WriteLine("{\"accepted\":true}");
                    }
                }
            }
        }
        private static string ReadLine(StreamReader input, int limit, int timeout)
        {
            var reading = Task.Run(() => { var value = new System.Text.StringBuilder(); while (true) { var c = input.Read(); if (c < 0 || c == '\n') return value.ToString(); if (value.Length >= limit) throw new HelperError(10, "安装消息过长。"); value.Append((char)c); } });
            if (!reading.Wait(timeout)) throw new HelperError(20, "安装消息超时。"); return reading.Result;
        }
    }
}
