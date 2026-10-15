using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using TableMax.Desktop;
using TableMax.Installation;

namespace TableMax.InstallationTesting
{
    // Compiled only into two isolated fixture Native executables. The production
    // Program/bridge are unmodified; only update HTTP transport is replaced.
    internal static class ApplicationHandoffFixture
    {
        private const string FixtureId = "{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}";
        private static Dictionary<string, object> plan;
        private static readonly BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
        private static bool attached, finishing;
        private static DesktopContext context;
        private static bool persistent;
        private static string evidence, role;
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetStdHandle(int kind, IntPtr handle);

        [STAThread]
        private static int Main(string[] arguments)
        {
            InstallationCore.InitializeRuntime();
            if (!String.Equals(InstallationCore.ProductId, FixtureId, StringComparison.Ordinal)) throw new IOException("Handoff entry requires the fixture product.");
            var checking = arguments.Contains("--foundation-check");
            persistent = arguments.Contains("--application-handoff-persistent");
            var programArguments = arguments.Where(value => value != "--application-handoff-persistent").ToArray();
            var entry = typeof(TableMax.Desktop.Program).GetMethod("Main", BindingFlags.NonPublic | BindingFlags.Static);
            if (entry == null) throw new IOException("Actual Native entry is unavailable.");
            var failureRequest = Environment.GetEnvironmentVariable("TABLEMAX_HANDOFF_FRAMEWORK_FAILURE");
            if (checking && failureRequest == null) return (int)entry.Invoke(null, new object[] { programArguments });
            if (!checking && !programArguments.Contains("--foundation-test")) throw new IOException("Fixture entry requires hidden test mode.");
            var pathname = Environment.GetEnvironmentVariable("TABLEMAX_HANDOFF_TEST_PLAN");
            if (String.IsNullOrEmpty(pathname)) throw new IOException("Missing isolated handoff plan.");
            InstallationCore.Safe(pathname);
            plan = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(pathname, InstallationCore.Utf8)));
            InstallationCore.Keys(plan, "schemaVersion", "scopeRoot", "root", "evidence", "newInstaller", "newBytes", "newSha256", "apiJson");
            if (InstallationCore.Number(plan, "schemaVersion") != 1) throw new IOException("Fixture plan version invalid.");
            var root = InstallationCore.Root(InstallationCore.Text(plan, "root"));
            var identity = InstallationManifest.Load(root);
            if (!InstallationCore.Equal(AppDomain.CurrentDomain.BaseDirectory, Path.Combine(identity.boxRoot, "app"))) throw new IOException("Fixture process is outside its actual installed Native root.");
            evidence = InstallationCore.Full(InstallationCore.Text(plan, "evidence")); InstallationCore.Safe(evidence);
            if (!Directory.Exists(evidence)) throw new IOException("Fixture evidence directory must already exist.");
            if (failureRequest != null) return FailFrameworkHealth(identity, root, failureRequest);
            role = persistent ? "new" : "old";
            using (var input = persistent ? new AnonymousPipeServerStream(PipeDirection.Out, HandleInheritability.None) : null)
            using (var timer = new System.Windows.Forms.Timer { Interval = 100 })
            {
                if (input != null && !SetStdHandle(-10, new IntPtr(Int64.Parse(input.GetClientHandleAsString())))) throw new IOException("Fixture input could not be held.");
                timer.Tick += async (_, __) => await Tick();
                EventHandler startTimer = null;
                startTimer = (_, __) => { Application.Idle -= startTimer; timer.Start(); };
                Application.Idle += startTimer;
                try { return (int)entry.Invoke(null, new object[] { programArguments }); }
                catch (TargetInvocationException cause) { throw cause.InnerException ?? cause; }
                finally { Application.Idle -= startTimer; timer.Stop(); }
            }
        }

        private static int FailFrameworkHealth(InstallationManifest identity, string root, string request)
        {
            // This test Main is linked only into explicitly compiled fixture Native PEs.
            // Production Program/bridges do not read this request or contain this writer.
            var version = typeof(DesktopContext).Assembly.GetName().Version;
            if (request != "foundation-write-and-fail-v1" || identity.productId != FixtureId || version.Revision != 60001 || identity.buildVersion != version.ToString(4)) throw new IOException("Framework failure request is outside the new fixture identity.");
            var repository = typeof(DesktopContext).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().Single(value => value.Key == "TableMaxRepositoryRoot").Value;
            var scope = InstallationCore.Full(InstallationCore.Text(plan, "scopeRoot")); InstallationCore.Safe(scope); InstallationCore.Safe(root);
            using (var user = System.Security.Principal.WindowsIdentity.GetCurrent())
            {
                if (identity.ownerSid != user.User.Value) throw new IOException("Framework failure identity does not belong to this Windows user.");
                var workspace = InstallationCore.Full(Path.Combine(repository, "tmp"));
                if (InstallationCore.Equal(scope, workspace))
                {
                    if (!root.StartsWith(workspace + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("Framework failure root is outside workspace tmp.");
                }
                else
                {
                    var account = user.Name.Split('\\').Last();
                    if (!System.Text.RegularExpressions.Regex.IsMatch(account, "^TMVerify_[0-9a-fA-F]{8}$") || new System.Security.Principal.WindowsPrincipal(user).IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator)) throw new IOException("Profile framework failure requires the isolated standard account.");
                    var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                    var parent = InstallationCore.Full(Path.Combine(local, "TableMaxAcceptance")); InstallationCore.Safe(parent);
                    if (String.IsNullOrEmpty(local) || !InstallationCore.Equal(Path.GetDirectoryName(scope), parent) || !System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(scope), "^[0-9a-fA-F]{32}$")) throw new IOException("Framework failure scope is not this user's actual application-data acceptance root.");
                    var work = InstallationCore.Full(Path.Combine(scope, "work")); InstallationCore.Safe(work);
                    if (!root.StartsWith(work + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("Framework failure root is outside the isolated profile work directory.");
                }
            }
            identity.Verify(root);
            var receipt = InstallerReceipt.Read(InstallationCore.ReceiptPath(root), identity);
            if (receipt.bytes != InstallationCore.Number(plan, "newBytes") || receipt.sha256 != InstallationCore.Text(plan, "newSha256")) throw new IOException("Framework failure request did not match the actual new installer receipt.");
            var config = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(Path.Combine(identity.boxRoot, "TableMax.config.json"), InstallationCore.Utf8)));
            if (!config.TryGetValue("dataDirectory", out var directory) || !(directory is string relative) || relative != ".") throw new IOException("Framework failure injection requires this fixture's default isolated data directory.");
            var database = InstallationCore.Member(identity.boxRoot, "foundation.sqlite");
            if (!File.Exists(database)) throw new IOException("Old fixture foundation database must already exist.");
            var witness = Path.Combine(evidence, "framework-health-failure.json"); InstallationCore.Safe(witness);
            if (File.Exists(witness) || Directory.Exists(witness)) throw new IOException("Framework failure witness must be new.");
            var node = InstallationCore.Member(root, "data/app/node.exe");
            var expectedNode = identity.files.Single(value => value.path == "data/app/node.exe");
            if (new FileInfo(node).Length != expectedNode.bytes || InstallationCore.HashFile(node) != expectedNode.sha256) throw new IOException("Framework failure Node bytes do not match the installed package.");
            var before = InstallationCore.HashFile(database);
            var script = "if(process.version!=='v22.14.0')throw Error('Expected packaged Node22.14.0');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.TABLEMAX_FRAMEWORK_WITNESS_DATABASE);try{db.exec('CREATE TABLE IF NOT EXISTS tablemax_framework_recovery_witness(id INTEGER PRIMARY KEY CHECK(id=1), marker TEXT NOT NULL)');db.prepare('INSERT INTO tablemax_framework_recovery_witness VALUES(1,?)').run('fixture-framework-health-failure-v1');}finally{db.close();}console.log('fixture-foundation-write-complete');";
            var start = new System.Diagnostics.ProcessStartInfo(node, "-e \"" + script + "\"") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = identity.boxRoot };
            start.EnvironmentVariables["TABLEMAX_FRAMEWORK_WITNESS_DATABASE"] = database;
            start.EnvironmentVariables.Remove("NODE_OPTIONS"); start.EnvironmentVariables.Remove("NODE_PATH");
            int pid, exit;
            string output;
            using (var child = System.Diagnostics.Process.Start(start))
            {
                if (child == null) throw new IOException("Packaged SQLite witness process did not start.");
                pid = child.Id;
                try
                {
                    var stdout = child.StandardOutput.ReadToEndAsync(); var stderr = child.StandardError.ReadToEndAsync();
                    if (!child.WaitForExit(15000)) throw new TimeoutException("Packaged SQLite witness exceeded its bounded budget.");
                    if (!Task.WaitAll(new Task[] { stdout, stderr }, 5000)) throw new TimeoutException("Packaged SQLite witness output did not drain.");
                    exit = child.ExitCode; output = stdout.Result.Trim();
                    if (exit != 0 || output != "fixture-foundation-write-complete") throw new IOException("Packaged SQLite witness failed before the expected Native health refusal.");
                }
                finally { if (!child.HasExited) { child.Kill(); child.WaitForExit(5000); } }
            }
            var after = InstallationCore.HashFile(database);
            if (after == before) throw new IOException("Fixture foundation database did not change.");
            InstallationCore.Atomic(witness, new { schemaVersion = 1, scenario = "framework-recovery", request, productId = identity.productId, scopeRoot = scope, root, boxRoot = identity.boxRoot, dataDirectory = identity.boxRoot, buildVersion = identity.buildVersion, installationId = identity.installationId, nodePath = node, nodeSha256 = expectedNode.sha256, nodePid = pid, nodeExitCode = exit, database, beforeSha256 = before, afterSha256 = after, expectedNativeExitCode = 42, productionEntryInvoked = false, sqliteWriteCompleted = true });
            return 42;
        }

        private static object Field(object target, string name)
        {
            var field = target.GetType().GetField(name, Private);
            if (field == null) throw new IOException("Actual Native fixture field unavailable: " + name);
            return field.GetValue(target);
        }
        private static async Task Tick()
        {
            if (finishing) return;
            try
            {
                if (!attached)
                {
                    var host = Application.OpenForms.Cast<Form>().OfType<TableMax.Desktop.NativeWindow>().FirstOrDefault(value => value.Managed && value.Role == "host");
                    if (host == null) return;
                    context = (DesktopContext)Field(host, "context");
                    if ((bool)Field(context, "booting") || Field(context, "installationSession") == null) return;
                    if (!persistent)
                    {
                        var original = (ApplicationUpdate)Field(context, "updates");
                        var replacement = new ApplicationUpdate(
                            (InstallationManifest)Field(context, "installation"), true,
                            (Func<Task<bool>>)Field(original, "prepare"), (Action)Field(original, "quit"),
                            (Action<string>)Field(original, "shutdownFailure"), (Action<object>)Field(original, "changed"),
                            () => new FixtureTransport());
                        context.GetType().GetField("updates", Private).SetValue(context, replacement);
                        original.Dispose();
                    }
                    var service = (ServiceProcess)Field(context, "service");
                    InstallationCore.Atomic(Path.Combine(evidence, role + "-native-ready.json"), new
                    {
                        schemaVersion = 1, role, desktopPid = System.Diagnostics.Process.GetCurrentProcess().Id,
                        servicePid = service.Id, root = InstallationCore.Text(plan, "root"), boxRoot = context.Storage.Root,
                        dataDirectory = context.DataDirectory, buildVersion = typeof(DesktopContext).Assembly.GetName().Version.ToString(4),
                        currentMappingSha256 = service.CurrentMappingSha256, health = Field(context, "health"),
                        cdpPort = context.CdpPort, persistent, realShutdownDelegates = true,
                        transport = persistent ? "Default transport; no network requested" : "Managed signed-fixture transport; no internet request"
                    });
                    attached = true;
                }
                if (persistent && File.Exists(Path.Combine(evidence, "quit.request")))
                {
                    finishing = true;
                    await context.Quit();
                }
            }
            catch (Exception cause)
            {
                finishing = true;
                InstallationCore.Atomic(Path.Combine(evidence, role + "-fixture-error.json"), new { error = cause.Message });
                TableMax.Desktop.Program.ExitCode = 1;
                if (context != null) await context.Quit();
            }
        }

        private sealed class FixtureTransport : HttpMessageHandler
        {
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
            {
                cancellation.ThrowIfCancellationRequested();
                var url = request.RequestUri.AbsoluteUri;
                HttpContent content;
                if (url == "https://api.github.com/repos/" + UpdateDescriptor.Repository + "/releases/latest")
                    content = new StringContent(InstallationCore.Text(plan, "apiJson"), InstallationCore.Utf8, "application/json");
                else
                {
                    var api = InstallationCore.Object(StrictJson.Parse(InstallationCore.Text(plan, "apiJson")));
                    var asset = ((object[])api["assets"]).Select(InstallationCore.Object).Single(item => InstallationCore.Text(item, "name").EndsWith(".exe", StringComparison.Ordinal));
                    if (url != InstallationCore.Text(asset, "browser_download_url")) throw new IOException("Unexpected fixture request URL.");
                    var file = InstallationCore.Full(InstallationCore.Text(plan, "newInstaller")); InstallationCore.Safe(file);
                    if (new FileInfo(InstallationCore.IO(file)).Length != InstallationCore.Number(plan, "newBytes") || InstallationCore.HashFile(file) != InstallationCore.Text(plan, "newSha256")) throw new IOException("Frozen fixture installer changed.");
                    content = new StreamContent(File.OpenRead(file));
                    content.Headers.ContentLength = InstallationCore.Number(plan, "newBytes");
                }
                InstallationCore.Atomic(Path.Combine(evidence, "last-managed-request.json"), new { url, method = request.Method.Method, actualInternet = false });
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { RequestMessage = request, Content = content });
            }
        }
    }
}
