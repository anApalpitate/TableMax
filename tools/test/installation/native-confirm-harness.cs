using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using TableMax.Installation;

internal static class NativeConfirmHarness
{
    private static void Require(bool condition, string message) { if (!condition) throw new IOException(message); }
    private static void Confirm(InstallationManifest identity)
    {
        try { typeof(UpdateHelper).GetMethod("Confirm", BindingFlags.Static | BindingFlags.NonPublic).Invoke(null, new object[] { identity, identity.boxRoot }); }
        catch (TargetInvocationException cause) { throw cause.InnerException; }
    }
    public static int Main(string[] args)
    {
        InstallationCore.InitializeRuntime();
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), InstallationCore.Utf8) { AutoFlush = true });
        Console.SetError(new StreamWriter(Console.OpenStandardError(), InstallationCore.Utf8) { AutoFlush = true });
        var location = typeof(NativeConfirmHarness).Assembly.Location;
        if (Path.GetFileName(location) == "TableMax.exe")
        {
            InstallationCore.Atomic(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "actual-start.json"), new { args, host = Environment.GetEnvironmentVariable("TABLEMAX_HOST"), port = Environment.GetEnvironmentVariable("TABLEMAX_PORT"), healthCheck = Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_CHECK"), hasHealthPipe = (Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_PIPE") ?? "").StartsWith("TableMax.Health.", StringComparison.Ordinal), hasPrivateToken = (Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_TOKEN") ?? "").Length == 64 });
            return 42; // Deliberately reports no health, starts no service and records no token.
        }
        var checks = new List<string>(); var starts = new List<object>();
        var previousCheck = Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_CHECK"); var previousHost = Environment.GetEnvironmentVariable("TABLEMAX_HOST"); var previousPort = Environment.GetEnvironmentVariable("TABLEMAX_PORT");
        try
        {
            Require(args.Length == 1 && args[0] == "--run", "Use the private Confirm harness");
            var work = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "fixtures"); Require(!Directory.Exists(work), "Use a fresh private root"); Directory.CreateDirectory(work);
#if TABLEMAX_INSTALLATION_HANDOFF_TEST
            Require(InstallationCore.ProductId == "{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}", "Persistent handoff requires fixture identity");
            var values = new[] { "1" };
#else
            Require(InstallationCore.ProductId == "{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}", "Production Confirm code required");
            var values = new[] { null, "1", "true" };
#endif
            typeof(UpdateHelper).GetField("options", BindingFlags.Static | BindingFlags.NonPublic).SetValue(null, new Dictionary<string, string> { ["health-timeout"] = "1000" });
            foreach (var value in values)
            {
                var root = Path.Combine(work, value ?? "unset"); Directory.CreateDirectory(root); File.Copy(location, Path.Combine(root, "TableMax.exe"));
                Environment.SetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_CHECK", value); Environment.SetEnvironmentVariable("TABLEMAX_HOST", "127.0.0.2"); Environment.SetEnvironmentVariable("TABLEMAX_PORT", "9876");
                var target = new InstallationManifest { root = root, boxRoot = InstallationCore.Box(root) };
                var rejected = false; try { Confirm(target); } catch (IOException cause) { rejected = (int?)cause.GetType().GetProperty("Code")?.GetValue(cause) == 40; }
                Require(rejected, "Controlled target reported health success");
                var observed = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(Path.Combine(root, "actual-start.json"), InstallationCore.Utf8)));
                var actualArgs = ((object[])observed["args"]).Cast<string>().ToArray();
#if TABLEMAX_INSTALLATION_HANDOFF_TEST
                Require(actualArgs.SequenceEqual(new[] { "--foundation-test", "--application-handoff-persistent" }), "Engineering flag overrode persistent fixture handoff");
                Require(InstallationCore.Text(observed, "host") == "127.0.0.1" && InstallationCore.Text(observed, "port") == "0", "Persistent fixture was not loopback isolated");
                var id = "handoff-fixture-persistent-priority-over-check-flag";
#else
                if (value == "1") { Require(actualArgs.SequenceEqual(new[] { "--foundation-check" }), "Production engineering check arguments missing"); Require(InstallationCore.Text(observed, "host") == "127.0.0.1" && InstallationCore.Text(observed, "port") == "0", "Engineering check was not loopback isolated"); }
                else { Require(actualArgs.Length == 0, "Production default was changed to checking startup"); Require(InstallationCore.Text(observed, "host") == "127.0.0.2" && InstallationCore.Text(observed, "port") == "9876", "Normal host environment was changed"); }
                var id = value == "1" ? "production-explicit-check-flag-starts-foundation-check" : value == null ? "production-default-retains-normal-host-startup" : "production-check-flag-requires-exact-one";
#endif
                Require(observed["hasHealthPipe"] is bool pipe && pipe && observed["hasPrivateToken"] is bool token && token, "Private health handshake was removed"); checks.Add(id); starts.Add(new { id, actualArgs, host = observed["host"], port = observed["port"], helperResult = 40 });
            }
            Console.WriteLine(InstallationCore.Encode(new { passed = true, checks, starts, boundary = "Actual production/helper Confirm and Process.Start arguments/environment; controlled entry exits42 without health, service, registration or data. This does not prove successful Native/Node health or isolated-user installer acceptance." })); return 0;
        }
        catch (Exception cause) { Console.WriteLine(InstallationCore.Encode(new { passed = false, checks, starts, error = cause.ToString() })); return 1; }
        finally { Environment.SetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_CHECK", previousCheck); Environment.SetEnvironmentVariable("TABLEMAX_HOST", previousHost); Environment.SetEnvironmentVariable("TABLEMAX_PORT", previousPort); }
    }
}
