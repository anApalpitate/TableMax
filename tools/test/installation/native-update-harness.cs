using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using TableMax.Installation;
using TableMax.Desktop;

namespace TableMax.Desktop { internal sealed class DesktopContext { } }

namespace TableMax.NativeUpdateHarness
{
    // The production controller is compiled unchanged, with its managed-only
    // transport factory. No server, registry, launcher or update helper is run.
    internal static class Harness
    {
        private static Dictionary<string, object> fixture;
        private static string root;
        private static byte[] installer;
        private static readonly string[] CaseNames = { "valid-download", "valid-redirect", "cancel", "oversized-stream", "truncated-stream", "broken-stream", "wrong-sha", "unsafe-redirect", "exact-two-assets", "source-asset-state", "asset-digest", "foreign-release", "multiple-machine-blocks", "highest-version", "same-build-different-sha", "same-current-different-sha", "current-is-idle", "highest-tamper-refused", "parameters-not-network", "long-path-download" };
        private sealed class Result { public string name; public bool passed; public string phase; public int apiRequests; public int downloadRequests; public string error; public object details; }
        private static int Main(string[] args)
        {
            InstallationCore.InitializeRuntime();
            try
            {
                if (args.Length < 2 || args.Length > 4) throw new IOException("Expected isolated root, public fixture JSON and optional --only/--prior-failures.");
                var options = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var argument in args.Skip(2))
                {
                    var separator = argument.IndexOf('=');
                    if (separator < 0 || (argument.Substring(0, separator) != "--only" && argument.Substring(0, separator) != "--prior-failures") || options.ContainsKey(argument.Substring(0, separator))) throw new IOException("Unexpected or duplicate harness option.");
                    options.Add(argument.Substring(0, separator), argument.Substring(separator + 1));
                }
                var failureLimit = 5; var configuredLimit = Environment.GetEnvironmentVariable("TABLEMAX_TEST_MAX_FAILURES"); if (configuredLimit != null && (!Int32.TryParse(configuredLimit, out failureLimit) || failureLimit < 1 || failureLimit > 1000)) throw new IOException("Failure limit must be an integer from 1 to 1000.");
                var priorFailures = 0;
                if (options.TryGetValue("--prior-failures", out var prior) && (!Int32.TryParse(prior, out priorFailures) || priorFailures < 0 || priorFailures >= failureLimit || prior != priorFailures.ToString(System.Globalization.CultureInfo.InvariantCulture))) throw new IOException("Prior failures must be an integer from 0 to " + (failureLimit - 1) + ".");
                var selected = CaseNames;
                if (options.TryGetValue("--only", out var only))
                {
                    var names = only.Split(',');
                    if (names.Any(name => !CaseNames.Contains(name)) || names.Distinct(StringComparer.Ordinal).Count() != names.Length) throw new IOException("Select unique known harness case IDs.");
                    selected = CaseNames.Where(names.Contains).ToArray();
                }
                root = InstallationCore.Root(args[0]); if (!Directory.Exists(root) || Directory.GetFileSystemEntries(root).Length != 0) throw new IOException("Harness root must already exist and be empty.");
                fixture = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(args[1], InstallationCore.Utf8)));
                installer = Convert.FromBase64String(InstallationCore.Text(fixture, "installerBase64"));
                var tests = new List<Result>();
                foreach (var name in selected)
                {
                    try { tests.Add(Run(name).GetAwaiter().GetResult()); }
                    catch (Exception error) { tests.Add(new Result { name = name, passed = false, error = error.Message }); }
                    if (priorFailures + tests.Count(test => !test.passed) >= failureLimit) break;
                }
                var failures = tests.Count(test => !test.passed);
                Console.WriteLine(InstallationCore.Encode(new { passed = tests.All(test => test.passed), boundary = "Actual net48 ApplicationUpdate controller and filesystem with synthetic installation members; injected managed HTTP transport; no Native/server startup, live GitHub download, installer, registry or Windows policy change", selectedCases = selected, priorFailures, failures, totalFailures = priorFailures + failures, failureLimit, stoppedEarly = tests.Count < selected.Length, results = tests }));
                return tests.All(test => test.passed) ? 0 : 1;
            }
            catch (Exception error) { Console.Error.WriteLine(error.Message); return 2; }
        }
        private static InstallationManifest Create(string name)
        {
            var directory = Path.Combine(root, name);
            if (name == "long-path-download")
            {
                var padding = 200 - directory.Length - 1;
                Assert(padding >= 1 && padding <= 255, "The harness parent cannot produce an exact 200-character installation root.");
                directory = Path.Combine(directory, new string('d', padding));
                Assert(directory.Length == 200, "Long-path installation root length differs.");
                InstallationCore.ValidateStartupPaths(directory, InstallationCore.Box(directory));
            }
            Directory.CreateDirectory(InstallationCore.IO(directory));
            var paths = new Dictionary<string, string> {
                ["TableMax.exe"] = "fixture-launcher",
                ["UpdateHelper.exe"] = "fixture-helper",
                ["Updater.exe"] = "fixture-updater",
                ["data/app/TableMax.exe"] = "fixture-native",
                ["data/app/node.exe"] = "fixture-node",
                ["data/app/server.cjs"] = "fixture-server",
                ["data/app/.tablemax-release.json"] = "fixture-payload-manifest",
                ["data/app/preinstalled-games/bootstrap.json"] = "fixture-bootstrap-mapping"
            };
            var files = new List<ManagedFile>();
            foreach (var entry in paths) { var file = InstallationCore.Member(directory, entry.Key); Directory.CreateDirectory(InstallationCore.IO(Path.GetDirectoryName(file))); var bytes = InstallationCore.Utf8.GetBytes(entry.Value); File.WriteAllBytes(InstallationCore.IO(file), bytes); files.Add(new ManagedFile { path = entry.Key, bytes = bytes.Length, sha256 = InstallationCore.Hash(bytes) }); }
            var identity = new InstallationManifest { schemaVersion = 1, productId = InstallationCore.ProductId, arch = "x64", installProtocol = 1, buildVersion = "1.0.6.10", releaseVersion = "1.0.6", installationId = Guid.NewGuid().ToString("D"), root = directory, boxRoot = InstallationCore.Box(directory), ownerSid = WindowsIdentity.GetCurrent().User.Value, files = files.ToArray(), payloadManifestSha256 = InstallationCore.Hash(InstallationCore.Utf8.GetBytes("fixture-payload-manifest")), currentMappingSha256 = InstallationCore.Hash(InstallationCore.Utf8.GetBytes("fixture-bootstrap-mapping")) };
            if (name == "long-path-download") Assert(identity.files.All(file => InstallationCore.Member(directory, file.path).Length < 260), "Synthetic startup members must still have ordinary paths below MAX_PATH.");
            var current = Description("current");
            InstallationCore.Atomic(InstallationCore.IdentityPath(directory), identity);
            InstallationCore.Atomic(InstallationCore.ReceiptPath(directory), new InstallerReceipt { schemaVersion = 1, productId = InstallationCore.ProductId, installationId = identity.installationId, buildVersion = identity.buildVersion, bytes = InstallationCore.Number(current, "bytes"), sha256 = InstallationCore.Digest(current, "sha256") });
            return identity;
        }
        private static Dictionary<string, object> Descriptor(string name) => InstallationCore.Object(InstallationCore.Object(fixture["descriptors"])[name]);
        private static Dictionary<string, object> Description(string name) => InstallationCore.Object(Descriptor(name)["description"]);
        private static string Api(string descriptor, string scenario)
        {
            var item = Descriptor(descriptor); var description = Description(descriptor);
            var release = InstallationCore.Text(description, "releaseVersion"); var tag = "v" + release;
            var source = new Dictionary<string, object> { ["id"] = 5002, ["name"] = "TableMax-" + release + "-source.zip", ["state"] = scenario == "source-asset-state" ? "new" : "uploaded", ["size"] = 1234, ["browser_download_url"] = "https://github.com/" + UpdateDescriptor.Repository + "/releases/download/" + tag + "/TableMax-" + release + "-source.zip" };
            var executable = new Dictionary<string, object> { ["id"] = 5001, ["name"] = InstallationCore.Text(description, "assetName"), ["state"] = "uploaded", ["size"] = InstallationCore.Number(description, "bytes"), ["browser_download_url"] = InstallationCore.Text(description, "assetUrl"), ["digest"] = "sha256:" + (scenario == "asset-digest" ? new string('a', 64) : InstallationCore.Text(description, "sha256")) };
            var assets = new List<object> { executable, source }; if (scenario == "exact-two-assets") assets.Add(new { id = 5003, name = "unexpected.txt", state = "uploaded", size = 1 });
            var body = InstallationCore.Text(item, "body"); if (scenario == "multiple-machine-blocks") body += "\n<!-- TABLEMAX-APPLICATION-UPDATE-V2:AAAA -->";
            return InstallationCore.Encode(new { id = 4999, draft = false, prerelease = false, tag_name = tag, html_url = "https://github.com/" + (scenario == "foreign-release" ? "other/project" : UpdateDescriptor.Repository) + "/releases/tag/" + tag, body, assets });
        }
        private static Dictionary<string, object> State(ApplicationUpdate controller) => InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(controller.Read())));
        private static string Phase(ApplicationUpdate controller) => InstallationCore.Text(State(controller), "phase");
        private static string[] Files(string directory, string pattern) => Directory.GetFiles(InstallationCore.IO(directory), pattern, SearchOption.AllDirectories).Select(InstallationCore.Full).ToArray();
        private static void Assert(bool condition, string message) { if (!condition) throw new IOException(message); }
        private static async Task Until(Func<bool> condition, string message, int timeout = 10000)
        {
            var start = System.Diagnostics.Stopwatch.StartNew(); while (!condition()) { if (start.ElapsedMilliseconds >= timeout) throw new IOException(message); await Task.Delay(10); }
        }
        private static async Task<Result> Run(string name)
        {
            var identity = Create(name); var transport = new Plan(name);
            object details = null;
            using (var controller = new ApplicationUpdate(identity, false, () => Task.FromResult(false), () => { throw new IOException("Harness must never quit or run helper."); }, message => { throw new IOException("Harness must never take shutdown barrier."); }, value => { }, () => new FakeHandler(transport)))
            {
                if (name == "parameters-not-network")
                {
                    var refused = false; try { controller.Download(); } catch (IOException) { refused = true; }
                    Assert(refused && transport.ApiCount == 0 && transport.DownloadCount == 0, "Download before authenticated check must fail without network.");
                }
                else
                {
                    controller.Check(); await Until(() => Phase(controller) != "checking", "Check did not finish.");
                    if (name == "current-is-idle") Assert(Phase(controller) == "up-to-date", "An exact current installer must explicitly report up-to-date.");
                    else if (new[] { "exact-two-assets", "source-asset-state", "asset-digest", "foreign-release", "multiple-machine-blocks", "same-current-different-sha" }.Contains(name)) Assert(Phase(controller) == "error" && transport.DownloadCount == 0, "Invalid release must fail before download.");
                    else
                    {
                        Assert(Phase(controller) == "available", "Authenticated candidate was not available.");
                        if (name == "highest-version" || name == "same-build-different-sha")
                        {
                            var accepted = File.ReadAllText(InstallationCore.IO(Path.Combine(identity.boxRoot, "updates", "highest-envelope.json")));
                            controller.Check(); await Until(() => Phase(controller) != "checking", "Second check did not finish.");
                            Assert(Phase(controller) == "error", "Lower version or changed same build was accepted.");
                            Assert(File.ReadAllText(InstallationCore.IO(Path.Combine(identity.boxRoot, "updates", "highest-envelope.json"))) == accepted, "Rejected candidate changed authenticated high-water mark.");
                        }
                        else if (name == "highest-tamper-refused")
                        {
                            File.WriteAllText(InstallationCore.IO(Path.Combine(identity.boxRoot, "updates", "highest-envelope.json")), "{}"); var refused = false; try { controller.Download(); } catch (IOException) { refused = true; }
                            Assert(refused && transport.DownloadCount == 0, "Corrupt trust waterline must not trigger a download.");
                        }
                        else
                        {
                            controller.Download();
                            if (name == "cancel") { await Until(() => transport.DownloadCount > 0, "Download did not reach transport."); controller.Cancel(); }
                            await Until(() => Phase(controller) != "downloading", "Download did not reach terminal state.");
                            var expected = name == "cancel" ? "available" : name == "valid-download" || name == "valid-redirect" || name == "long-path-download" ? "ready" : "error";
                            Assert(Phase(controller) == expected, "Unexpected download terminal state: " + Phase(controller));
                            await Until(() => !Files(identity.boxRoot, "*.partial").Any(), "Partial download was not retired.");
                            var executables = Files(Path.Combine(identity.boxRoot, "updates"), "TableMax-*-win-x64.exe");
                            Assert(executables.Length == (expected == "ready" ? 1 : 0), "Rejected or cancelled download became executable candidate.");
                            if (expected == "ready") Assert(InstallationCore.HashFile(executables[0]) == InstallationCore.Text(Description("good"), "sha256"), "Ready file hash differs from signed asset.");
                            if (name == "long-path-download")
                            {
                                var good = Description("good");
                                var expectedPath = Path.Combine(identity.boxRoot, "updates", "downloads", InstallationCore.Text(good, "sha256"), InstallationCore.Text(good, "assetName"));
                                Assert(InstallationCore.Equal(executables[0], expectedPath), "Long-path candidate did not retain its ordinary signed staging identity.");
                                var directory = Path.GetDirectoryName(expectedPath);
                                Assert(directory.Length > 260 && expectedPath.Length > 260, "The regression did not exercise long download paths.");
                                Assert(new FileInfo(InstallationCore.IO(expectedPath)).Length == InstallationCore.Number(good, "bytes"), "Ready long-path installer length differs.");
                                var receiptPath = Path.Combine(directory, "receipt.json");
                                var receipt = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(InstallationCore.IO(receiptPath), InstallationCore.Utf8)));
                                InstallationCore.Keys(receipt, "schemaVersion", "repo", "releaseTag", "releaseId", "assetId", "assetName", "sha256", "bytes");
                                Assert(InstallationCore.Number(receipt, "schemaVersion") == 1 && InstallationCore.Number(receipt, "releaseId") == 4999 && InstallationCore.Number(receipt, "assetId") == 5001 && InstallationCore.Number(receipt, "bytes") == installer.Length && InstallationCore.Text(receipt, "sha256") == InstallationCore.Text(good, "sha256") && InstallationCore.Text(receipt, "repo") == UpdateDescriptor.Repository && InstallationCore.Text(receipt, "releaseTag") == InstallationCore.Text(good, "releaseTag") && InstallationCore.Text(receipt, "assetName") == InstallationCore.Text(good, "assetName"), "Long-path download receipt differs from authenticated release and asset.");
                                var highestPath = Path.Combine(identity.boxRoot, "updates", "highest-envelope.json");
                                var envelopePath = Path.Combine(directory, "envelope.json");
                                var keys = TrustRoots.Read(typeof(ApplicationUpdate).Assembly);
                                foreach (var pathname in new[] { highestPath, envelopePath })
                                {
                                    var signed = UpdateDescriptor.Verify(File.ReadAllText(InstallationCore.IO(pathname), InstallationCore.Utf8), keys);
                                    Assert(signed.buildVersion == InstallationCore.Text(good, "buildVersion") && signed.sha256 == InstallationCore.Text(good, "sha256") && signed.bytes == installer.Length && signed.payloadManifestSha256 == InstallationCore.Text(good, "payloadManifestSha256") && signed.currentMappingSha256 == InstallationCore.Text(good, "currentMappingSha256"), "Long-path authenticated envelope or high-water identity differs.");
                                }
                                Assert(transport.ApiCount == 1 && transport.DownloadCount == 1, "Long-path case did not use the actual single check/download transport flow.");
                                details = new { installationRoot = identity.root, installationRootLength = identity.root.Length, ordinaryStartupMemberMaxLength = identity.files.Max(file => InstallationCore.Member(identity.root, file.path).Length), downloadDirectoryLength = directory.Length, downloadPathLength = expectedPath.Length, partialPathLength = expectedPath.Length + 1 + 32 + ".partial".Length, downloadSha256 = InstallationCore.HashFile(expectedPath), receiptSha256 = InstallationCore.HashFile(receiptPath), highestEnvelopeSha256 = InstallationCore.HashFile(highestPath), downloadEnvelopeSha256 = InstallationCore.HashFile(envelopePath), partialFilesRemaining = Files(identity.boxRoot, "*.partial").Length, startupPathContractChecked = true, actualNativeStartup = false, windowsPolicyChanged = false };
                            }
                            if (name == "unsafe-redirect") Assert(transport.DownloadCount == 1, "Unsafe redirect reached HTTP transport.");
                            if (name == "valid-redirect") Assert(transport.DownloadCount == 2, "Allowed redirect did not use bounded two-hop flow.");
                        }
                    }
                }
                Assert(transport.UnexpectedUrlCount == 0, "Controller sent arbitrary or unexpected URL to network.");
                return new Result { name = name, passed = true, phase = Phase(controller), apiRequests = transport.ApiCount, downloadRequests = transport.DownloadCount, details = details };
            }
        }
        private sealed class Plan
        {
            public readonly string Scenario; public int ApiCount, DownloadCount, UnexpectedUrlCount;
            public Plan(string scenario) { Scenario = scenario; }
            public string NextApi()
            {
                var number = Interlocked.Increment(ref ApiCount); var descriptor = Scenario == "current-is-idle" ? "current" : Scenario == "same-current-different-sha" ? "currentOther" : Scenario == "highest-version" && number > 1 ? "lower" : Scenario == "same-build-different-sha" && number > 1 ? "other" : "good";
                return Api(descriptor, Scenario);
            }
        }
        private sealed class FakeHandler : HttpMessageHandler
        {
            private readonly Plan plan; public FakeHandler(Plan plan) { this.plan = plan; }
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
            {
                token.ThrowIfCancellationRequested(); var url = request.RequestUri;
                if (url.AbsoluteUri == "https://api.github.com/repos/" + UpdateDescriptor.Repository + "/releases/latest") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(plan.NextApi(), InstallationCore.Utf8, "application/json") });
                var count = Interlocked.Increment(ref plan.DownloadCount);
                if (!(url.AbsoluteUri == InstallationCore.Text(Description("good"), "assetUrl") || url.AbsoluteUri == "https://release-assets.githubusercontent.com/github-production-release-asset/999/fixture?fixture=1")) Interlocked.Increment(ref plan.UnexpectedUrlCount);
                if ((plan.Scenario == "unsafe-redirect" || plan.Scenario == "valid-redirect") && count == 1)
                {
                    var redirected = new HttpResponseMessage(HttpStatusCode.Found); redirected.Headers.Location = new Uri(plan.Scenario == "unsafe-redirect" ? "http://untrusted.example/installer.exe" : "https://release-assets.githubusercontent.com/github-production-release-asset/999/fixture?fixture=1"); return Task.FromResult(redirected);
                }
                var bytes = (byte[])installer.Clone(); if (plan.Scenario == "oversized-stream") bytes = bytes.Concat(new byte[] { 1 }).ToArray(); if (plan.Scenario == "truncated-stream") bytes = bytes.Take(bytes.Length - 1).ToArray(); if (plan.Scenario == "wrong-sha") bytes[0] ^= 128;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(new ControlledStream(bytes, plan.Scenario)) });
            }
        }
        private sealed class ControlledStream : Stream
        {
            private readonly byte[] bytes; private readonly string scenario; private int position, reads;
            public ControlledStream(byte[] bytes, string scenario) { this.bytes = bytes; this.scenario = scenario; }
            public override bool CanRead => true; public override bool CanSeek => false; public override bool CanWrite => false; public override long Length => throw new NotSupportedException(); public override long Position { get => position; set => throw new NotSupportedException(); }
            public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken token)
            {
                token.ThrowIfCancellationRequested(); reads++;
                if (scenario == "cancel") { await Task.Delay(Timeout.Infinite, token); return 0; }
                if (scenario == "broken-stream" && reads > 1) throw new IOException("fixture-connection-lost");
                var length = Math.Min(scenario == "broken-stream" ? 512 : count, bytes.Length - position); Array.Copy(bytes, position, buffer, offset, length); position += length; return length;
            }
            public override int Read(byte[] buffer, int offset, int count) => ReadAsync(buffer, offset, count, CancellationToken.None).GetAwaiter().GetResult();
            public override void Flush() { } public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException(); public override void SetLength(long length) => throw new NotSupportedException(); public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        }
    }
}
