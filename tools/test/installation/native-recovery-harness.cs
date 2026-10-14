using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Threading;
using TableMax.Installation;

internal static class NativeRecoveryHarness
{
    private static readonly string[] Members = { "foundation.sqlite", "foundation.sqlite-wal", "foundation.sqlite-shm", "foundation.sqlite-journal", "room.sqlite", "room.sqlite-wal", "room.sqlite-shm", "room.sqlite-journal", "room.sqlite.migration.json", "room.sqlite.migration.lock" };
    private static string lastRejection;
    private static void Require(bool condition, string message) { if (!condition) throw new IOException(message); }
    private static object Invoke(string name, params object[] arguments)
    {
        try { return typeof(UpdateHelper).GetMethod(name, BindingFlags.Static | BindingFlags.NonPublic).Invoke(null, arguments); }
        catch (TargetInvocationException cause) { throw cause.InnerException; }
    }
    private static int RejectedRecovery(string root, string mode)
    {
        typeof(UpdateHelper).GetField("options", BindingFlags.Static | BindingFlags.NonPublic).SetValue(null, new Dictionary<string, string> { [mode] = "true", ["health-timeout"] = "1000" });
        try { Invoke("Recover", root); return 0; }
        catch (IOException cause) { lastRejection = cause.ToString(); var property = cause.GetType().GetProperty("Code"); if (property == null) throw; return (int)property.GetValue(cause); }
    }
    private static InstallationManifest InstallFixture(string root)
    {
        Directory.CreateDirectory(root);
        var names = new[] { "TableMax.exe", "UpdateHelper.exe", "TableMax/app/TableMax.exe", "TableMax/app/node.exe", "TableMax/app/server.cjs", "TableMax/app/.tablemax-release.json", "TableMax/app/preinstalled-games/bootstrap.json" };
        foreach (var name in names)
        {
            var path = InstallationCore.Member(root, name); Directory.CreateDirectory(Path.GetDirectoryName(path));
            if (name == "TableMax.exe" || name == "TableMax/app/TableMax.exe") File.Copy(typeof(NativeRecoveryHarness).Assembly.Location, path);
            else File.WriteAllText(path, "Private recovery program fixture " + name, InstallationCore.Utf8);
        }
        var identity = new InstallationManifest { schemaVersion = 1, productId = InstallationCore.ProductId, arch = "x64", installProtocol = 1, releaseVersion = "1.0.6", buildVersion = "1.0.6.60001", installationId = Guid.NewGuid().ToString("D"), root = root, boxRoot = InstallationCore.Box(root), ownerSid = WindowsIdentity.GetCurrent().User.Value, payloadManifestSha256 = InstallationCore.HashFile(InstallationCore.Member(root, "TableMax/app/.tablemax-release.json")), currentMappingSha256 = InstallationCore.HashFile(InstallationCore.Member(root, "TableMax/app/preinstalled-games/bootstrap.json")), files = names.Select(name => { var path = InstallationCore.Member(root, name); return new ManagedFile { path = name, bytes = (int)new FileInfo(path).Length, sha256 = InstallationCore.HashFile(path) }; }).ToArray() };
        InstallationCore.Atomic(InstallationCore.IdentityPath(root), identity); identity.Verify(root); return identity;
    }
    private static string Journal(InstallationManifest identity, string phase, string fingerprint = null)
    {
        var path = Path.Combine(identity.boxRoot, ".installation-transactions", Guid.NewGuid().ToString("D")); Directory.CreateDirectory(path);
        InstallationCore.Atomic(Path.Combine(path, "target.json"), identity);
        InstallationCore.Atomic(Path.Combine(path, "state.json"), new { schemaVersion = 1, root = identity.root, phase, dataDirectory = phase == "health-failed" ? identity.boxRoot : null, databaseFingerprint = fingerprint });
        return path;
    }
    private static Dictionary<string, string> Snapshot(string root) => Directory.GetFiles(root, "*", SearchOption.AllDirectories).ToDictionary(path => path, InstallationCore.HashFile, StringComparer.OrdinalIgnoreCase);
    private static void Unchanged(Dictionary<string, string> before, string root)
    {
        var after = Snapshot(root); Require(before.Count == after.Count && before.All(item => after.TryGetValue(item.Key, out var sha) && sha == item.Value), "Recovery changed a protected fixture or pending journal");
    }
    private static void ChangedDatabaseCase(string work, string member, List<string> checks)
    {
        var root = Path.Combine(work, member.Replace('.', '-') + " I"); var identity = InstallFixture(root);
        foreach (var name in new[] { "foundation.sqlite", "room.sqlite" }) File.WriteAllText(Path.Combine(identity.boxRoot, name), "Original raw stream " + name, InstallationCore.Utf8);
        var before = (string)Invoke("DatabaseFingerprint", identity.boxRoot); var expected = InstallationCore.Hash(InstallationCore.Utf8.GetBytes(String.Join("\n", Members.Select(name => name + ":" + (File.Exists(Path.Combine(identity.boxRoot, name)) ? InstallationCore.HashFile(Path.Combine(identity.boxRoot, name)) : "missing")))));
        Require(before == expected, "On-disk fingerprint omitted a protected member");
        var journal = Journal(identity, "health-failed", before);
        File.WriteAllText(Path.Combine(identity.boxRoot, member), "Changed owned fixture " + member, InstallationCore.Utf8);
        Require((string)Invoke("DatabaseFingerprint", identity.boxRoot) != before, "Database-only change did not affect fingerprint"); var snapshots = Snapshot(root);
        Require(RejectedRecovery(root, "recover") == 40, "Changed database did not fail closed on same-target health");
        Unchanged(snapshots, root); Require(File.Exists(Path.Combine(journal, "state.json")), "Pending transaction was removed"); checks.Add(member == "foundation.sqlite" ? "foundation-only-change-keeps-target-and-data" : "room-journal-only-change-keeps-target-and-data");
    }
    private static int PlayingPeer(string root, string evidence)
    {
        var expectedBase = InstallationCore.Full(Path.GetDirectoryName(Path.GetDirectoryName(Path.GetDirectoryName(typeof(NativeRecoveryHarness).Assembly.Location))));
        Require(InstallationCore.Equal(root, expectedBase), "Playing peer root is not its private installation");
        var identity = InstallationManifest.Load(root);
        using (var run = InstallationCore.Mutex("Run", root))
        {
            Require(InstallationCore.Acquire(run, 0), "Private running peer lock unavailable");
            try
            {
                var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false); security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.FullControl, AccessControlType.Allow));
                using (var pipe = new NamedPipeServerStream(InstallationCore.ControlPipe(root), PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 16384, 16384, security))
                {
                    File.WriteAllText(evidence + ".ready", InstallationCore.Encode(new { root, image = Process.GetCurrentProcess().MainModule.FileName, pipe = InstallationCore.ControlPipe(root), pid = Process.GetCurrentProcess().Id }), InstallationCore.Utf8);
                    Require(pipe.WaitForConnectionAsync().Wait(10000), "Private playing peer was not contacted");
                    using (var input = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                    using (var output = new StreamWriter(pipe, InstallationCore.Utf8, 4096, true) { AutoFlush = true })
                    {
                        var request = InstallationCore.Object(StrictJson.Parse(input.ReadLine())); InstallationCore.Keys(request, "schemaVersion", "root", "operation");
                        Require(InstallationCore.Equal(InstallationCore.Text(request, "root"), root), "Control request root mismatch");
                        File.WriteAllText(evidence, InstallationCore.Text(request, "operation"), InstallationCore.Utf8);
                        output.WriteLine(InstallationCore.Encode(new { schemaVersion = 1, installationId = identity.installationId, root, desktopPid = Process.GetCurrentProcess().Id, confirmed = false, running = true }));
                    }
                }
                var budget = Stopwatch.StartNew(); while (!File.Exists(evidence + ".quit") && budget.ElapsedMilliseconds < 10000) Thread.Sleep(20);
                Require(File.Exists(evidence + ".quit"), "Private playing peer was not released"); return 0;
            }
            finally { run.ReleaseMutex(); }
        }
    }
    private static void PlayingCase(string work, string mode, List<string> checks)
    {
        var root = Path.Combine(work, mode + " playing I"); var identity = InstallFixture(root); var journal = Journal(identity, "prepared"); var snapshots = Snapshot(root);
        var evidence = Path.Combine(work, mode + "-control");
        using (var child = Process.Start(new ProcessStartInfo(Path.Combine(identity.boxRoot, "app", "TableMax.exe"), "--playing-peer \"" + root + "\" \"" + evidence + "\"") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true }))
        {
            // Drain while the peer runs: an unhandled runtime diagnostic must
            // not fill a redirected pipe and leave an exited server appearing live.
            var stdout = child.StandardOutput.ReadToEndAsync(); var stderr = child.StandardError.ReadToEndAsync();
            try
            {
                var budget = Stopwatch.StartNew(); while (!File.Exists(evidence + ".ready") && !child.HasExited && budget.ElapsedMilliseconds < 5000) Thread.Sleep(20);
                Require(File.Exists(evidence + ".ready") && !child.HasExited, "Private playing peer did not become ready");
                Require(RejectedRecovery(root, mode) == 20, "Pending recovery ignored refused update shutdown");
                Require(File.Exists(evidence), "Control request was not received: " + lastRejection + "; peer " + File.ReadAllText(evidence + ".ready", InstallationCore.Utf8));
                Require(File.ReadAllText(evidence, InstallationCore.Utf8) == "update", "Pending recovery used uninstall semantics during " + mode);
                Require(!child.HasExited, "Refused update terminated running peer"); Unchanged(snapshots, root);
                Require(InstallationCore.Text(InstallationCore.Object(StrictJson.Parse(File.ReadAllText(Path.Combine(journal, "state.json"), InstallationCore.Utf8))), "phase") == "prepared", "Pending journal progressed after playing rejection");
                checks.Add("pending-journal-" + mode + "-uses-update-refusal-and-preserves-files");
            }
            finally
            {
                File.WriteAllText(evidence + ".quit", "owned peer release", InstallationCore.Utf8);
                if (!child.WaitForExit(5000)) { child.Kill(); child.WaitForExit(1000); }
                if (stdout.Wait(1000) && stderr.Wait(1000)) File.WriteAllText(evidence + ".peer-log", stdout.Result + stderr.Result, InstallationCore.Utf8);
            }
            Require(child.ExitCode == 0, "Private peer failed: " + (stderr.IsCompleted ? stderr.Result : "missing bounded peer diagnostic"));
        }
    }
    public static int Main(string[] args)
    {
        InstallationCore.InitializeRuntime();
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), InstallationCore.Utf8) { AutoFlush = true });
        Console.SetError(new StreamWriter(Console.OpenStandardError(), InstallationCore.Utf8) { AutoFlush = true });
        if (args.Length == 0) return 42; // An exact owned health target fails before reporting ready.
        var checks = new List<string>();
        try
        {
            if (args.Length == 3 && args[0] == "--playing-peer") return PlayingPeer(InstallationCore.Root(args[1]), InstallationCore.Full(args[2]));
            Require(args.Length == 1 && (args[0] == "--run" || args[0] == "--playing-only"), "Use only the private managed harness"); var work = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "fixtures"); Require(!Directory.Exists(work), "Use a fresh fixture root"); Directory.CreateDirectory(work);
            if (args[0] == "--run") { ChangedDatabaseCase(work, "foundation.sqlite", checks); ChangedDatabaseCase(work, "room.sqlite-journal", checks); }
            PlayingCase(work, "commit", checks); PlayingCase(work, "recover", checks);
            Console.WriteLine(InstallationCore.Encode(new { passed = true, checks, boundary = "Actual production Recover/Stop methods, Windows run mutex, current-user pipe and OS peer identity; raw DB files and a controlled playing-refusal peer, not an actual game or database schema migration; no formal data/registry" })); return 0;
        }
        catch (Exception cause) { Console.WriteLine(InstallationCore.Encode(new { passed = false, checks, error = cause.ToString() })); return 1; }
    }
}
