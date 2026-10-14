using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Microsoft.Win32;
using TableMax.Installation;

internal static class NativeLongPathHarness
{
    private static void Require(bool condition, string message) { if (!condition) throw new IOException(message); }
    private static void Invoke(string name, params object[] values)
    {
        try { typeof(UpdateHelper).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, values); }
        catch (TargetInvocationException cause) { throw cause.InnerException; }
    }
    private static ManagedFile Record(string path) => new ManagedFile { path = Path.GetFileName(path), bytes = (int)new FileInfo(InstallationCore.IO(path)).Length, sha256 = InstallationCore.HashFile(path) };
    public static int Main(string[] arguments)
    {
        InstallationCore.InitializeRuntime();
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), InstallationCore.Utf8) { AutoFlush = true });
        Console.SetError(new StreamWriter(Console.OpenStandardError(), InstallationCore.Utf8) { AutoFlush = true });
        var checks = new List<string>();
        try
        {
            Require(arguments.Length == 1, "Expected one private fixture root");
            var root = InstallationCore.Root(arguments[0]);
            var policyBefore = Registry.GetValue(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem", "LongPathsEnabled", null);
            var nested = String.Join("/", Enumerable.Range(0, 7).Select(index => "中文目录" + index + new string('a', 36)));
            var source = InstallationCore.Member(root, "source/" + nested + "/" + new string('b', 64) + ".zip");
            var target = InstallationCore.Member(root, "target/" + nested + "/" + new string('c', 64) + ".zip");
            var copied = InstallationCore.Member(root, "copied/" + nested + "/" + new string('d', 64) + ".zip");
            var json = InstallationCore.Member(root, "state/" + nested + "/state.json");
            Require(new[] { source, target, copied, json }.All(path => path.Length > 260), "Fixture did not exceed MAX_PATH");
            InstallationDirectory.CreateDirectory(Path.GetDirectoryName(source));
            InstallationDirectory.CreateDirectory(Path.GetDirectoryName(target));
            File.WriteAllText(InstallationCore.IO(source), "verified new payload", InstallationCore.Utf8);
            File.WriteAllText(InstallationCore.IO(target), "verified original payload", InstallationCore.Utf8);
            var prior = Record(target); var next = Record(source);
            var unknown = Path.Combine(Path.GetDirectoryName(target), ".tm-unknown-original.tmp");
            File.WriteAllText(InstallationCore.IO(unknown), "unrelated original", InstallationCore.Utf8);
            var unknownHash = InstallationCore.HashFile(unknown);
            Invoke("CopyVerified", source, copied, next);
            Require(InstallationCore.HashFile(copied) == next.sha256, "Long-path copy differed"); checks.Add("actual-copy-and-sha-over-260");
            Invoke("ReplaceVerified", source, target, next, prior, false);
            Require(InstallationCore.HashFile(target) == next.sha256, "Long-path atomic replace differed"); checks.Add("actual-flushed-replace-over-260");
            var bad = new ManagedFile { path = next.path, bytes = next.bytes, sha256 = new string('0', 64) };
            bool rejected = false;
            try { Invoke("ReplaceVerified", source, target, bad, next, false); } catch (IOException) { rejected = true; }
            Require(rejected && InstallationCore.HashFile(target) == next.sha256, "Failed SHA replaced original target");
            Require(Directory.GetFiles(InstallationCore.IO(Path.GetDirectoryName(target)), ".tm-*.tmp").Select(InstallationCore.Full).SequenceEqual(new[] { unknown }), "Own temporary leaked or unknown temporary changed");
            Require(InstallationCore.HashFile(unknown) == unknownHash, "Unknown temporary was changed"); checks.Add("failed-sha-cleans-only-created-temp");
            InstallationCore.Atomic(json, new { schemaVersion = 1, phase = "prepared" });
            InstallationCore.Atomic(json, new { schemaVersion = 1, phase = "completed" });
            Require(InstallationCore.Text(InstallationCore.Object(StrictJson.Parse(InstallationFile.ReadAllText(json, InstallationCore.Utf8))), "phase") == "completed", "Long-path state differed");
            checks.Add("actual-atomic-state-over-260");
            foreach (var alias in new[] { @"\\?\C:\Windows\TableMax", @"\\.\C:\Windows\TableMax", @"\??\C:\Windows\TableMax", @"\\localhost\c$\Windows\TableMax" })
            {
                rejected = false; try { InstallationCore.Root(alias); } catch (IOException) { rejected = true; }
                Require(rejected, "Installation alias was accepted");
            }
            rejected = false; try { InstallationCore.Root(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "TableMax")); } catch (IOException) { rejected = true; }
            Require(rejected, "Protected installation root was accepted"); checks.Add("device-unc-and-protected-roots-rejected");
            Require(Directory.GetFiles(InstallationCore.IO(root), "*", SearchOption.AllDirectories).Select(InstallationCore.Full).Contains(copied), "Long-path enumeration omitted actual file");
            Invoke("DeleteVerified", copied, next);
            Require(!InstallationFile.Exists(copied) && InstallationCore.HashFile(unknown) == unknownHash, "Precise deletion failed"); checks.Add("actual-enumerate-and-exact-delete-over-260");
            rejected = false; try { InstallationCore.ValidateStartupPaths(Path.GetDirectoryName(target), null); } catch (IOException) { rejected = true; }
            Require(rejected, "Known overlong native startup path was accepted");
            rejected = false; try { InstallationCore.ValidateStartupPaths(root, Path.GetDirectoryName(target)); } catch (IOException) { rejected = true; }
            Require(rejected, "Known overlong browser profile was accepted"); checks.Add("known-overlong-runtime-paths-preflight-rejected");
            var policyAfter = Registry.GetValue(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem", "LongPathsEnabled", null);
            Require(Object.Equals(policyBefore, policyAfter), "Windows long-path policy changed");
            AppContext.TryGetSwitch("Switch.System.IO.UseLegacyPathHandling", out var legacy);
            AppContext.TryGetSwitch("Switch.System.IO.BlockLongPaths", out var block);
            Require(!legacy && !block, "Per-process switches not enabled");
            Console.WriteLine(InstallationCore.Encode(new { passed = true, checks, sourceLength = source.Length, targetLength = target.Length, stateLength = json.Length, temporaryLeafLength = Path.GetFileName(InstallationCore.TemporaryPath(target)).Length, policyBefore, policyAfter, legacy, block, boundary = "Actual Framework 4.8 filesystem and production helper methods; no app config or longPathAware manifest; only private tmp files; policy read-only" })); return 0;
        }
        catch (Exception cause) { Console.WriteLine(InstallationCore.Encode(new { passed = false, checks, failure = cause.ToString() })); return 1; }
    }
}
