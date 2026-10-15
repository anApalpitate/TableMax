using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using TableMax.Installation;

// Component entry only. Calls the production migration implementation without
// Commit/Confirm, Native, an installer, accounts or Windows registration.
internal static class ResourceCleanupHarness
{
    private static int Main(string[] arguments)
    {
        InstallationCore.InitializeRuntime();
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), InstallationCore.Utf8) { AutoFlush = true });
        Console.SetError(new StreamWriter(Console.OpenStandardError(), InstallationCore.Utf8) { AutoFlush = true });
        try
        {
            if (arguments.Length != 1 || !arguments[0].StartsWith("--plan=", StringComparison.Ordinal)) throw new IOException("Use the private component plan.");
            var input = InstallationCore.Object(StrictJson.Parse(System.IO.File.ReadAllText(arguments[0].Substring(7), InstallationCore.Utf8)));
            InstallationCore.Keys(input, "schemaVersion", "root", "nonce", "installerSource");
            if (InstallationCore.Number(input, "schemaVersion") != 1) throw new IOException("Invalid component plan.");
            var root = InstallationCore.Root(InstallationCore.Text(input, "root"));
            var marker = InstallationCore.Member(root, ".resource-cleanup-fixture.json");
            var identity = InstallationCore.Object(StrictJson.Parse(System.IO.File.ReadAllText(marker, InstallationCore.Utf8)));
            InstallationCore.Keys(identity, "nonce", "kind");
            if (InstallationCore.Text(identity, "nonce") != InstallationCore.Text(input, "nonce") || InstallationCore.Text(identity, "kind") != "synthetic-resource-cleanup-component") throw new IOException("Private component ownership mismatch.");
            var options = new Dictionary<string, string>(StringComparer.Ordinal) { ["installer-source"] = InstallationCore.Text(input, "installerSource") };
            typeof(UpdateHelper).GetField("options", BindingFlags.Static | BindingFlags.NonPublic).SetValue(null, options);
            var leaseType = typeof(UpdateHelper).GetNestedType("MigrationLease", BindingFlags.NonPublic);
            var migrate = typeof(UpdateHelper).GetMethod("Migrate", BindingFlags.Static | BindingFlags.NonPublic);
            using (var lease = (IDisposable)Activator.CreateInstance(leaseType, new object[] { root, root })) migrate.Invoke(null, new object[] { root, root, lease });
            Console.WriteLine(InstallationCore.Encode(new { schemaVersion = 1, result = "migrated", root, boxRoot = InstallationCore.Box(root), method = "actual-MigrationLease-and-Migrate-no-Commit-or-health" }));
            return 0;
        }
        catch (Exception cause)
        {
            while (cause is TargetInvocationException && cause.InnerException != null) cause = cause.InnerException;
            var code = cause.GetType().GetProperty("Code", BindingFlags.Public | BindingFlags.Instance)?.GetValue(cause);
            Console.WriteLine(InstallationCore.Encode(new { schemaVersion = 1, result = "rejected", helperCode = code, exceptionType = cause.GetType().FullName, message = cause.Message }));
            return code is int number && number == 10 ? 0 : 1;
        }
    }
}
