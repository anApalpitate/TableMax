using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.ComponentModel;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace TableMax.Desktop
{
    internal sealed class NativeWindow : Form
    {
        private readonly DesktopContext context;
        private readonly WebView2 browser = new WebView2();
        private readonly string profile;
        private readonly string approvedOrigin;
        private readonly bool lanPhone;
        private readonly MenuStrip menu = new MenuStrip();
        private Rectangle normalBounds;
        private bool fullscreen, applyingDisplay;
        private DisplayGeometry simulated;
        private readonly int initialWidth, initialHeight;
        private string lastMessageSourcePath, lastMessageCurrentPath;
        private const int BackgroundMaximumPixels = 16384;
        public int Id { get; }
        public string Role { get; }
        public bool Managed { get; }
        public bool AudioReady { get; set; }
        public DisplayPreferences Preferences { get; set; }
        public string Url => !IsDisposed && browser.CoreWebView2 != null ? browser.CoreWebView2.Source : "";
        protected override bool ShowWithoutActivation => context?.Background == true;
        protected override CreateParams CreateParams
        {
            get { var value = base.CreateParams; if (context?.Background == true) value.ExStyle |= 0x08000080; return value; }
        }
        public NativeWindow(DesktopContext context, int id, string role, int width, int height, bool managed, string profile, string approvedOrigin, bool lanPhone)
        {
            this.context = context; Id = id; Role = role; Managed = managed; this.profile = profile; this.approvedOrigin = approvedOrigin; this.lanPhone = lanPhone;
            initialWidth = width; initialHeight = height;
            Preferences = context.Displays.Read(role);
            Text = role == "public" ? "TableMax · 公共屏" : "TableMax";
            AutoScaleMode = AutoScaleMode.None;
            StartPosition = FormStartPosition.Manual;
            Size = new Size(width, height);
            MinimumSize = new Size(320, 240);
            if (context.Background) { FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; Location = new Point(-20000, -20000); }
            else
            {
                var screen = role == "public" ? Screen.AllScreens.FirstOrDefault(item => !item.Primary) ?? Screen.PrimaryScreen : Screen.PrimaryScreen;
                Location = new Point(screen.WorkingArea.X + 30, screen.WorkingArea.Y + 30);
            }
            if (context.Background) MaximumSize = new Size(BackgroundMaximumPixels, BackgroundMaximumPixels);
            browser.Dock = DockStyle.Fill;
            browser.DefaultBackgroundColor = Color.White;
            Controls.Add(browser);
            BuildMenu();
            Resize += (_, __) => { ApplyDisplay(); context.UpdatePower(); };
            Move += (_, __) => ApplyDisplay();
            DpiChanged += (_, __) => ApplyDisplay();
            VisibleChanged += (_, __) => context.UpdatePower();
            FormClosed += (_, __) => { AudioReady = false; browser.Dispose(); };
        }
        public async Task Initialize(string url)
        {
            // An offscreen, nonactivating native HWND lets WebView2 render actual frames.
            // A never-shown WebView2 controller does not render screenshots reliably.
            Show();
            if (!context.Background)
            {
                var initialScale = NativeMethods.Scale(Handle);
                Size = new Size((int)Math.Round(initialWidth * initialScale), (int)Math.Round(initialHeight * initialScale));
            }
            var options = context.Environment.CreateCoreWebView2ControllerOptions();
            options.ProfileName = profile;
            await browser.EnsureCoreWebView2Async(context.Environment, options);
            var core = browser.CoreWebView2;
            core.Settings.AreDevToolsEnabled = context.Testing;
            core.Settings.AreDefaultContextMenusEnabled = context.Testing;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsBuiltInErrorPageEnabled = false;
            core.NewWindowRequested += (_, args) => { args.Handled = true; };
            core.PermissionRequested += (_, args) => { args.State = CoreWebView2PermissionState.Deny; args.Handled = true; };
            core.DownloadStarting += (_, args) => { args.Cancel = true; };
            core.NavigationStarting += (_, args) =>
            {
                if (!AllowedNavigation(args.Uri)) { args.Cancel = true; return; }
                if (Managed && Role == "host" && context.Allowed(args.Uri, "public"))
                {
                    args.Cancel = true;
                    context.Post(async () => { try { await context.OpenPublic(new Uri(args.Uri).AbsolutePath); } catch (Exception cause) { context.Log(cause.Message); } });
                }
            };
            core.FrameNavigationStarting += (_, args) => { if (args.Uri != "about:blank" && !AllowedNavigation(args.Uri)) args.Cancel = true; };
            core.SourceChanged += (_, args) =>
            {
                // Only a committed document clears the old game audio membership.
                if (args.IsNewDocument) { AudioReady = false; context.BroadcastAudio(); }
                ApplyDisplay();
            };
            core.ProcessFailed += (_, __) => { AudioReady = false; context.BroadcastAudio(); };
            core.WebMessageReceived += OnWebMessage;
            core.NavigationCompleted += (_, __) => ApplyDisplay();
            browser.ZoomFactorChanged += (_, __) => { if (!applyingDisplay && Managed) ApplyDisplay(); };
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("TableMax.Desktop.Bridge.js"))
            using (var reader = new StreamReader(stream))
                await core.AddScriptToExecuteOnDocumentCreatedAsync(reader.ReadToEnd().Replace("__WINDOW_ID__", Id.ToString()).Replace("__MANAGED__", Managed ? "true" : "false").Replace("__TESTING__", context.Testing ? "true" : "false"));
            var loaded = new TaskCompletionSource<bool>();
            EventHandler<CoreWebView2NavigationCompletedEventArgs> load = null;
            load = (_, args) =>
            {
                core.NavigationCompleted -= load;
                if (args.IsSuccess) loaded.TrySetResult(true);
                else loaded.TrySetException(new IOException("WebView2 页面无法加载：" + args.WebErrorStatus));
            };
            core.NavigationCompleted += load;
            core.Navigate(url);
            if (await Task.WhenAny(loaded.Task, Task.Delay(20000)) != loaded.Task) throw new TimeoutException("WebView2 page load timed out.");
            await loaded.Task;
            // Managed window content geometry is physical pixels divided by monitor DPI.
            // Test windows have no chrome, so requested fixture dimensions are exact.
            if (context.Background)
            {
                var initialScale = NativeMethods.Scale(Handle);
                ClientSize = new Size((int)Math.Round(initialWidth * initialScale), (int)Math.Round(initialHeight * initialScale));
            }
            if (Role == "public" && Managed && !context.Background && Screen.AllScreens.Length > 1) ToggleFullscreen();
            ApplyDisplay();
        }
        private void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            if (!Managed || IsDisposed) return;
            if (context.Testing)
            {
                lastMessageSourcePath = Uri.TryCreate(args.Source, UriKind.Absolute, out var source) ? source.AbsolutePath : null;
                lastMessageCurrentPath = Uri.TryCreate(Url, UriKind.Absolute, out var current) ? current.AbsolutePath : null;
            }
            object id = null;
            try
            {
                if (args.WebMessageAsJson.Length > 8192) throw new ArgumentException("桌面请求过大。");
                var message = Json.Decode(args.WebMessageAsJson);
                id = Json.Value(message, "id");
                if (!(id is int sequence) || sequence < 1 || message.Count != 3) throw new ArgumentException("桌面请求无效。");
                var result = context.Bridge(this, message, args.Source);
                browser.CoreWebView2.PostWebMessageAsJson(Json.Encode(new { id, result }));
            }
            catch (Exception cause)
            {
                if (id != null && !IsDisposed && browser.CoreWebView2 != null) browser.CoreWebView2.PostWebMessageAsJson(Json.Encode(new { id, error = cause.Message }));
            }
        }
        private bool AllowedNavigation(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed) || parsed.UserInfo.Length != 0 || parsed.GetLeftPart(UriPartial.Authority) != approvedOrigin) return false;
            return !lanPhone || new[] { "/player", "/player/game" }.ContainsValue(parsed.AbsolutePath);
        }
        private DisplayGeometry Geometry()
        {
            if (simulated != null) return simulated;
            var ratio = NativeMethods.Scale(Handle);
            var screen = Screen.FromHandle(Handle);
            return new DisplayGeometry { Width = browser.ClientSize.Width / ratio, Height = browser.ClientSize.Height / ratio, ScreenWidth = screen.Bounds.Width / ratio, ScreenHeight = screen.Bounds.Height / ratio, ScaleFactor = ratio };
        }
        public object ApplyDisplay()
        {
            if (IsDisposed || browser.IsDisposed) return null;
            var snapshot = Geometry().Snapshot(Preferences);
            if (Managed && browser.CoreWebView2 != null)
            {
                var factor = Json.Number(Json.Decode(Json.Encode(snapshot)), "zoomFactor", 1);
                applyingDisplay = true;
                try { if (Math.Abs(browser.ZoomFactor - factor) > 1e-9) browser.ZoomFactor = factor; }
                finally { applyingDisplay = false; }
                if (context.Allowed(Url, Role)) Changed("display", snapshot);
            }
            return snapshot;
        }
        public void Changed(string channel, object value)
        {
            if (IsDisposed || browser.IsDisposed || browser.CoreWebView2 == null) return;
            try { browser.CoreWebView2.PostWebMessageAsJson(Json.Encode(new { type = "changed", channel, value })); }
            catch (InvalidOperationException) { }
        }
        public void NotifyOnline()
        {
            if (!IsDisposed && browser.CoreWebView2 != null) _ = browser.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new Event('online'))");
        }
        private void BuildMenu()
        {
            var screens = new ToolStripMenuItem("屏幕(&S)");
            var full = new ToolStripMenuItem("切换全屏") { ShortcutKeys = Keys.F11 }; full.Click += (_, __) => ToggleFullscreen(); screens.DropDownItems.Add(full);
            screens.DropDownOpening += (_, __) =>
            {
                while (screens.DropDownItems.Count > 1) screens.DropDownItems.RemoveAt(1);
                foreach (var screen in Screen.AllScreens.Select((value, index) => new { value, index }))
                {
                    var item = new ToolStripMenuItem("移到显示器 " + (screen.index + 1) + "（" + screen.value.Bounds.Width + "×" + screen.value.Bounds.Height + "）");
                    item.Click += (_, __) => MoveToScreen(screen.value); screens.DropDownItems.Add(item);
                }
            };
            var program = new ToolStripMenuItem("程序(&P)");
            program.DropDownItems.Add("打开房主管理", null, (_, __) => context.Post(async () => { await context.ShowHost(); }));
            program.DropDownItems.Add("打开公共屏", null, (_, __) => context.Post(async () =>
            {
                try { await context.OpenPublic(Uri.TryCreate(Url, UriKind.Absolute, out var current) && current.AbsolutePath.EndsWith("/game", StringComparison.Ordinal) ? "/public/game" : "/public"); }
                catch (Exception cause) { context.Log(cause.Message); }
            }));
            program.DropDownItems.Add("打开日志目录", null, (_, __) =>
            {
                var logs = Path.Combine(context.DataDirectory, "logs"); Directory.CreateDirectory(logs);
                Process.Start(new ProcessStartInfo(logs) { UseShellExecute = true });
            });
            program.DropDownItems.Add("退出", null, (_, __) => context.Post(async () => { await context.Quit(); }));
            menu.Items.Add(screens); menu.Items.Add(program); menu.Visible = false;
            menu.MenuDeactivate += (_, __) => { menu.Visible = false; ApplyDisplay(); };
            MainMenuStrip = menu; Controls.Add(menu);
        }
        protected override bool ProcessCmdKey(ref Message message, Keys keyData)
        {
            if (keyData == Keys.F11) { ToggleFullscreen(); return true; }
            if (keyData == Keys.Menu || keyData == (Keys.Alt | Keys.S)) { ToggleMenu(); return true; }
            return base.ProcessCmdKey(ref message, keyData);
        }
        [StructLayout(LayoutKind.Sequential)]
        private struct NativePoint { public int X, Y; }
        [StructLayout(LayoutKind.Sequential)]
        private struct MinMaxInfo { public NativePoint Reserved, MaximumSize, MaximumPosition, MinimumTrackSize, MaximumTrackSize; }
        protected override void WndProc(ref Message message)
        {
            base.WndProc(ref message);
            if (context?.Background == true && message.Msg == 0x24 && message.LParam != IntPtr.Zero)
            {
                var limits = Marshal.PtrToStructure<MinMaxInfo>(message.LParam);
                limits.MaximumTrackSize = new NativePoint { X = BackgroundMaximumPixels, Y = BackgroundMaximumPixels };
                Marshal.StructureToPtr(limits, message.LParam, false);
                message.Result = IntPtr.Zero;
            }
        }
        protected override void SetBoundsCore(int x, int y, int width, int height, BoundsSpecified specified)
        {
            // Framework 4.8 Form.SetBoundsCore clamps to the real monitor's
            // MaxWindowTrackSize before it calls the native HWND. Validation
            // windows need actual larger pixels, independently of that monitor.
            if (context?.Background == true && IsHandleCreated)
            {
                if (!NativeMethods.SetWindowPos(Handle, IntPtr.Zero, x, y, width, height, 0x0014)) throw new Win32Exception(Marshal.GetLastWin32Error());
                return;
            }
            base.SetBoundsCore(x, y, width, height, specified);
        }
        public void ToggleMenu()
        {
            menu.Visible = !menu.Visible;
            if (menu.Visible) menu.Focus();
            ApplyDisplay();
        }
        public void ToggleFullscreen()
        {
            if (!fullscreen)
            {
                normalBounds = Bounds; fullscreen = true; WindowState = FormWindowState.Normal;
                FormBorderStyle = FormBorderStyle.None;
                if (context.Background) ClientSize = Screen.FromHandle(Handle).Bounds.Size;
                else Bounds = Screen.FromHandle(Handle).Bounds;
            }
            else
            {
                fullscreen = false; FormBorderStyle = context.Background ? FormBorderStyle.None : FormBorderStyle.Sizable;
                Bounds = normalBounds;
            }
            ApplyDisplay();
        }
        private void MoveToScreen(Screen screen)
        {
            if (fullscreen) ToggleFullscreen();
            var size = new Size(Math.Min(1280, screen.WorkingArea.Width), Math.Min(800, screen.WorkingArea.Height));
            Bounds = new Rectangle(context.Background ? new Point(-20000, -20000) : screen.WorkingArea.Location, size); ApplyDisplay();
        }
        public object Snapshot()
        {
            var ratio = NativeMethods.Scale(Handle);
            var bounds = Bounds;
            return new { id = Id, role = Role, managed = Managed, url = Url, visible = Visible && !context.Background, rendered = Visible, content = new[] { (int)Math.Round(browser.ClientSize.Width / ratio), (int)Math.Round(browser.ClientSize.Height / ratio) }, fullscreen, zoom = browser.ZoomFactor, bounds = DesktopContext.RectangleValue(bounds), display = ApplyDisplay(), bridgeSourcePath = lastMessageSourcePath, bridgeCurrentPath = lastMessageCurrentPath };
        }
        public async Task<object> TestOperation(Dictionary<string, object> parameters)
        {
            switch (Json.String(parameters, "operation"))
            {
                case "resize":
                    var scale = NativeMethods.Scale(Handle);
                    ClientSize = new Size((int)Math.Round(Json.Number(parameters, "width", 1280) * scale), (int)Math.Round(Json.Number(parameters, "height", 800) * scale)); break;
                case "set-bounds":
                    var bounds = Json.Value(parameters, "bounds") as Dictionary<string, object> ?? parameters;
                    if (fullscreen) ToggleFullscreen();
                    Bounds = new Rectangle(context.Background ? -20000 : (int)Json.Number(bounds, "x"), context.Background ? -20000 : (int)Json.Number(bounds, "y"), (int)Json.Number(bounds, "width", 1280), (int)Json.Number(bounds, "height", 800)); break;
                case "fullscreen": if (Json.Bool(parameters, "value", !fullscreen) != fullscreen) ToggleFullscreen(); break;
                case "close": Close(); return true;
                case "hide": if (!context.Background) Hide(); return true;
                case "show": Show(); break;
                case "reload": browser.Reload(); break;
                case "navigate": browser.CoreWebView2.Navigate(Json.String(parameters, "url")); break;
                case "zoom": browser.ZoomFactor = Json.Number(parameters, "zoom", 1); break;
                case "geometry":
                    var geometry = Json.Value(parameters, "geometry") as Dictionary<string, object> ?? parameters;
                    if (Json.Bool(parameters, "clear")) simulated = null;
                    else
                    {
                        var viewport = Json.Object(Json.Value(geometry, "viewport")); var screen = Json.Object(Json.Value(geometry, "screen"));
                        var factor = Json.Number(screen, "scaleFactor", 1);
                        var next = new DisplayGeometry { Width = Json.Number(viewport, "width"), Height = Json.Number(viewport, "height"), ScreenWidth = Json.Number(screen, "width"), ScreenHeight = Json.Number(screen, "height"), ScaleFactor = factor };
                        if (next.Width < 1 || next.Height < 1 || factor < 0.5 || factor > 4) throw new ArgumentException("Invalid simulated geometry.");
                        simulated = next;
                    }
                    break;
                case "move": MoveToScreen(Screen.AllScreens[Math.Max(0, Math.Min(Screen.AllScreens.Length - 1, (int)Json.Number(parameters, "screen", 1) - 1))]); break;
                case "execute": return await browser.CoreWebView2.ExecuteScriptAsync(Json.String(parameters, "script", "null"));
                default: throw new ArgumentException("Unknown window operation.");
            }
            ApplyDisplay(); return Snapshot();
        }
    }
}
