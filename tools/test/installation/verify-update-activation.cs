using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using TableMax.Desktop;
using TableMax.Installation;

namespace TableMax.Desktop { internal sealed class DesktopContext { } }

internal static class UpdateActivationHarness
{
    private static readonly string[] Cases = { "same-instance-activation", "same-instance-repeated", "wrong-root-request", "extra-field-request", "foreign-image-peer", "foreign-owner-declaration", "current-is-up-to-date", "older-release-is-ahead", "same-current-different-bytes", "highest-water-refuses-older", "panel-request-id", "untrusted-release-not-latest" };
    private static Dictionary<string, object> fixture;
    private static string root;
    private static void Assert(bool value, string message) { if (!value) throw new IOException(message); }
    private static string Workspace => Assembly.GetExecutingAssembly().GetCustomAttributes<AssemblyMetadataAttribute>().Single(value => value.Key == "TableMaxActivationWorkspace").Value;
    private static string Under(string value, string parent)
    {
        var full = InstallationCore.Full(value); InstallationCore.Safe(full);
        Assert(full.StartsWith(InstallationCore.Full(parent) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase), "Harness path escaped its fresh workspace temporary root."); return full;
    }
    private static InstallationManifest Identity(string directory) => new InstallationManifest { schemaVersion = 1, productId = InstallationCore.ProductId, arch = "x64", installProtocol = 1, buildVersion = "1.0.7.10", releaseVersion = "1.0.7", installationId = "2f5919dc-0118-465a-8131-c396ef0e6a39", root = directory, boxRoot = InstallationCore.Box(directory), ownerSid = WindowsIdentity.GetCurrent().User.Value, files = new ManagedFile[0], payloadManifestSha256 = new string('a', 64), currentMappingSha256 = new string('b', 64) };
    private static string PipeName(InstallationManifest identity) => (string)typeof(UpdateActivation).GetMethod("PipeName", BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, new object[] { identity });
    private static int Client(string mode)
    {
        var identity = Identity(root);
        if (mode == "foreign-owner-declaration") identity.ownerSid = "S-1-5-18";
        if (mode == "wrong-root-request" || mode == "extra-field-request")
        {
            using (var pipe = new NamedPipeClientStream(".", PipeName(identity), PipeDirection.InOut, PipeOptions.Asynchronous, TokenImpersonationLevel.Identification))
            {
                pipe.Connect(8000);
                var request = new Dictionary<string, object> { ["schemaVersion"] = 1, ["operation"] = "check-updates", ["root"] = identity.root, ["installationId"] = identity.installationId, ["ownerSid"] = identity.ownerSid, ["buildVersion"] = identity.buildVersion };
                if (mode == "wrong-root-request") request["root"] = Path.Combine(root, "different-installation"); else request["unexpected"] = true;
                using (var input = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                {
                    // Match the production single-LF frame exactly: rejection
                    // must reach the root/keys check, not the CR framing check.
                    var frame = InstallationCore.Utf8.GetBytes(InstallationCore.Encode(request) + "\n");
                    pipe.Write(frame, 0, frame.Length); pipe.Flush(); var read = input.ReadLineAsync();
                    Assert(Task.WhenAny(read, Task.Delay(12000)).GetAwaiter().GetResult() == read, "Rejected activation did not close within its bounded protocol timeout.");
                    string reply = null;
                    try { reply = read.GetAwaiter().GetResult(); } catch (IOException) { }
                    Assert(reply == null, "Malformed activation received an acknowledgement.");
                }
            }
            Console.WriteLine("rejected"); return 0;
        }
        try
        {
            var activated = UpdateActivation.TryActivate(identity);
            Assert(mode == "valid" && activated, "A refused activation was accepted, or a valid activation timed out.");
            Console.WriteLine("accepted"); return 0;
        }
        catch (Exception error) when (mode == "foreign-image-peer" || mode == "foreign-owner-declaration")
        { Console.WriteLine("rejected:" + error.GetType().Name); return 0; }
    }
    private sealed class RawSnapshot
    {
        public byte[] bytes; public long observedBytes; public bool eof, truncated; public string readError;
    }
    private sealed class RawCapture
    {
        private const int Limit = 2 * 1024 * 1024;
        private readonly object gate = new object();
        private readonly MemoryStream retained = new MemoryStream();
        private long observed; private bool eof; private string readError;
        public readonly Task Completion;
        public RawCapture(Stream source) { Completion = Capture(source); }
        private async Task Capture(Stream source)
        {
            var buffer = new byte[8192];
            try
            {
                while (true)
                {
                    var count = await source.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false);
                    if (count == 0) { lock (gate) eof = true; return; }
                    lock (gate)
                    {
                        observed += count; var keep = Math.Min(count, Limit - (int)retained.Length);
                        if (keep > 0) retained.Write(buffer, 0, keep);
                    }
                }
            }
            catch (Exception error) { lock (gate) readError = error.ToString(); }
        }
        public RawSnapshot Snapshot()
        {
            lock (gate) return new RawSnapshot { bytes = retained.ToArray(), observedBytes = observed, eof = eof, truncated = observed > retained.Length, readError = readError };
        }
    }
    private static void WriteNew(string path, byte[] bytes)
    {
        InstallationCore.Safe(path);
        using (var output = new FileStream(InstallationCore.IO(path), FileMode.CreateNew, FileAccess.Write, FileShare.None)) { output.Write(bytes, 0, bytes.Length); output.Flush(true); }
    }
    private static object SaveRaw(string path, RawSnapshot capture)
    {
        WriteNew(path, capture.bytes);
        return new { path, bytes = capture.bytes.Length, sha256 = InstallationCore.Hash(capture.bytes), capture.observedBytes, capture.eof, capture.truncated, capture.readError };
    }
    private static string DiagnosticText(RawSnapshot capture, out string error)
    {
        try { error = null; return InstallationCore.Utf8.GetString(capture.bytes); }
        catch (DecoderFallbackException cause) { error = cause.GetType().Name + ": " + cause.Message; return Encoding.UTF8.GetString(capture.bytes); }
    }
    private static async Task<Tuple<string, object>> ObserveChild(ProcessStartInfo start, string name, int index)
    {
        var directory = Under(Path.Combine(root, "evidence", name), root); Directory.CreateDirectory(directory);
        var prefix = Path.Combine(directory, "child-" + index); var observationPath = prefix + ".json";
        Process child;
        try { child = Process.Start(start); Assert(child != null, "Own activation child was not created."); }
        catch (Exception error)
        {
            WriteNew(observationPath, InstallationCore.Utf8.GetBytes(InstallationCore.Encode(new { expectedModulePath = start.FileName, processStarted = false, pid = (int?)null, actualExitCode = (int?)null, error = error.ToString() })));
            throw new IOException("Own activation child start failed; original diagnostics: " + observationPath, error);
        }
        using (child)
        {
            var handle = child.Handle; var stdout = new RawCapture(child.StandardOutput.BaseStream); var stderr = new RawCapture(child.StandardError.BaseStream);
            string modulePath = null, moduleObservationError = null; var image = new StringBuilder(32768); uint length = (uint)image.Capacity;
            if (QueryFullProcessImageName(handle, 0, image, ref length)) modulePath = image.ToString(); else moduleObservationError = "QueryFullProcessImageNameW: " + Marshal.GetLastWin32Error();
            var timedOut = !child.WaitForExit(20000); string terminationError = null;
            if (timedOut) try { child.Kill(); if (!child.WaitForExit(5000)) terminationError = "Own activation child remained live after bounded termination."; } catch (Exception error) { terminationError = error.ToString(); }
            var streams = Task.WhenAll(stdout.Completion, stderr.Completion);
            var forcedStreamDetach = await Task.WhenAny(streams, Task.Delay(5000)) != streams;
            if (forcedStreamDetach)
            {
                child.StandardOutput.BaseStream.Dispose(); child.StandardError.BaseStream.Dispose();
                await Task.WhenAny(streams, Task.Delay(1000));
            }
            var output = stdout.Snapshot(); var errors = stderr.Snapshot();
            var outputRecord = SaveRaw(prefix + ".stdout.bin", output); var errorRecord = SaveRaw(prefix + ".stderr.bin", errors);
            string outputDecodeError, errorDecodeError;
            var outputText = DiagnosticText(output, out outputDecodeError); DiagnosticText(errors, out errorDecodeError);
            var exitCode = child.HasExited ? (int?)child.ExitCode : null;
            var observation = new { pid = child.Id, processStarted = true, expectedModulePath = start.FileName, modulePath, moduleObserved = modulePath != null, moduleObservationError, actualExitCode = exitCode, timedOut, terminationError, forcedStreamDetach, handleHeldThroughExitObservation = true, stdout = outputRecord, stderr = errorRecord, stdoutDecodeError = outputDecodeError, stderrDecodeError = errorDecodeError };
            WriteNew(observationPath, InstallationCore.Utf8.GetBytes(InstallationCore.Encode(observation)));
            Assert(!timedOut && terminationError == null && exitCode == 0, "Own activation child did not exit normally (actual exit=" + exitCode + "); original raw diagnostics: " + observationPath);
            Assert(modulePath != null && InstallationCore.Equal(modulePath, start.FileName), "Own activation child module was not confirmed; original raw diagnostics: " + observationPath);
            Assert(!forcedStreamDetach && output.eof && errors.eof && !output.truncated && !errors.truncated && output.readError == null && errors.readError == null, "Own activation child raw capture was incomplete; original raw diagnostics: " + observationPath);
            Assert(outputDecodeError == null && errorDecodeError == null, "Own activation child did not emit valid UTF-8; actual exit=" + exitCode + "; original raw diagnostics: " + observationPath);
            return Tuple.Create(outputText.Trim(), (object)new { path = observationPath, bytes = new FileInfo(observationPath).Length, sha256 = InstallationCore.HashFile(observationPath), process = observation });
        }
    }
    private static async Task<object> Ipc(string name)
    {
        var count = 0; var rejected = new ConcurrentQueue<string>(); var identity = Identity(root); var children = new List<object>();
        using (var server = new UpdateActivation(identity, () => { Interlocked.Increment(ref count); return Task.CompletedTask; }, message => rejected.Enqueue(message)))
        {
            var executable = Assembly.GetExecutingAssembly().Location;
            if (name == "foreign-image-peer")
            {
                var foreign = Path.Combine(root, "foreign", "TableMax.exe"); Directory.CreateDirectory(Path.GetDirectoryName(foreign)); File.Copy(executable, foreign, false); executable = foreign;
            }
            var expected = name == "same-instance-activation" ? 1 : name == "same-instance-repeated" ? 2 : 0;
            for (var index = 0; index < Math.Max(1, expected); index++)
            {
                var mode = expected > 0 ? "valid" : name;
                var start = new ProcessStartInfo(executable, "--client=" + mode + " --root=" + ApplicationUpdate.Quote(root)) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root, RedirectStandardOutput = true, RedirectStandardError = true };
                var observation = await ObserveChild(start, name, index); children.Add(observation.Item2);
                Assert(expected > 0 ? observation.Item1 == "accepted" : observation.Item1.StartsWith("rejected", StringComparison.Ordinal), "Activation child did not report its actual outcome; original diagnostics: " + InstallationCore.Encode(observation.Item2));
            }
            if (expected == 0 && name != "foreign-owner-declaration")
            {
                var wait = Stopwatch.StartNew();
                while (rejected.IsEmpty) { Assert(wait.ElapsedMilliseconds < 2000, "Negative activation did not reach the actual server rejection path."); await Task.Delay(10); }
            }
            Assert(count == expected, "The check-only activation callback count changed.");
            return new { callbackCount = count, expectedCallbackCount = expected, rejectionDiagnostics = rejected.ToArray(), children, frameLF = true, frameEncoding = "UTF-8 without BOM; one LF terminator; no writer-dispose flush", actualNamedPipe = true, peerImageAndOwnerCheckedByProductionCode = true, actualDesktopOrGameStarted = false };
        }
    }
    private static Dictionary<string, object> Descriptor(string name) => InstallationCore.Object(InstallationCore.Object(fixture["descriptors"])[name]);
    private static Dictionary<string, object> Description(string name) => InstallationCore.Object(Descriptor(name)["description"]);
    private static Dictionary<string, object> State(ApplicationUpdate value) => InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(value.Read())));
    private static string Phase(ApplicationUpdate value) => InstallationCore.Text(State(value), "phase");
    private static async Task Terminal(ApplicationUpdate value)
    {
        var watch = Stopwatch.StartNew(); while (Phase(value) == "checking") { Assert(watch.ElapsedMilliseconds < 10000, "Managed check did not reach a terminal state."); await Task.Delay(10); }
    }
    private sealed class ReleasePlan
    {
        public string DescriptorName; public int Requests;
        public ReleasePlan(string name) { DescriptorName = name; }
    }
    private sealed class ReleaseHandler : HttpMessageHandler
    {
        private readonly ReleasePlan plan;
        public ReleaseHandler(ReleasePlan plan) { this.plan = plan; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            token.ThrowIfCancellationRequested(); Interlocked.Increment(ref plan.Requests);
            Assert(request.RequestUri.AbsoluteUri == "https://api.github.com/repos/" + UpdateDescriptor.Repository + "/releases/latest", "Unexpected network URL in read-only check.");
            var item = Descriptor(plan.DescriptorName); var description = InstallationCore.Object(item["description"]); var release = InstallationCore.Text(description, "releaseVersion"); var tag = InstallationCore.Text(description, "releaseTag");
            var assets = new object[] {
                new { id = 2, name = InstallationCore.Text(description, "assetName"), state = "uploaded", size = InstallationCore.Number(description, "bytes"), browser_download_url = InstallationCore.Text(description, "assetUrl"), digest = "sha256:" + InstallationCore.Text(description, "sha256") },
                new { id = 3, name = "TableMax-" + release + "-source.zip", state = "uploaded", size = 1, browser_download_url = "https://github.com/" + UpdateDescriptor.Repository + "/releases/download/" + tag + "/TableMax-" + release + "-source.zip" }
            };
            var json = InstallationCore.Encode(new { id = 1, draft = false, prerelease = false, tag_name = tag, html_url = "https://github.com/" + UpdateDescriptor.Repository + "/releases/tag/" + tag, body = InstallationCore.Text(item, "body"), assets });
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, InstallationCore.Utf8, "application/json") });
        }
    }
    private static async Task<object> Controller(string name)
    {
        var identity = Identity(Path.Combine(root, "cases", name)); Directory.CreateDirectory(identity.boxRoot);
        var current = Description("current"); identity.payloadManifestSha256 = InstallationCore.Digest(current, "payloadManifestSha256"); identity.currentMappingSha256 = InstallationCore.Digest(current, "currentMappingSha256");
        InstallationCore.Atomic(InstallationCore.ReceiptPath(identity.root), new InstallerReceipt { schemaVersion = 1, productId = InstallationCore.ProductId, installationId = identity.installationId, buildVersion = identity.buildVersion, bytes = InstallationCore.Number(current, "bytes"), sha256 = InstallationCore.Digest(current, "sha256") });
        var selected = name == "older-release-is-ahead" ? "older" : name == "same-current-different-bytes" ? "changed" : name == "untrusted-release-not-latest" ? "untrusted" : name == "highest-water-refuses-older" ? "future" : "current";
        var handler = new ReleasePlan(selected); var phases = new ConcurrentQueue<string>();
        using (var controller = new ApplicationUpdate(identity, false, () => { throw new IOException("Read-only activation check cannot prepare an update."); }, () => { throw new IOException("Read-only activation check cannot quit a host."); }, message => { throw new IOException("Read-only activation check cannot stop a host."); }, value => phases.Enqueue(InstallationCore.Text(InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(value))), "phase")), () => new ReleaseHandler(handler)))
        {
            if (name == "panel-request-id") controller.OpenPanel(); else controller.Check();
            await Terminal(controller);
            var expected = name == "older-release-is-ahead" ? "ahead" : name == "same-current-different-bytes" || name == "untrusted-release-not-latest" ? "error" : name == "highest-water-refuses-older" ? "available" : "up-to-date";
            Assert(Phase(controller) == expected, "Read-only update status differs: " + Phase(controller));
            if (name == "highest-water-refuses-older")
            {
                var path = Path.Combine(identity.boxRoot, "updates", "highest-envelope.json"); var prior = File.ReadAllBytes(path);
                handler.DescriptorName = "older"; controller.Check(); await Terminal(controller);
                Assert(Phase(controller) == "error" && prior.SequenceEqual(File.ReadAllBytes(path)), "Accepted trust water was lowered or rewritten.");
            }
            if (name == "panel-request-id")
            {
                Assert(InstallationCore.Number(State(controller), "panelRequestId") == 1, "First panel request was not retained for the UI.");
                controller.OpenPanel(); await Terminal(controller);
                Assert(InstallationCore.Number(State(controller), "panelRequestId") == 2 && Phase(controller) == "up-to-date", "A repeated panel request did not increment or recheck.");
            }
            Assert(phases.Contains("checking"), "No actual checking feedback was published.");
            Assert(!Directory.Exists(Path.Combine(identity.boxRoot, "updates", "downloads")), "A read-only status check downloaded an installer.");
            return new { phase = Phase(controller), panelRequestId = InstallationCore.Number(State(controller), "panelRequestId"), phases = phases.ToArray(), requests = handler.Requests, actualProductionController = true, actualRsaVerification = true, transport = "in-process-managed-fixture", actualGitHubNetwork = false, actualUi = false };
        }
    }
    private static int Main(string[] args)
    {
        try
        {
            Console.OutputEncoding = new UTF8Encoding(false); Console.InputEncoding = new UTF8Encoding(false);
            Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), InstallationCore.Utf8) { AutoFlush = true });
            Console.SetError(new StreamWriter(Console.OpenStandardError(), InstallationCore.Utf8) { AutoFlush = true });
            Console.SetIn(new StreamReader(Console.OpenStandardInput(), InstallationCore.Utf8));
            InstallationCore.InitializeRuntime();
            var values = args.Select(value => value.Split(new[] { '=' }, 2)).ToDictionary(value => value[0], value => value.Length == 2 ? value[1] : "", StringComparer.Ordinal);
            root = Under(values["--root"], Path.Combine(Workspace, "tmp"));
            if (values.ContainsKey("--client"))
            {
                Assert(InstallationCore.Equal(Assembly.GetExecutingAssembly().Location, Path.Combine(root, "data", "app", "TableMax.exe")) || values["--client"] == "foreign-image-peer" && InstallationCore.Equal(Assembly.GetExecutingAssembly().Location, Path.Combine(root, "foreign", "TableMax.exe")), "Activation child image escaped its own fixture.");
                return Client(values["--client"]);
            }
            Assert(InstallationCore.Equal(Assembly.GetExecutingAssembly().Location, Path.Combine(root, "data", "app", "TableMax.exe")), "Harness image must be the isolated peer path.");
            fixture = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(Under(values["--fixture"], root), InstallationCore.Utf8)));
            var selected = values["--only"].Split(','); var prior = Int32.Parse(values["--prior-failures"]); var limit = Int32.Parse(Environment.GetEnvironmentVariable("TABLEMAX_TEST_MAX_FAILURES"));
            Assert(limit >= 1 && limit <= 1000 && prior >= 0 && prior < limit && selected.Length > 0 && selected.Distinct().Count() == selected.Length && selected.All(Cases.Contains), "Harness scope or shared failure budget is invalid.");
            var results = new List<object>(); var failures = 0;
            foreach (var name in Cases.Where(selected.Contains))
            {
                try { var details = (Array.IndexOf(Cases, name) < 6 ? Ipc(name) : Controller(name)).GetAwaiter().GetResult(); results.Add(new { name, passed = true, details }); }
                catch (Exception error) { failures++; results.Add(new { name, passed = false, error = error.ToString() }); if (prior + failures >= limit) break; }
            }
            Console.WriteLine(InstallationCore.Encode(new { schemaVersion = 1, kind = "update-activation-component", selectedCases = Cases.Where(selected.Contains).ToArray(), priorFailures = prior, failureLimit = limit, failures, totalFailures = prior + failures, results, productionDesktopExecuted = false, installerExecuted = false, registryChanged = false }));
            return failures == 0 ? 0 : 1;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 2; }
    }
    [DllImport("kernel32.dll", EntryPoint = "QueryFullProcessImageNameW", ExactSpelling = true, CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder name, ref uint size);
}
