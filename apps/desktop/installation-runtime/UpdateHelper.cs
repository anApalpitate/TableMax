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
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeServerProcessId(Microsoft.Win32.SafeHandles.SafePipeHandle pipe, out uint processId);
        private static string Get(string key, bool required = true) => options.TryGetValue(key, out var value) && !String.IsNullOrEmpty(value) ? value : required ? throw new HelperError(10, "安装参数缺少 " + key + "。") : null;
        private static string Quote(string value) { if (value.Contains("\"") || value.EndsWith("\\", StringComparison.Ordinal)) throw new HelperError(10, "安装路径不能安全传递。"); return "\"" + value + "\""; }
        private static string TransactionRoot(string root) => Path.Combine(InstallationCore.Box(root), ".installation-transactions");
        private static readonly string[] DatabaseMembers = { "foundation.sqlite", "foundation.sqlite-wal", "foundation.sqlite-shm", "foundation.sqlite-journal", "room.sqlite", "room.sqlite-wal", "room.sqlite-shm", "room.sqlite-journal", "room.sqlite.migration.json", "room.sqlite.migration.lock" };
        private static string Fingerprint(Func<string, string> hash) => InstallationCore.Hash(InstallationCore.Utf8.GetBytes(String.Join("\n", DatabaseMembers.Select(name => name + ":" + hash(name)))));
        private sealed class MigrationLease : IDisposable
        {
            private sealed class Held { public string Path; public FileStream Stream; public long Bytes; public string Sha256; }
            private readonly Dictionary<string, Held> held = new Dictionary<string, Held>(StringComparer.OrdinalIgnoreCase);
            private readonly List<string> paths = new List<string>();
            private Mutex mutex; private bool acquired, disposed;
            public string SourceRoot { get; }
            public string SourceDataDirectory { get; }
            public string DestinationDataDirectory { get; }
            public MigrationLease(string root, string migration)
            {
                SourceRoot = migration == null ? null : InstallationCore.Full(migration);
                if (SourceRoot != null)
                {
                    InstallationCore.Safe(SourceRoot); var box = InstallationCore.Box(root);
                    if (InstallationCore.Equal(SourceRoot, box) || SourceRoot.StartsWith(box + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || box.StartsWith(SourceRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(10, "便携迁移根与安装目标重叠。");
                    SourceDataDirectory = ReadDataDirectory(SourceRoot, true);
                    DestinationDataDirectory = InstallationCore.Equal(SourceDataDirectory, SourceRoot) ? box : SourceDataDirectory;
                }
                else { SourceDataDirectory = ReadDataDirectory(InstallationCore.Box(root), false); DestinationDataDirectory = SourceDataDirectory; }
                var key = InstallationCore.Hash(InstallationCore.Utf8.GetBytes(SourceDataDirectory.ToUpperInvariant())).Substring(0, 32).ToUpperInvariant();
                mutex = new Mutex(false, "Local\\TableMax-" + key);
                try
                {
                    if (!(acquired = InstallationCore.Acquire(mutex, 0))) throw new HelperError(20, "原数据目录仍被 TableMax 使用；未写入迁移目标。");
                    paths.AddRange(DatabaseMembers.Select(name => Path.Combine(SourceDataDirectory, name)));
                    if (SourceRoot != null) paths.Add(Path.Combine(SourceRoot, "TableMax.config.json"));
                    foreach (var path in paths)
                    {
                        InstallationCore.Safe(path); if (Directory.Exists(path)) throw new HelperError(20, "数据库成员被文件夹占用；原内容已保留。");
                        if (!File.Exists(path)) continue;
                        var stream = new FileStream(InstallationCore.IO(path), FileMode.Open, FileAccess.Read, FileShare.None);
                        var record = new Held { Path = path, Stream = stream }; held.Add(path, record); record.Bytes = stream.Length; record.Sha256 = Hash(stream);
                    }
                    if (SourceRoot != null)
                    {
                        var config = held[Path.Combine(SourceRoot, "TableMax.config.json")]; config.Stream.Position = 0;
                        using (var reader = new StreamReader(config.Stream, InstallationCore.Utf8, false, 4096, true))
                            if (!InstallationCore.Equal(ParseDataDirectory(SourceRoot, reader.ReadToEnd()), SourceDataDirectory)) throw new HelperError(20, "原数据目录配置在租约建立前变化；未迁移。");
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
                foreach (var path in paths)
                {
                    InstallationCore.Safe(path); var exists = File.Exists(path);
                    if (Directory.Exists(path) || exists != held.ContainsKey(path)) throw new HelperError(20, "原数据文件集合已变化，未继续安装；原档已保留。");
                    if (exists) { var record = held[path]; if (record.Stream.Length != record.Bytes || Hash(record.Stream) != record.Sha256) throw new HelperError(20, "原数据文件在租约期间变化，未继续安装。"); }
                }
            }
            public bool CopyHeld(string source, string target)
            {
                if (disposed) throw new HelperError(20, "数据租约已释放，未继续复制。");
                if (!held.TryGetValue(InstallationCore.Full(source), out var record)) return false;
                InstallationCore.Safe(target); Directory.CreateDirectory(Path.GetDirectoryName(target));
                record.Stream.Position = 0;
                using (var output = new FileStream(InstallationCore.IO(target), FileMode.CreateNew, FileAccess.Write, FileShare.None)) { record.Stream.CopyTo(output); output.Flush(true); }
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
            Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), InstallationCore.Utf8) { AutoFlush = true });
            Console.SetError(new StreamWriter(Console.OpenStandardError(), InstallationCore.Utf8) { AutoFlush = true });
            try
            {
                options = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var arg in arguments) { if (!arg.StartsWith("--", StringComparison.Ordinal)) throw new HelperError(10, "安装参数无效。"); var separator = arg.IndexOf('='); var key = separator < 0 ? arg.Substring(2) : arg.Substring(2, separator - 2); if (options.ContainsKey(key)) throw new HelperError(10, "安装参数重复。"); options.Add(key, separator < 0 ? "true" : arg.Substring(separator + 1)); }
                var modes = new[] { "commit", "uninstall", "recover", "inspect-install", "apply-installer", "verify-vectors" }.Where(options.ContainsKey).ToArray();
                if (modes.Length != 1 || options.Keys.Any(key => !new[] { "commit", "uninstall", "recover", "inspect-install", "apply-installer", "verify-vectors", "root", "candidate", "manifest", "target", "installer", "installer-source", "parent-pid", "migration-root", "health-timeout", "vectors" }.Contains(key))) throw new HelperError(10, "安装操作或参数无效。");
                if (modes[0] == "verify-vectors") return VerifyVectors();
                var root = InstallationCore.Root(Get("root"));
                if (modes[0] == "inspect-install") { Console.WriteLine(InstallationCore.Encode(InstallationManifest.Load(root))); return 0; }
                if (modes[0] == "apply-installer") return ApplyInstaller(root);
                using (var operation = InstallationCore.Mutex("Operation", root))
                {
                    if (!InstallationCore.Acquire(operation, 30000)) throw new HelperError(20, "另一安装、更新或卸载正在进行。");
                    try
                    {
                        Recover(root);
                        if (modes[0] == "recover") { Console.WriteLine("{\"status\":\"recovered\"}"); return 0; }
                        if (modes[0] == "uninstall") { Uninstall(root); Console.WriteLine("{\"status\":\"uninstalled-data-retained\"}"); return 0; }
                        Commit(root); Console.WriteLine("{\"status\":\"confirmed\"}"); return 0;
                    }
                    finally { operation.ReleaseMutex(); }
                }
            }
            catch (HelperError cause) { Console.Error.WriteLine(cause.Message); return cause.Code; }
            catch (Exception cause) { Console.Error.WriteLine(cause is IOException || cause is UnauthorizedAccessException ? cause.Message : "安装协调失败；原数据及事务记录已保留。"); return 10; }
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
            var descriptor = Target(Get("target")); var installer = InstallationCore.Full(Get("installer")); InstallationCore.Safe(installer);
            var expected = Path.Combine(identity.boxRoot, "updates", "downloads", descriptor.sha256, descriptor.assetName);
            if (!InstallationCore.Equal(installer, expected) || new FileInfo(InstallationCore.IO(installer)).Length != descriptor.bytes || InstallationCore.HashFile(installer) != descriptor.sha256 || InstallationCore.Version4(descriptor.buildVersion) <= InstallationCore.Version4(identity.buildVersion)) throw new HelperError(10, "更新候选、位置或版本不匹配。");
            if (!Int32.TryParse(Get("parent-pid"), out var pid) || pid < 1) throw new HelperError(10, "更新父进程无效。");
            try
            {
                using (var parent = Process.GetProcessById(pid))
                {
                    if (!InstallationCore.Equal(parent.MainModule.FileName, Path.Combine(identity.boxRoot, "app", "TableMax.exe"))) throw new HelperError(10, "更新父进程不属于此安装。");
                    var name = Environment.GetEnvironmentVariable("TABLEMAX_PARENT_HANDOFF_PIPE"); var token = Environment.GetEnvironmentVariable("TABLEMAX_PARENT_HANDOFF_TOKEN");
                    Environment.SetEnvironmentVariable("TABLEMAX_PARENT_HANDOFF_PIPE", null); Environment.SetEnvironmentVariable("TABLEMAX_PARENT_HANDOFF_TOKEN", null);
                    if (name == null || !name.StartsWith("TableMax.Handoff.", StringComparison.Ordinal) || token == null || token.Length != 64) throw new HelperError(20, "原进程句柄交接未获授权。");
                    using (var pipe = new NamedPipeClientStream(".", name, PipeDirection.InOut)) { pipe.Connect(5000); if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle, out var owner) || owner != (uint)pid) throw new HelperError(20, "原进程交接管道身份不匹配。"); using (var output = new StreamWriter(pipe, InstallationCore.Utf8, 4096, true) { AutoFlush = true }) output.WriteLine(InstallationCore.Encode(new { token, helperPid = Process.GetCurrentProcess().Id })); }
                    if (!parent.WaitForExit(15000) || parent.ExitCode != 0) throw new HelperError(20, "原程序尚未完成正常保存退出；未启动安装器。");
                }
            }
            catch (ArgumentException) { throw new HelperError(20, "原进程已退出但未取得可信关闭结果，未启动安装器。"); }
            var target = InstallationCore.Full(Get("target"));
            var record = Path.Combine(Path.GetDirectoryName(target), "handoff.json"); InstallationCore.Atomic(record, new { schemaVersion = 1, root, buildVersion = descriptor.buildVersion, status = "installer-starting" });
            var start = new ProcessStartInfo(installer, "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR=" + Quote(root) + " /TABLEMAXTARGET=" + Quote(target)) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetDirectoryName(installer) };
            using (var child = Process.Start(start)) { if (child == null || !child.WaitForExit(1860000)) throw new HelperError(40, "安装器未在时间预算内完成；请查看保留事务。"); InstallationCore.Atomic(record, new { schemaVersion = 1, root, buildVersion = descriptor.buildVersion, status = child.ExitCode == 0 ? "installer-finished" : "installer-failed", exitCode = child.ExitCode }); return child.ExitCode == 0 ? 0 : 40; }
        }
        private static bool Stop(string root, bool update)
        {
            using (var run = InstallationCore.Mutex("Run", root))
            {
                if (InstallationCore.Acquire(run, 0)) { run.ReleaseMutex(); return true; }
            }
            var identity = InstallationManifest.Load(root);
            using (var pipe = new NamedPipeClientStream(".", InstallationCore.ControlPipe(root), PipeDirection.InOut, PipeOptions.Asynchronous))
            {
                try { pipe.Connect(3000); } catch (TimeoutException) { throw new HelperError(20, "安装实例正在其他会话运行，或尚未能安全关闭。"); }
                if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle, out var owner)) throw new HelperError(20, "无法取得原生安装实例句柄。");
                using (var desktop = Process.GetProcessById((int)owner))
                {
                if (!InstallationCore.Equal(desktop.MainModule.FileName, Path.Combine(identity.boxRoot, "app", "TableMax.exe"))) throw new HelperError(20, "控制管道不属于此安装实例。");
                using (var writer = new StreamWriter(pipe, InstallationCore.Utf8, 4096, true) { AutoFlush = true })
                using (var reader = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                {
                    writer.WriteLine(InstallationCore.Encode(new { schemaVersion = 1, root, operation = update ? "update" : "uninstall" }));
                    var answer = InstallationCore.Object(StrictJson.Parse(ReadLine(reader, 16384, 10000)));
                    InstallationCore.Keys(answer, "schemaVersion", "installationId", "root", "desktopPid", "confirmed", "running");
                    if (InstallationCore.Number(answer, "schemaVersion") != 1 || InstallationCore.Text(answer, "installationId") != identity.installationId || !InstallationCore.Equal(InstallationCore.Text(answer, "root"), root) || !(answer["confirmed"] is bool confirmed) || !confirmed) throw new HelperError(20, "对局未结束，或保存关闭未获确认；未替换程序。");
                    if (InstallationCore.Number(answer, "desktopPid") != desktop.Id || !desktop.WaitForExit(15000) || desktop.ExitCode != 0) throw new HelperError(20, "原程序或浏览器没有确认正常退出；未替换程序。");
                }
                }
            }
            using (var run = InstallationCore.Mutex("Run", root)) { if (!InstallationCore.Acquire(run, 5000)) throw new HelperError(20, "安装运行锁尚未释放。"); run.ReleaseMutex(); }
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
            CheckUnknownApp(root, previous); Stop(root, true);
            var migration = Get("migration-root", false);
            using (var lease = new MigrationLease(root, migration))
            {
            TableMax.Portable.LegacyGames.Preserve(Path.Combine(InstallationCore.Box(root), "app"), Path.Combine(InstallationCore.Box(root), "games"));
            if (migration != null) Migrate(root, migration, lease);
            Directory.CreateDirectory(InstallationCore.Box(root));
            var activeData = DataDirectory(root); if (!InstallationCore.Equal(activeData, lease.DestinationDataDirectory)) throw new HelperError(20, "数据目录配置在安装准备期间变化；未替换程序。"); InstallationCore.ValidateStartupPaths(root, activeData); lease.Verify();
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
            foreach (var file in next.files) CopyVerified(InstallationCore.Member(candidate, file.path), InstallationCore.Member(Path.Combine(transaction, "next-files"), file.path), file);
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
                        foreach (var file in next.files) ReplaceVerified(InstallationCore.Member(Path.Combine(transaction, "next-files"), file.path), InstallationCore.Member(root, file.path), file, snapshot != null && snapshot.TryGetValue(file.path, out var recorded) ? recorded : null);
                        foreach (var file in (IEnumerable<ManagedFile>)snapshot?.Values ?? Enumerable.Empty<ManagedFile>()) if (!next.files.Any(item => String.Equals(item.path, file.path, StringComparison.OrdinalIgnoreCase))) DeleteVerified(InstallationCore.Member(root, file.path), file);
                        InstallationCore.Atomic(InstallationCore.IdentityPath(root), next); InstallationCore.Atomic(InstallationCore.ReceiptPath(root), newReceipt); State(transaction, "installed", root);
                    }
                    finally { run.ReleaseMutex(); }
                }
                var dataDirectory = DataDirectory(root); var before = lease.Fingerprint(dataDirectory);
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
            CleanupCompleted(transaction, next, previous);
            }
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
            foreach (var file in previous.files)
            {
                var source = InstallationCore.Member(root, file.path);
                if (Directory.Exists(source)) throw new HelperError(10, "旧程序受管文件被未知文件夹占用，已保留。");
                if (!File.Exists(source)) { records.Add(new { path = file.path, missing = true, bytes = 0, sha256 = new string('0', 64) }); continue; }
                var length = new FileInfo(InstallationCore.IO(source)).Length; if (length >= 120000000) throw new HelperError(10, "旧程序异常文件过大，保留原件并停止修复。");
                var actual = new ManagedFile { path = file.path, bytes = (int)length, sha256 = InstallationCore.HashFile(source) };
                CopyVerified(source, InstallationCore.Member(Path.Combine(transaction, "previous-files"), file.path), actual); result.Add(file.path, actual);
                records.Add(new { path = file.path, missing = false, bytes = actual.bytes, sha256 = actual.sha256 });
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
            var identity = InstallationManifest.Load(root); InstallerReceipt.Read(InstallationCore.ReceiptPath(root), identity); CheckUnknownApp(root, identity); Stop(root, false);
            using (var run = InstallationCore.Mutex("Run", root))
            {
                if (!InstallationCore.Acquire(run, 0)) throw new HelperError(20, "卸载实例仍在运行。");
                try
                {
                    var quarantine = Path.Combine(identity.boxRoot, "updates", "uninstall-quarantine-" + Guid.NewGuid().ToString("N"));
                    var actual = new List<ManagedFile>();
                    foreach (var file in identity.files)
                    {
                        var path = InstallationCore.Member(root, file.path); if (!File.Exists(path)) continue;
                        var length = new FileInfo(InstallationCore.IO(path)).Length; if (length >= 120000000) throw new HelperError(10, "异常程序文件过大，已保留并停止卸载。");
                        var observed = new ManagedFile { path = file.path, bytes = (int)length, sha256 = InstallationCore.HashFile(path) };
                        if (observed.bytes != file.bytes || observed.sha256 != file.sha256) CopyVerified(path, InstallationCore.Member(quarantine, file.path), observed);
                        actual.Add(observed);
                    }
                    if (Directory.Exists(quarantine)) InstallationCore.Atomic(Path.Combine(quarantine, "inventory.json"), new { schemaVersion = 1, installationId = identity.installationId, root, files = actual.Where(file => identity.files.Any(original => original.path == file.path && (original.bytes != file.bytes || original.sha256 != file.sha256))).ToArray() });
                    foreach (var file in actual.OrderBy(file => file.path == "UpdateHelper.exe" ? 1 : 0)) DeleteVerified(InstallationCore.Member(root, file.path), file);
                    InstallationCore.Atomic(Path.Combine(identity.boxRoot, ".uninstalled.json"), identity); File.Delete(InstallationCore.IdentityPath(root));
                }
                finally { run.ReleaseMutex(); }
            }
        }
        private static void Migrate(string root, string source, MigrationLease lease)
        {
            source = InstallationCore.Full(source); InstallationCore.Safe(source);
            var box = InstallationCore.Box(root); if (InstallationCore.Equal(source, box) || source.StartsWith(box + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || box.StartsWith(source + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(10, "便携迁移根与安装目标重叠。");
            if (!InstallationCore.Equal(source, lease.SourceRoot)) throw new HelperError(20, "迁移源与持续租约不匹配。"); var data = lease.SourceDataDirectory; lease.Verify();
                    foreach (var process in Process.GetProcesses()) using (process) { try { var executable = process.MainModule.FileName; if (executable.StartsWith(source + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new HelperError(20, "原便携程序仍在运行，未迁移。"); } catch (System.ComponentModel.Win32Exception) { } catch (InvalidOperationException) { } }
                    if (Directory.Exists(box) && Directory.GetFileSystemEntries(box).Length != 0) throw new HelperError(10, "迁移目标已有内容，未覆盖。"); Directory.CreateDirectory(box);
                    Walk(source, path => { var relative = path.Substring(source.Length + 1).Replace('\\', '/'); if (relative == "TableMax.config.json" || relative.StartsWith("app/", StringComparison.Ordinal) || relative.StartsWith("updates/", StringComparison.Ordinal) || relative.StartsWith(".installation-transactions/", StringComparison.Ordinal) || relative == ".install.json") return; if (!InstallationCore.Equal(data, source) && !relative.StartsWith("games/", StringComparison.Ordinal)) return; var target = InstallationCore.Member(box, relative); if (lease.CopyHeld(path, target)) return; Directory.CreateDirectory(Path.GetDirectoryName(target)); File.Copy(path, target, false); if (InstallationCore.HashFile(path) != InstallationCore.HashFile(target)) throw new HelperError(30, "便携复制校验失败，原件已保留。"); });
                    lease.Verify();
                    TableMax.Portable.LegacyGames.Preserve(source, Path.Combine(box, "games"));
                    TableMax.Portable.LegacyGames.Preserve(Path.Combine(source, "app"), Path.Combine(box, "games"));
                    InstallationCore.Atomic(Path.Combine(box, "TableMax.config.json"), new { dataDirectory = InstallationCore.Equal(data, source) ? "." : data });
        }
        private static void Confirm(InstallationManifest target, string dataDirectory)
        {
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
