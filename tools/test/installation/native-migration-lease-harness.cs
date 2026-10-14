using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using TableMax.Installation;

internal static class NativeMigrationLeaseHarness
{
    private static readonly string[] Names = { "foundation.sqlite", "foundation.sqlite-wal", "foundation.sqlite-shm", "foundation.sqlite-journal", "room.sqlite", "room.sqlite-wal", "room.sqlite-shm", "room.sqlite-journal", "room.sqlite.migration.json", "room.sqlite.migration.lock" };
    private static void Require(bool value, string message) { if (!value) throw new IOException(message); }
    private static object Call(object lease, string method, params object[] parameters)
    {
        try { return lease.GetType().GetMethod(method).Invoke(lease, parameters); }
        catch (TargetInvocationException cause) { throw cause.InnerException; }
    }
    private static object Lease(string root, string source)
    {
        try { return Activator.CreateInstance(typeof(UpdateHelper).GetNestedType("MigrationLease", BindingFlags.NonPublic), new object[] { root, source }); }
        catch (TargetInvocationException cause) { throw cause.InnerException; }
    }
    private static void Peer(string path, bool denied)
    {
        using (var child = Process.Start(new ProcessStartInfo(typeof(NativeMigrationLeaseHarness).Assembly.Location, "--peer \"" + path + "\" " + (denied ? "denied" : "allowed")) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true }))
        {
            if (!child.WaitForExit(5000)) { child.Kill(); throw new IOException("Private file peer timed out"); }
            Require(child.ExitCode == 0, "Cross-process file lease differed: " + child.StandardError.ReadToEnd());
        }
    }
    public static int Main(string[] args)
    {
        InstallationCore.InitializeRuntime();
        var work = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "fixtures");
        if (args.Length == 3 && args[0] == "--peer")
        {
            var path = InstallationCore.Full(args[1]);
            if (!path.StartsWith(InstallationCore.Full(work) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return 2;
            try { using (var stream = new FileStream(InstallationCore.IO(path), FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) { stream.ReadByte(); } return args[2] == "allowed" ? 0 : 1; }
            catch (IOException cause) { return args[2] == "denied" && (cause.HResult & 65535) == 32 ? 0 : 1; }
        }
        var checks = new List<string>(); object lease = null;
        try
        {
            Require(!Directory.Exists(work), "Use a fresh private fixture directory"); Directory.CreateDirectory(work);
            var source = Path.Combine(work, "原便携 TableMax"); var root = Path.Combine(work, "新安装 I"); Directory.CreateDirectory(source); Directory.CreateDirectory(root);
            File.WriteAllText(Path.Combine(source, "TableMax.config.json"), "{\"dataDirectory\":\".\"}", InstallationCore.Utf8);
            var originals = new Dictionary<string, string>();
            foreach (var name in Names) { var path = Path.Combine(source, name); File.WriteAllText(path, "Raw held-stream fixture: " + name, InstallationCore.Utf8); originals[name] = InstallationCore.HashFile(path); }
            lease = Lease(root, source); Require(!Directory.Exists(InstallationCore.Box(root)), "Lease mutated new B");
            foreach (var name in Names) Peer(Path.Combine(source, name), true);
            checks.Add("whole-group-denies-other-process-through-copy");
            foreach (var name in Names) { var target = Path.Combine(InstallationCore.Box(root), name); Require((bool)Call(lease, "CopyHeld", Path.Combine(source, name), target), "Protected source reopened outside held stream"); Require(InstallationCore.HashFile(target) == originals[name], "Held copy bytes differed"); }
            Call(lease, "Verify"); foreach (var name in Names) Peer(Path.Combine(source, name), true);
            checks.Add("same-held-stream-copy-sha-and-continued-denial");
            var expectedFingerprint = InstallationCore.Hash(InstallationCore.Utf8.GetBytes(String.Join("\n", Names.Select(name => name + ":" + originals[name]))));
            Require((string)Call(lease, "Fingerprint", source) == expectedFingerprint, "Held fingerprint did not bind all protected database members"); checks.Add("all-ten-member-fingerprint-without-reopening-locked-source");
            var missingSource = Path.Combine(work, "缺少成员原 B"); Directory.CreateDirectory(missingSource); File.WriteAllText(Path.Combine(missingSource, "TableMax.config.json"), "{\"dataDirectory\":\".\"}", InstallationCore.Utf8);
            var missingLease = Lease(Path.Combine(work, "缺少成员目标 I"), missingSource);
            var appeared = Path.Combine(missingSource, "room.sqlite-journal"); File.WriteAllText(appeared, "This probe owns newly appeared member", InstallationCore.Utf8);
            bool rejected = false; try { Call(missingLease, "Verify"); } catch (IOException) { rejected = true; } finally { ((IDisposable)missingLease).Dispose(); } Require(rejected, "Missing member appearance was accepted");
            Require(InstallationCore.HashFile(appeared) == InstallationCore.Hash(InstallationCore.Utf8.GetBytes("This probe owns newly appeared member")), "Owned probe member changed"); checks.Add("missing-member-appearance-fails-closed");
            ((IDisposable)lease).Dispose(); lease = null;
            foreach (var name in Names) { Peer(Path.Combine(source, name), false); Require(InstallationCore.HashFile(Path.Combine(source, name)) == originals[name], "Original bytes changed"); }
            checks.Add("release-reopens-and-preserves-original-byte-group");
            var external = Path.Combine(work, "外置 D"); Directory.CreateDirectory(external); foreach (var name in Names) File.WriteAllText(Path.Combine(external, name), "External original " + name, InstallationCore.Utf8);
            var externalRoot = Path.Combine(work, "外置配置 B"); Directory.CreateDirectory(externalRoot); File.WriteAllText(Path.Combine(externalRoot, "TableMax.config.json"), InstallationCore.Encode(new { dataDirectory = external }), InstallationCore.Utf8);
            lease = Lease(Path.Combine(work, "外置目标 I"), externalRoot); Require(InstallationCore.Equal((string)lease.GetType().GetProperty("DestinationDataDirectory").GetValue(lease), external), "External D was remapped"); Peer(Path.Combine(external, "foundation.sqlite"), true); ((IDisposable)lease).Dispose(); lease = null;
            var empty = Path.Combine(work, "无保存原 B"); Directory.CreateDirectory(empty); File.WriteAllText(Path.Combine(empty, "TableMax.config.json"), "{\"dataDirectory\":\".\"}", InstallationCore.Utf8); lease = Lease(Path.Combine(work, "无保存目标 I"), empty);
            var missing = Path.Combine(empty, "room.sqlite"); File.WriteAllText(missing, "Probe owns new save", InstallationCore.Utf8); rejected = false; try { Call(lease, "Verify"); } catch (IOException) { rejected = true; } Require(rejected, "New save appearance was accepted");
            checks.Add("external-d-kept-and-empty-save-set-monitored");
            Console.WriteLine(InstallationCore.Encode(new { passed = true, checks, boundary = "Actual production MigrationLease and cross-process Windows sharing; raw stream fixtures only, not SQLite schema/health validation; no production data or registry" })); return 0;
        }
        catch (Exception cause) { Console.WriteLine(InstallationCore.Encode(new { passed = false, checks, error = cause.ToString() })); return 1; }
        finally { ((IDisposable)lease)?.Dispose(); }
    }
}
