using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class WindowStartupHarness
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static readonly List<object> Checks = new List<object>();
    private static Dictionary<string, object> Plan;
    private static Assembly Native;
    private static Form Host;
    private static object Context;
    private static bool Started;
    private static int Failures;
    private static readonly Stopwatch Budget = Stopwatch.StartNew();
    private static System.Windows.Forms.Timer Observer;
    private static int ProgramExit = -1;
    private static IntPtr Desktop, OriginalDesktop;
    private static string Text(string key) => (string)Plan[key];
    private static void Require(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
    private static object Field(object target, string name) => target.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public).GetValue(target);
    private static object Call(object target, string name, params object[] values) => target.GetType().GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public).Invoke(target, values);
    private static Dictionary<string, object> Snapshot() => Json.Deserialize<Dictionary<string, object>>(Json.Serialize(Call(Host, "Snapshot")));
    private static async Task Reopen() { await (Task)Call(Context, "ShowHost"); await Task.Delay(120); }
    private static void SetMode(string mode) { Call(Host, "SetMode", mode); }
    private static async Task Check(string id, Func<Task<object>> action)
    {
        if (Failures >= Convert.ToInt32(Plan["failureLimit"])) { Checks.Add(new { id, result = "unexecuted", reason = "failure budget reached" }); return; }
        try { Checks.Add(new { id, result = "passed", details = await action() }); }
        catch (Exception error) { Failures++; Checks.Add(new { id, result = "failed", error = error.ToString() }); }
    }
    private static object RectangleValue(Rectangle value) => new { x = value.X, y = value.Y, width = value.Width, height = value.Height };
    private static async Task<object> Capture(string name)
    {
        Host.Refresh(); await Task.Delay(350);
        var path = Path.Combine(Text("output"), name + "-window.png");
        bool printed;
        using (var bitmap = new Bitmap(Host.Width, Host.Height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(bitmap))
        {
            var dc = graphics.GetHdc();
            try { printed = PrintWindow(Host.Handle, dc, 2); }
            finally { graphics.ReleaseHdc(dc); }
            Require(printed, "PrintWindow failed for own native window");
            bitmap.Save(path, ImageFormat.Png);
        }
        var core = Field(Host, "browser").GetType().GetProperty("CoreWebView2").GetValue(Field(Host, "browser"));
        var formatType = core.GetType().Assembly.GetType("Microsoft.Web.WebView2.Core.CoreWebView2CapturePreviewImageFormat");
        var content = Path.Combine(Text("output"), name + "-content.png");
        using (var stream = new FileStream(content, FileMode.CreateNew))
            await (Task)core.GetType().GetMethod("CapturePreviewAsync").Invoke(core, new[] { Enum.Parse(formatType, "Png"), (object)stream });
        var screen = Screen.FromHandle(Host.Handle);
        return new { window = path, content, printed, bounds = RectangleValue(Host.Bounds), workingArea = RectangleValue(screen.WorkingArea), screen = RectangleValue(screen.Bounds), dpi = GetDpiForWindow(Host.Handle), snapshot = Snapshot() };
    }
    private static async Task Exercise()
    {
        var background = Text("mode") == "background";
        var baseline = Text("mode") == "baseline";
        await Check("initial-window-state-and-work-area", async () =>
        {
            var state = Snapshot();
            Require(Host.WindowState == (background || baseline ? FormWindowState.Normal : FormWindowState.Maximized), "Unexpected initial native state: " + Host.WindowState);
            Require((string)state["mode"] == "windowed" && !(bool)state["fullscreen"], "Startup changed explicit window mode");
            Require(Host.FormBorderStyle == (background ? FormBorderStyle.None : FormBorderStyle.Sizable), "Unexpected startup chrome");
            Require(Host.ShowInTaskbar == !background, "Unexpected startup taskbar policy");
            Require((bool)state["audioMuted"], "Automated native window must remain muted");
            if (!background && !baseline)
            {
                var work = Screen.FromHandle(Host.Handle).WorkingArea;
                var client = Host.RectangleToScreen(Host.ClientRectangle);
                Require(Host.Bounds.Contains(work), "Maximized native bounds do not cover current work area");
                Require(work.Contains(client), "Maximized client area overlaps reserved work area");
                Require(work.Width - client.Width <= 24 && work.Height - client.Height <= 80, "Maximized client does not use the available work area");
            }
            return await Capture(background ? "background" : baseline ? "before" : "after");
        });
        if (background || baseline) return;
        await Check("maximized-minimize-hide-and-reopen", async () =>
        {
            var handle = Host.Handle;
            Host.WindowState = FormWindowState.Minimized; await Reopen();
            Require(Host.WindowState == FormWindowState.Maximized, "Reopen lost maximized state");
            Host.Hide(); await Reopen();
            Require(Host.Visible && Host.WindowState == FormWindowState.Maximized && Host.Handle == handle, "Hide/reopen changed state or native identity");
            return Snapshot();
        });
        await Check("fullscreen-restores-maximized-state", async () =>
        {
            var restore = Host.RestoreBounds;
            SetMode("fullscreen"); await Task.Delay(120);
            Require((bool)Snapshot()["fullscreen"] && Host.Bounds == Screen.FromHandle(Host.Handle).Bounds, "Explicit fullscreen did not fill the current screen");
            Host.WindowState = FormWindowState.Minimized; await Reopen();
            Require((bool)Snapshot()["fullscreen"] && Host.WindowState == FormWindowState.Normal, "Reopen replaced explicit fullscreen");
            SetMode("windowed"); await Task.Delay(120);
            Require(Host.WindowState == FormWindowState.Maximized && Host.RestoreBounds == restore, "Leaving fullscreen lost maximized restore geometry");
            return Snapshot();
        });
        await Check("explicit-windowed-geometry-survives-reopen", async () =>
        {
            Host.WindowState = FormWindowState.Normal;
            var area = Screen.FromHandle(Host.Handle).WorkingArea;
            Host.Bounds = new Rectangle(area.X + 40, area.Y + 40, Math.Min(940, area.Width - 80), Math.Min(660, area.Height - 80));
            var expected = Host.Bounds;
            Host.WindowState = FormWindowState.Minimized; await Reopen();
            Require(Host.WindowState == FormWindowState.Normal && Host.Bounds == expected, "Reopen overrode an explicitly sized normal window");
            SetMode("fullscreen"); SetMode("windowed");
            Require(Host.WindowState == FormWindowState.Normal && Host.Bounds == expected, "Fullscreen changed explicit normal restore geometry");
            return new { expected = RectangleValue(expected), state = Snapshot() };
        });
        await Check("explicit-borderless-mode-survives-reopen", async () =>
        {
            SetMode("borderless"); var expected = Host.Bounds;
            Host.WindowState = FormWindowState.Minimized; await Reopen();
            Require((string)Snapshot()["mode"] == "borderless" && Host.FormBorderStyle == FormBorderStyle.None && Host.WindowState == FormWindowState.Normal && Host.Bounds == expected, "Reopen overrode explicit borderless geometry");
            SetMode("fullscreen"); Call(Host, "SetFullscreen", false);
            Require((string)Snapshot()["mode"] == "borderless" && Host.Bounds == expected, "Fullscreen did not return to the explicit borderless window");
            SetMode("windowed");
            return Snapshot();
        });
        await Check("player-window-keeps-requested-size", async () =>
        {
            var task = (Task)Call(Context, "Open", Text("url").Replace("/host", "/player"), "player", 440, 680, false, "startup-player");
            await task;
            var player = (Form)task.GetType().GetProperty("Result").GetValue(task);
            Require(player.WindowState == FormWindowState.Normal, "Startup maximized a player test window");
            var value = Call(player, "Snapshot"); player.Close(); return value;
        });
        await Check("display-geometry-dpi-and-preference-separation", async () =>
        {
            var values = new List<object>();
            foreach (var scale in new[] { 1.0, 1.25, 1.5 })
            {
                var parameters = Json.Deserialize<Dictionary<string, object>>(Json.Serialize(new { operation = "geometry", geometry = new { viewport = new { width = 3840 / scale, height = 2160 / scale }, screen = new { width = 3840 / scale, height = 2160 / scale, scaleFactor = scale } } }));
                await (Task)Call(Host, "TestOperation", parameters);
                var state = Snapshot();
                var display = (Dictionary<string, object>)state["display"];
                Require(Math.Abs(Convert.ToDouble(display["zoomFactor"]) - 2 / scale) < 1e-8, "DPI-aware automatic scaling changed");
                values.Add(new { requestedScale = scale, state });
            }
            await (Task)Call(Host, "TestOperation", new Dictionary<string, object> { ["operation"] = "geometry", ["clear"] = true });
            return values;
        });
    }
    private static async void Observe(object sender, EventArgs args)
    {
        if (Started) return;
        Host = Application.OpenForms.Cast<Form>().FirstOrDefault(form => form.GetType().FullName == "TableMax.Desktop.NativeWindow");
        if (Host != null) Context = Field(Host, "context");
        if (Host == null || (bool)Field(Context, "booting"))
        {
            if (Budget.ElapsedMilliseconds < 35000) return;
            Started = true; Observer.Stop(); Failures++; Checks.Add(new { id = "native-startup", result = "failed", error = "Production Program.Main startup exceeded 35 seconds" });
            if (Context != null) await (Task)Call(Context, "Quit"); else Application.Exit(); return;
        }
        Started = true; Observer.Stop();
        try { await Exercise(); }
        catch (Exception error) { Failures++; Checks.Add(new { id = "harness", result = "failed", error = error.ToString() }); }
        finally { await (Task)Call(Context, "Quit"); }
    }
    private static void RunProgram()
    {
        try
        {
            AppDomain.CurrentDomain.AssemblyResolve += (_, request) =>
            {
                var path = Path.Combine(Path.GetDirectoryName(Text("assembly")), new AssemblyName(request.Name).Name + ".dll");
                return File.Exists(path) ? Assembly.LoadFrom(path) : null;
            };
            Native = Assembly.LoadFrom(Text("assembly"));
            Observer = new System.Windows.Forms.Timer { Interval = 60 }; Observer.Tick += Observe;
            EventHandler start = null;
            start = (_, __) => { Application.Idle -= start; Observer.Start(); };
            Application.Idle += start;
            try
            {
                var flags = new List<string> { "--foundation-test" };
                if (Text("mode") != "background") flags.Add("--tablemax-test-foreground");
                ProgramExit = (int)Native.GetType("TableMax.Desktop.Program").GetMethod("Main", BindingFlags.Static | BindingFlags.NonPublic).Invoke(null, new object[] { flags.ToArray() });
            }
            finally { Application.Idle -= start; Observer.Stop(); Observer.Tick -= Observe; Observer.Dispose(); }
        }
        catch (Exception error) { Failures++; Checks.Add(new { id = "program-entry", result = "failed", error = error.ToString() }); }
    }
    [MTAThread]
    private static int Main(string[] args)
    {
        Plan = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(args[0], Encoding.UTF8));
        try
        {
            OriginalDesktop = GetThreadDesktop(GetCurrentThreadId());
            Desktop = CreateDesktop("TMWindow_" + Guid.NewGuid().ToString("N"), null, IntPtr.Zero, 0, 0x01FF, IntPtr.Zero);
            Require(Desktop != IntPtr.Zero && SetThreadDesktop(Desktop), "Cannot create or select a private desktop: " + Marshal.GetLastWin32Error());
            // A fresh STA inherits this desktop before COM can create its hidden
            // window. Moving an already initialized STA fails with ERROR_BUSY.
            var ui = new Thread(RunProgram); ui.SetApartmentState(ApartmentState.STA); ui.Start(); ui.Join();
        }
        catch (Exception error) { Failures++; Checks.Add(new { id = "private-desktop-or-program-entry", result = "failed", error = error.ToString() }); }
        finally
        {
            var restored = OriginalDesktop != IntPtr.Zero && SetThreadDesktop(OriginalDesktop);
            var closed = Desktop != IntPtr.Zero && CloseDesktop(Desktop);
            File.WriteAllText(Text("result"), Json.Serialize(new { result = Failures == 0 && ProgramExit == 0 ? "passed" : "failed", programExit = ProgramExit, checks = Checks, failures = Failures, elapsedMs = Budget.ElapsedMilliseconds, switchedDesktop = false, restoredOriginalDesktop = restored, closedPrivateDesktop = closed }), new UTF8Encoding(false));
        }
        return Failures == 0 && ProgramExit == 0 ? 0 : 1;
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateDesktop(string name, string device, IntPtr mode, uint flags, uint access, IntPtr security);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool SetThreadDesktop(IntPtr desktop);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("user32.dll")] private static extern IntPtr GetThreadDesktop(uint thread);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr handle);
    [DllImport("user32.dll")] private static extern bool PrintWindow(IntPtr handle, IntPtr dc, uint flags);
}
