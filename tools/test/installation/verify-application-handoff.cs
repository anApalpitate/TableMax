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
            if (checking) return (int)entry.Invoke(null, new object[] { programArguments });
            if (!programArguments.Contains("--foundation-test")) throw new IOException("Fixture entry requires hidden test mode.");
            var pathname = Environment.GetEnvironmentVariable("TABLEMAX_HANDOFF_TEST_PLAN");
            if (String.IsNullOrEmpty(pathname)) throw new IOException("Missing isolated handoff plan.");
            InstallationCore.Safe(pathname);
            plan = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(pathname, InstallationCore.Utf8)));
            InstallationCore.Keys(plan, "schemaVersion", "root", "evidence", "newInstaller", "newBytes", "newSha256", "apiJson");
            if (InstallationCore.Number(plan, "schemaVersion") != 1) throw new IOException("Fixture plan version invalid.");
            var root = InstallationCore.Root(InstallationCore.Text(plan, "root"));
            var identity = InstallationManifest.Load(root);
            if (!InstallationCore.Equal(AppDomain.CurrentDomain.BaseDirectory, Path.Combine(identity.boxRoot, "app"))) throw new IOException("Fixture process is outside its actual installed Native root.");
            evidence = InstallationCore.Full(InstallationCore.Text(plan, "evidence")); InstallationCore.Safe(evidence);
            if (!Directory.Exists(evidence)) throw new IOException("Fixture evidence directory must already exist.");
            role = persistent ? "new" : "old";
            using (var input = persistent ? new AnonymousPipeServerStream(PipeDirection.Out, HandleInheritability.None) : null)
            using (var timer = new System.Windows.Forms.Timer { Interval = 100 })
            {
                if (input != null && !SetStdHandle(-10, new IntPtr(Int64.Parse(input.GetClientHandleAsString())))) throw new IOException("Fixture input could not be held.");
                timer.Tick += async (_, __) => await Tick();
                timer.Start();
                try { return (int)entry.Invoke(null, new object[] { programArguments }); }
                catch (TargetInvocationException cause) { throw cause.InnerException ?? cause; }
                finally { timer.Stop(); }
            }
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
                    await (Task)context.GetType().GetMethod("Quit", Private).Invoke(context, null);
                }
            }
            catch (Exception cause)
            {
                finishing = true;
                InstallationCore.Atomic(Path.Combine(evidence, role + "-fixture-error.json"), new { error = cause.Message });
                TableMax.Desktop.Program.ExitCode = 1;
                if (context != null) await (Task)context.GetType().GetMethod("Quit", Private).Invoke(context, null);
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
