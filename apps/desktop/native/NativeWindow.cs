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
        private readonly Icon applicationIcon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        private readonly string profile;
        private readonly string approvedOrigin;
        private readonly bool lanPhone;
        private readonly MenuStrip menu = new MenuStrip();
        private Rectangle normalBounds;
        private FormWindowState normalWindowState;
        private bool fullscreen, applyingDisplay;
        private DisplayGeometry simulated;
        private readonly int initialWidth, initialHeight;
        private string lastMessageSourcePath, lastMessageCurrentPath;
        private string capturedJoinUrl;
        private int capturedJoinCount;
        private string capturedRepositoryUrl;
        private int capturedRepositoryCount;
        private const string RepositoryUrl = "https://github.com/anApalpitate/TableMax";
        private const int BackgroundMaximumPixels = 16384;
        public int Id { get; }
        public string Role { get; }
        public bool Managed { get; }
        public bool AudioReady { get; set; }
        public bool InteractionAudioReady { get; set; }
        public DisplayPreferences Preferences { get; set; }
        public string Url => !IsDisposed && browser.CoreWebView2 != null ? browser.CoreWebView2.Source : "";
        protected override bool ShowWithoutActivation => context?.Testing == true || context?.Background == true;
        protected override CreateParams CreateParams
        {
            get { var value = base.CreateParams; if (context?.Testing == true || context?.Background == true) value.ExStyle |= 0x08000000; if (context?.Background == true) value.ExStyle |= 0x80; return value; }
        }
        public NativeWindow(DesktopContext context, int id, string role, int width, int height, bool managed, string profile, string approvedOrigin, bool lanPhone)
        {
            this.context = context; Id = id; Role = role; Managed = managed; this.profile = profile; this.approvedOrigin = approvedOrigin; this.lanPhone = lanPhone;
            initialWidth = width; initialHeight = height;
            Preferences = context.Displays.Read(role);
            Text = role == "public" ? "TableMax · 公共屏" : "TableMax";
            Icon = applicationIcon;
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
            FormClosed += (_, __) => { AudioReady = false; InteractionAudioReady = false; browser.Dispose(); };
        }
        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) applicationIcon?.Dispose();
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
            // Automated verification remains silent even when it exercises play mode.
            core.IsMuted = context.Testing && System.Environment.GetEnvironmentVariable("TABLEMAX_TEST_AUDIO") != "1";
            core.Settings.AreDevToolsEnabled = context.Testing;
            core.Settings.AreDefaultContextMenusEnabled = context.Testing;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsBuiltInErrorPageEnabled = false;
            core.NewWindowRequested += OnNewWindowRequested;
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
                if (args.IsNewDocument) { AudioReady = false; InteractionAudioReady = false; context.BroadcastAudio(); context.BroadcastInteractionAudio(); }
                ApplyDisplay();
            };
            core.ProcessFailed += (_, __) => { AudioReady = false; InteractionAudioReady = false; context.BroadcastAudio(); context.BroadcastInteractionAudio(); };
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
        private void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs args)
        {
            // No arbitrary popup, player frame or link can launch a desktop URL.
            args.Handled = true;
            if (!Managed || IsDisposed || (Role != "host" && Role != "public") || !args.IsUserInitiated) return;
            var sourceFrame = args.OriginalSourceFrameInfo;
            var source = sourceFrame?.Source;
            var documentUrl = Url;
            if (sourceFrame == null || sourceFrame.FrameId == 0 || sourceFrame.FrameId != browser.CoreWebView2.FrameId ||
                source != documentUrl || !context.Allowed(source, Role)) return;
            if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var target)) return;
            var repository = string.Equals(args.Uri, RepositoryUrl, StringComparison.Ordinal);
            if (!repository &&
                ((target.Scheme != "http" && target.Scheme != "https") ||
                target.UserInfo.Length != 0 || target.AbsolutePath != "/" ||
                target.Query.Length != 0 || target.Fragment.Length != 0)) return;
            var linkAttribute = repository ? "data-tablemax-repository-link" : "data-tablemax-join-link";
            var failureEvent = repository ? "tablemax:repository-open-error" : "tablemax:join-open-error";
            // Complete the popup event before evaluating its document. Holding
            // a deferral while waiting for script execution blocks the click.
            context.Post(async () =>
            {
                try
                {
                    // Consume the React component's trusted top-document click.
                    // Compare the exact current entry or fixed repository link,
                    // so stale URLs and administrator fragments are not exported.
                    var result = await browser.CoreWebView2.ExecuteScriptAsync(@"(() => {
                        const link = document.querySelector('a[" + linkAttribute + @"]');
                        const request = Number(link?.dataset.tablemaxJoinRequest);
                        if (link) delete link.dataset.tablemaxJoinRequest;
                        const age = Date.now() - request;
                        return window === window.top && document.activeElement === link && request > 0 && age >= 0 && age < 2000 ? link.href : null;
                    })()");
                    var current = Json.Decode("{\"url\":" + result + "}");
                    if (IsDisposed || Url != documentUrl || Json.String(current, "url") != target.AbsoluteUri) return;
                    if (context.Testing && System.Environment.GetEnvironmentVariable("TABLEMAX_TEST_CAPTURE_EXTERNAL") == "1")
                    {
                        // Explicit test mode records the approved OS launch target;
                        // browser navigation/authorization is checked separately.
                        if (repository) { capturedRepositoryUrl = target.AbsoluteUri; capturedRepositoryCount++; }
                        else { capturedJoinUrl = target.AbsoluteUri; capturedJoinCount++; }
                    }
                    else Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
                }
                catch (Exception cause)
                {
                    context.Log((repository ? "Open repository: " : "Open player website: ") + cause.GetType().Name);
                    if (!IsDisposed && browser.CoreWebView2 != null)
                        try { await browser.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new Event('" + failureEvent + "'))"); }
                        catch (InvalidOperationException) { }
                }
            });
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
                full.Checked = fullscreen;
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
            if (Managed && Role == "host") program.DropDownItems.Add("存储设置…", null, (_, __) => ShowStorageSettings());
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
        private void ShowStorageSettings()
        {
            using (var dialog = new Form { Text = "TableMax · 存储设置", Width = 660, Height = 245, StartPosition = FormStartPosition.CenterParent, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, MinimizeBox = false, Font = new System.Drawing.Font("Microsoft YaHei UI", 12) })
            {
                var label = new Label { Text = "存档、日志和浏览器缓存目录", Left = 20, Top = 18, Width = 610, Height = 30 };
                var path = new TextBox { Text = context.Storage.DataDirectory, Left = 20, Top = 55, Width = 490, ReadOnly = true };
                var browse = new Button { Text = "选择目录", Left = 520, Top = 52, Width = 110, Height = 38 };
                browse.Click += (_, __) => { using (var folder = new FolderBrowserDialog { Description = "选择 TableMax 存储目录", SelectedPath = path.Text }) if (folder.ShowDialog(dialog) == DialogResult.OK) path.Text = folder.SelectedPath; };
                var note = new Label { Text = "重启后生效。旧存档不会自动搬移或删除；继续旧对局请先复制完整数据。", Left = 20, Top = 100, Width = 610, Height = 55 };
                var save = new Button { Text = "保存配置", Left = 500, Top = 160, Width = 130, Height = 38 };
                save.Click += (_, __) => { try { context.Storage.Save(path.Text); dialog.Close(); } catch (Exception cause) { MessageBox.Show(dialog, cause.Message, "配置未保存", MessageBoxButtons.OK, MessageBoxIcon.Error); } };
                dialog.Controls.AddRange(new Control[] { label, path, browse, note, save }); dialog.AcceptButton = save; dialog.ShowDialog(this);
            }
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
        public object WindowSnapshot() => new { fullscreen };
        public void ToggleFullscreen() => SetFullscreen(!fullscreen);
        public object SetFullscreen(bool value)
        {
            if (fullscreen == value) return WindowSnapshot();
            if (value)
            {
                normalWindowState = WindowState;
                normalBounds = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                var target = Screen.FromHandle(Handle).Bounds;
                fullscreen = true; WindowState = FormWindowState.Normal;
                FormBorderStyle = FormBorderStyle.None;
                if (context.Background) ClientSize = target.Size;
                else Bounds = target;
            }
            else
            {
                fullscreen = false; FormBorderStyle = context.Background ? FormBorderStyle.None : FormBorderStyle.Sizable;
                Bounds = normalBounds;
                WindowState = normalWindowState;
            }
            ApplyDisplay();
            if (Managed && context.Allowed(Url, Role)) Changed("window", WindowSnapshot());
            return WindowSnapshot();
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
            return new { id = Id, role = Role, managed = Managed, url = Url, visible = Visible && !context.Background, rendered = Visible, audioMuted = browser.CoreWebView2.IsMuted, content = new[] { (int)Math.Round(browser.ClientSize.Width / ratio), (int)Math.Round(browser.ClientSize.Height / ratio) }, fullscreen, borderStyle = FormBorderStyle.ToString(), showInTaskbar = ShowInTaskbar, foregroundTest = context.ForegroundTest, windowState = WindowState.ToString(), restoreBounds = DesktopContext.RectangleValue(RestoreBounds), zoom = browser.ZoomFactor, bounds = DesktopContext.RectangleValue(bounds), display = ApplyDisplay(), bridgeSourcePath = lastMessageSourcePath, bridgeCurrentPath = lastMessageCurrentPath, externalJoin = context.Testing ? new { url = capturedJoinUrl, count = capturedJoinCount } : null, externalRepository = context.Testing ? new { url = capturedRepositoryUrl, count = capturedRepositoryCount } : null };
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
                case "fullscreen": SetFullscreen(Json.Bool(parameters, "value", !fullscreen)); break;
                case "menu-fullscreen": ((ToolStripMenuItem)((ToolStripMenuItem)menu.Items[0]).DropDownItems[0]).PerformClick(); break;
                case "window-state":
                    WindowState = Json.String(parameters, "value") == "Maximized" ? FormWindowState.Maximized : FormWindowState.Normal; break;
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
