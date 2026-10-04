using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;

namespace TableMax.Desktop
{
    internal sealed class DesktopContext : ApplicationContext
    {
        private readonly Control dispatch = new Control();
        private readonly string[] arguments;
        private readonly List<NativeWindow> windows = new List<NativeWindow>();
        private readonly HashSet<string> played = new HashSet<string>();
        private readonly Queue<string> playedOrder = new Queue<string>();
        private readonly RegisteredWaitHandle reopen;
        private ServiceProcess service;
        private NativeWindow hostWindow;
        private string hostUrl;
        private int servicePort;
        private int? startupServiceExitCode;
        private Dictionary<string, object> health;
        private bool quitting, booting = true, powerActive;
        private int nextId = 1;
        private readonly object outputLock = new object();
        public string DataDirectory { get; }
        public bool Testing { get; }
        public bool Checking { get; }
        public bool Background => Testing || Checking;
        public string Origin { get; private set; }
        public int CdpPort { get; private set; }
        public CoreWebView2Environment Environment { get; private set; }
        public DisplaySettingsStore Displays { get; }

        public DesktopContext(string dataDirectory, string[] arguments, bool testing, bool checking, EventWaitHandle reopenEvent)
        {
            DataDirectory = dataDirectory; this.arguments = arguments; Testing = testing; Checking = checking;
            Displays = new DisplaySettingsStore(dataDirectory);
            dispatch.CreateControl();
            reopen = ThreadPool.RegisterWaitForSingleObject(reopenEvent, (_, __) => Post(async () => { await ShowHost(); }), null, Timeout.Infinite, false);
            dispatch.BeginInvoke(new Action(async () =>
            {
                try { await Start(); }
                catch (Exception cause) { await Failure(cause); }
            }));
            SystemEvents.PowerModeChanged += OnPowerModeChanged;
            SystemEvents.DisplaySettingsChanged += OnDisplaySettingsChanged;
        }
        private async Task Start()
        {
            // Shared runtime, cache location and production debug policy belong to
            // the application; inherited development overrides must not change them.
            foreach (string name in System.Environment.GetEnvironmentVariables().Keys)
                if (name.StartsWith("WEBVIEW2_", StringComparison.OrdinalIgnoreCase)) System.Environment.SetEnvironmentVariable(name, null);
            var options = new CoreWebView2EnvironmentOptions { ReleaseChannels = CoreWebView2ReleaseChannels.Stable };
            var missing = Testing && System.Environment.GetEnvironmentVariable("TABLEMAX_TEST_WEBVIEW_MISSING") == "1";
            try { if (missing) throw new WebView2RuntimeNotFoundException(); CoreWebView2Environment.GetAvailableBrowserVersionString(null, options); }
            catch (WebView2RuntimeNotFoundException)
            {
                const string detail = "缺少 Microsoft Edge WebView2 共享运行时。请从微软官网安装 Evergreen Runtime，然后重新启动 TableMax。安装后正常游玩不需要互联网。";
                if (!Background && MessageBox.Show(detail + "\n\n现在打开官方安装页面？", "TableMax 需要 WebView2", MessageBoxButtons.OKCancel, MessageBoxIcon.Information) == DialogResult.OK)
                    Process.Start(new ProcessStartInfo("https://developer.microsoft.com/microsoft-edge/webview2/#download-section") { UseShellExecute = true });
                throw new MissingRuntimeException(detail);
            }
            var prototype = Testing ? System.Environment.GetEnvironmentVariable("TABLEMAX_PROTOTYPE_URL") : null;
            if (!string.IsNullOrEmpty(prototype))
            {
                if (!Uri.TryCreate(prototype, UriKind.Absolute, out var address) || address.Scheme != "http" || !IPAddress.TryParse(address.Host, out var ip) || !IPAddress.IsLoopback(ip)) throw new ArgumentException("Prototype test URL must use loopback HTTP.");
                Origin = address.GetLeftPart(UriPartial.Authority); hostUrl = prototype;
                health = new Dictionary<string, object>();
            }
            else
            {
                var port = 38473;
                var configuredPort = System.Environment.GetEnvironmentVariable("TABLEMAX_PORT");
                if (configuredPort != null && (!int.TryParse(configuredPort, out port) || port < 0 || port > 65535)) throw new ArgumentException("Invalid TABLEMAX_PORT.");
                service = new ServiceProcess(Log);
                service.UnexpectedExit += code => Post(async () =>
                {
                    if (quitting) return;
                    if (booting) { startupServiceExitCode = code; return; }
                    Program.ExitCode = 1;
                    var text = "本地服务异常退出（" + code + "）。请重新启动程序。";
                    Log(text); if (!Background) MessageBox.Show(text, "TableMax 服务已停止", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    await Quit();
                });
                var directory = AppDomain.CurrentDomain.BaseDirectory;
                System.Environment.SetEnvironmentVariable("NODE_OPTIONS", null);
                System.Environment.SetEnvironmentVariable("NODE_PATH", null);
                var ready = await service.Start(directory, new
                {
                    host = System.Environment.GetEnvironmentVariable("TABLEMAX_HOST") ?? "0.0.0.0",
                    port, dataDir = DataDirectory, webDir = Path.Combine(directory, "web"),
                    playMode = arguments.Contains("--tablemax-play-mode") ? "play" : Testing || arguments.Contains("--tablemax-test-mode") ? "test" : "play"
                });
                EnsureServiceAlive();
                servicePort = (int)Json.Number(ready, "port");
                Origin = "http://127.0.0.1:" + servicePort;
                health = Json.Object(Json.Value(ready, "health"));
                var webUrl = (!IsPackaged ? System.Environment.GetEnvironmentVariable("TABLEMAX_WEB_DEV_URL") : null) ?? Origin;
                if (!Uri.TryCreate(webUrl, UriKind.Absolute, out var parsed) || parsed.Scheme != "http" || !IPAddress.TryParse(parsed.Host, out var hostIp) || !IPAddress.IsLoopback(hostIp)) throw new ArgumentException("Development URL must use loopback HTTP.");
                Origin = parsed.GetLeftPart(UriPartial.Authority);
                hostUrl = Origin + "/host#host=" + Uri.EscapeDataString(Json.String(ready, "hostToken"));
            }
            var browserArguments = "--autoplay-policy=no-user-gesture-required";
            if (Testing)
            {
                var cdp = System.Environment.GetEnvironmentVariable("TABLEMAX_TEST_CDP_PORT");
                if (cdp == null)
                {
                    var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); CdpPort = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
                }
                else if (!int.TryParse(cdp, out var selected) || selected < 1 || selected > 65535) throw new ArgumentException("Invalid test CDP port.");
                else CdpPort = selected;
                browserArguments += " --remote-debugging-port=" + CdpPort + " --remote-debugging-address=127.0.0.1 --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows";
            }
            options.AdditionalBrowserArguments = browserArguments;
            Environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(DataDirectory, "desktop", "webview2"), options);
            EnsureServiceAlive();
            await ShowHost();
            EnsureServiceAlive();
            booting = false;
            UpdatePower();
            if (Checking)
            {
                File.WriteAllText(Path.Combine(DataDirectory, "desktop-check.json"), Json.Encode(new { health, servicePid = service?.Id ?? 0, desktopPid = Process.GetCurrentProcess().Id, packaged = IsPackaged, cdpPort = CdpPort }));
                await Quit();
            }
            else if (Testing)
            {
                Write(new { type = "desktop-ready", origin = Origin, servicePid = service?.Id ?? 0, desktopPid = Process.GetCurrentProcess().Id, packaged = IsPackaged, cdpPort = CdpPort });
                _ = Task.Run(ReadTestCommands);
            }
        }
        private void EnsureServiceAlive()
        {
            if (service != null && (startupServiceExitCode.HasValue || service.HasExited))
                throw new IOException("Local service exited during desktop startup" + (startupServiceExitCode.HasValue ? ": " + startupServiceExitCode.Value : "."));
        }
        public bool IsPackaged => !IsDevelopmentBuild();
        private static bool IsDevelopmentBuild()
        {
            try
            {
                var compiledRoot = Assembly.GetExecutingAssembly().GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(attribute => attribute.Key == "TableMaxRepositoryRoot")?.Value;
                if (string.IsNullOrEmpty(compiledRoot)) return false;
                var root = Path.GetFullPath(compiledRoot).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                var expected = Path.GetFullPath(Path.Combine(root, "build", "desktop"));
                var actual = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase) || !File.Exists(Path.Combine(root, "apps", "desktop", "native", "TableMax.csproj"))) return false;
                var marker = Json.Decode(File.ReadAllText(Path.Combine(actual, ".tablemax-development.json")));
                return marker.Count == 3 && Json.Number(marker, "version") == 1 &&
                    string.Equals(Path.GetFullPath(Json.String(marker, "repositoryRoot", "")).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar), root, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(Path.GetFullPath(Json.String(marker, "outputDirectory", "")).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar), expected, StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }
        public async Task<NativeWindow> ShowHost()
        {
            if (quitting || string.IsNullOrEmpty(hostUrl)) return null;
            if (hostWindow == null || hostWindow.IsDisposed) hostWindow = await Open(hostUrl, "host", 1080, 800, true, "desktop");
            else if (!Background) { if (hostWindow.WindowState == FormWindowState.Minimized) hostWindow.WindowState = FormWindowState.Normal; hostWindow.Show(); hostWindow.Activate(); NativeMethods.SetForegroundWindow(hostWindow.Handle); }
            return hostWindow;
        }
        public Task<NativeWindow> OpenPublic(string path = "/public") => Open(Origin + path, "public", 1280, 800, true, "desktop");
        public async Task<NativeWindow> Open(string url, string role, int width, int height, bool managed, string partition)
        {
            if (quitting) throw new InvalidOperationException("Desktop is stopping.");
            var lanPhone = !managed && role == "player" && AllowedTestPhone(url);
            if (!SameOrigin(url) && !lanPhone) throw new ArgumentException("Only the local TableMax origin may be opened.");
            var approvedOrigin = new Uri(url).GetLeftPart(UriPartial.Authority);
            var window = new NativeWindow(this, nextId++, role, width, height, managed, ProfileName(partition), approvedOrigin, lanPhone);
            windows.Add(window);
            window.FormClosed += (_, __) =>
            {
                windows.Remove(window);
                if (hostWindow == window) hostWindow = null;
                BroadcastAudio(); UpdatePower();
                if (!quitting && windows.Count == 0) Post(async () => { await Quit(); });
            };
            try { await window.Initialize(url); }
            catch { window.Close(); throw; }
            UpdatePower(); return window;
        }
        private static string ProfileName(string partition)
        {
            if (partition == "desktop") return "desktop";
            using (var hash = SHA256.Create()) return "test-" + BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(partition ?? Guid.NewGuid().ToString()))).Replace("-", "").Substring(0, 40);
        }
        public bool SameOrigin(string url) => Uri.TryCreate(url, UriKind.Absolute, out var value) && value.GetLeftPart(UriPartial.Authority) == Origin;
        private bool AllowedTestPhone(string url)
        {
            if (!Testing || servicePort == 0 || !Uri.TryCreate(url, UriKind.Absolute, out var address) || address.Scheme != "http" || address.Port != servicePort || address.UserInfo.Length != 0 || !new[] { "/player", "/player/game" }.ContainsValue(address.AbsolutePath) || !IPAddress.TryParse(address.Host, out var target) || target.AddressFamily != AddressFamily.InterNetwork) return false;
            return NetworkInterface.GetAllNetworkInterfaces().Where(adapter => adapter.OperationalStatus == OperationalStatus.Up)
                .SelectMany(adapter => adapter.GetIPProperties().UnicastAddresses)
                .Any(item => item.Address.AddressFamily == AddressFamily.InterNetwork && item.Address.Equals(target));
        }
        public bool Allowed(string url, string role, bool gameOnly = false)
        {
            if (!SameOrigin(url)) return false;
            var path = new Uri(url).AbsolutePath;
            return path == "/" + role + "/game" || (!gameOnly && path == "/" + role);
        }
        public object Bridge(NativeWindow window, Dictionary<string, object> message, string source)
        {
            // WebView2's message Source can remain the committed document URL
            // after React changes its route with pushState. Both it and the
            // current route must retain this native window's origin and role.
            if (!window.Managed || window.IsDisposed || !Allowed(source, window.Role) || !Allowed(window.Url, window.Role)) throw new UnauthorizedAccessException("仅 TableMax 桌面主窗口可以调用桌面功能。");
            var method = Json.String(message, "method");
            var parameters = Json.Value(message, "params") as object[];
            if (parameters == null) throw new ArgumentException("桌面请求参数无效。");
            switch (method)
            {
                case "window.fullscreen":
                    if (parameters.Length != 0) throw new ArgumentException("Invalid window request.");
                    window.ToggleFullscreen(); return null;
                case "window.menu":
                    if (parameters.Length != 0) throw new ArgumentException("Invalid window request.");
                    window.ToggleMenu(); return null;
                case "display.read": if (parameters.Length != 0) throw new ArgumentException("显示设置参数无效。"); return window.ApplyDisplay();
                case "display.update":
                    if (parameters.Length != 1) throw new ArgumentException("显示设置参数无效。");
                    var preferences = DisplayPreferences.Parse(parameters[0]); Displays.Save(window.Role, preferences); window.Preferences = preferences; return window.ApplyDisplay();
                case "audio.connect":
                    if (parameters.Length != 0 || !Allowed(window.Url, window.Role, true)) throw new UnauthorizedAccessException("Audio output is unavailable.");
                    window.AudioReady = true; BroadcastAudio(); return AudioOwner() == window;
                case "audio.disconnect":
                    if (parameters.Length != 0) throw new ArgumentException("Invalid audio request.");
                    window.AudioReady = false; BroadcastAudio(); return null;
                case "audio.claim":
                    if (parameters.Length != 1 || !(parameters[0] is string key) || key.Length < 1 || key.Length > 240 || !Allowed(window.Url, window.Role, true)) throw new ArgumentException("Invalid audio event.");
                    if (AudioOwner() != window || played.Contains(key)) return false;
                    played.Add(key); playedOrder.Enqueue(key); if (playedOrder.Count > 256) played.Remove(playedOrder.Dequeue()); return true;
                default: throw new ArgumentException("Unknown desktop request.");
            }
        }
        private NativeWindow AudioOwner() => windows.Where(window => !window.IsDisposed && window.Managed && window.AudioReady).OrderBy(window => window.Role == "public" ? 0 : 1).FirstOrDefault();
        public void BroadcastAudio()
        {
            var owner = AudioOwner();
            foreach (var window in windows.ToArray()) if (!window.IsDisposed && window.Managed) window.Changed("audio", window == owner);
        }
        public void UpdatePower()
        {
            if (dispatch.InvokeRequired) { Post(UpdatePower); return; }
            powerActive = !quitting && !booting && service != null;
            var publicVisible = windows.Any(window => window.Managed && window.Role == "public" && window.Visible && window.WindowState != FormWindowState.Minimized && !Background);
            NativeMethods.SetThreadExecutionState(0x80000000u | (powerActive ? 1u : 0u) | (publicVisible && !quitting ? 2u : 0u));
        }
        private void OnPowerModeChanged(object sender, PowerModeChangedEventArgs args)
        {
            if (args.Mode == PowerModes.Resume) Post(() => { foreach (var window in windows.ToArray()) window.NotifyOnline(); UpdatePower(); });
        }
        private void OnDisplaySettingsChanged(object sender, EventArgs args) => Post(() => { foreach (var window in windows.ToArray()) window.ApplyDisplay(); });
        public void Post(Action action) { if (!dispatch.IsDisposed && dispatch.IsHandleCreated) try { dispatch.BeginInvoke(action); } catch (InvalidOperationException) { } }
        public void Log(string text)
        {
            try { var directory = Path.Combine(DataDirectory, "logs"); Directory.CreateDirectory(directory); File.AppendAllText(Path.Combine(directory, "desktop.log"), DateTime.UtcNow.ToString("o") + " " + text + "\n"); } catch { }
            Console.Error.WriteLine(text);
        }
        private async Task Failure(Exception cause)
        {
            Program.ExitCode = 1;
            if (Testing) Log(cause.ToString());
            var detail = StartupError.Describe(cause, DataDirectory); Log(detail);
            if (!Background && !(cause is MissingRuntimeException)) MessageBox.Show(detail, "TableMax 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            await Quit();
        }
        public async Task Quit()
        {
            if (quitting) return;
            quitting = true; UpdatePower();
            foreach (var window in windows.ToArray()) window.Close();
            if (service != null) { await service.Stop(); service.Dispose(); service = null; }
            ExitThread();
        }
        public void Write(object value) { lock (outputLock) Console.WriteLine(Json.Encode(value)); }
        private async Task ReadTestCommands()
        {
            try
            {
                string line;
                while ((line = await Console.In.ReadLineAsync()) != null)
                {
                    if (line.Length > 65536) throw new ArgumentException("Test request too large.");
                    var message = Json.Decode(line);
                    Post(async () =>
                    {
                        var id = Json.Value(message, "id");
                        try { Write(new { id, result = await TestCommand(Json.String(message, "method"), Json.Value(message, "params") as Dictionary<string, object> ?? new Dictionary<string, object>()) }); }
                        catch (Exception cause) { Write(new { id, error = cause.Message }); }
                    });
                }
            }
            catch (Exception cause) { Log("Test transport: " + cause.Message); }
            finally { Post(async () => { await Quit(); }); }
        }
        private async Task<object> TestCommand(string method, Dictionary<string, object> parameters)
        {
            switch (method)
            {
                case "runtime":
                    var versions = new Dictionary<string, object>(Json.Object(Json.Value(health, "runtime", new Dictionary<string, object>())));
                    versions.Remove("electron");
                    versions["webview2"] = Environment.BrowserVersionString;
                    var metrics = new List<object> { Metrics(Process.GetCurrentProcess(), "Browser", "TableMax desktop") };
                    if (service != null) try { metrics.Add(Metrics(Process.GetProcessById(service.Id), "Utility", "TableMax local service")); } catch (ArgumentException) { }
                    return new { packaged = IsPackaged, appVersion = "1.0.2", origin = Origin, desktopPid = Process.GetCurrentProcess().Id, servicePid = service?.Id ?? 0, cdpPort = CdpPort, versions, health, displays = Screen.AllScreens.Select((screen, index) => new { id = index + 1, bounds = RectangleValue(screen.Bounds), workArea = RectangleValue(screen.WorkingArea), scaleFactor = NativeMethods.Scale(hostWindow?.Handle ?? dispatch.Handle) }).ToArray(), powerBlockerActive = powerActive, metrics };
                case "windows": return windows.Where(window => !window.IsDisposed).Select(window => window.Snapshot()).ToArray();
                case "open-public": return (await OpenPublic(Json.String(parameters, "path", "/public"))).Snapshot();
                case "show-host": return (await ShowHost()).Snapshot();
                case "new-window":
                    var url = Json.String(parameters, "url", Origin + "/public");
                    var path = new Uri(url).AbsolutePath;
                    var role = path.StartsWith("/player") ? "player" : path.StartsWith("/public") ? "public" : "debug";
                    var managed = Json.Bool(parameters, "managed") && (role == "public" || path == "/host" || path == "/host/game");
                    if (managed && path.StartsWith("/host")) role = "host";
                    return (await Open(url, role, (int)Json.Number(parameters, "width", 1280), (int)Json.Number(parameters, "height", 800), managed, Json.String(parameters, "partition", "desktop"))).Snapshot();
                case "window":
                    var window = windows.FirstOrDefault(item => item.Id == Json.Number(parameters, "id"));
                    if (window == null) throw new ArgumentException("Unknown window.");
                    return await window.TestOperation(parameters);
                case "quit": Post(async () => { await Quit(); }); return true;
                default: throw new ArgumentException("Unknown test method.");
            }
        }
        private static object Metrics(Process process, string type, string name)
        {
            process.Refresh(); return new { pid = process.Id, type, name, memory = new { workingSetSize = process.WorkingSet64 / 1024, privateBytes = process.PrivateMemorySize64 / 1024 } };
        }
        public static object RectangleValue(System.Drawing.Rectangle rectangle) => new { x = rectangle.X, y = rectangle.Y, width = rectangle.Width, height = rectangle.Height };
        protected override void Dispose(bool disposing)
        {
            if (disposing) { reopen.Unregister(null); SystemEvents.PowerModeChanged -= OnPowerModeChanged; SystemEvents.DisplaySettingsChanged -= OnDisplaySettingsChanged; service?.Dispose(); dispatch.Dispose(); }
            base.Dispose(disposing);
        }
    }
    internal sealed class MissingRuntimeException : Exception
    {
        public MissingRuntimeException(string message) : base(message) { }
    }
}
