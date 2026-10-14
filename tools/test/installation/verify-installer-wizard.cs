using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;
using Microsoft.Win32;
using Accessibility;

// Independent test entry point. No product code or installer commit entry point is linked.
internal static class InstallerWizardHarness
{
    private const string Notice = "不推荐安装在C盘，因为这是一个有良心的安装包";
    private const string DesktopTask = "创建桌面快捷方式";
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };
    private static readonly List<object> Checks = new List<object>();
    private static readonly List<object> Captures = new List<object>();
    private static readonly Stopwatch Budget = Stopwatch.StartNew();
    private static Dictionary<string, object> Plan;
    private static IntPtr Job, Desktop, OriginalDesktop;
    private static string Work, Sid;
    private static IntPtr LastWindow;

    [MTAThread]
    private static int Main(string[] args)
    {
        // Process-local capture coordinates must be physical pixels at the actual window DPI.
        Require(SetProcessDpiAwarenessContext(new IntPtr(-4)), "Harness PerMonitorV2 initialization failed: " + Marshal.GetLastWin32Error());
        if (args.Length == 1 && args[0] == "--probe-child") return ProbeChild();
        var result = new Dictionary<string, object> { { "passed", false }, { "checks", Checks }, { "captures", Captures }, { "remainingOwnProcesses", -1 }, { "captureDpiContext", "PER_MONITOR_AWARE_V2" } };
        int exit = 1;
        try
        {
            Require(args.Length == 2 && args[0] == "--plan", "Only a scoped plan is accepted");
            Plan = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(args[1], Encoding.UTF8));
            string[] keys = { "schemaVersion", "mode", "work", "temporary", "captures", "target", "installer", "installerSha256", "productId" };
            Require(Plan.Count == keys.Length && keys.All(Plan.ContainsKey), "Unknown plan field");
            Require(Convert.ToInt32(Plan["schemaVersion"]) == 1, "Unknown plan version");
            Require(Text("mode") == "api-probe" || Text("mode") == "installer-wizard", "Unknown plan mode");
            Work = Path.GetFullPath(Text("work"));
            Require(Directory.Exists(Work) && Path.GetFileName(Work).StartsWith("installer-wizard-", StringComparison.Ordinal), "Fresh wizard work required");
            Safe(Work);
            foreach (string key in new[] { "temporary", "captures", "target", "installer" }) Scoped(Text(key));
            Require(!Directory.Exists(Text("target")) && !File.Exists(Text("target")), "Target must not exist");
            Require(Hash(Text("installer")) == Text("installerSha256"), "Installer bytes changed");
            Require(Text("productId") == "{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}" || Text("productId") == "{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}", "Unknown product identity");
            var principal = new WindowsPrincipal(WindowsIdentity.GetCurrent());
            Require(!principal.IsInRole(WindowsBuiltInRole.Administrator), "Standard token required; no elevation is attempted");
            Sid = WindowsIdentity.GetCurrent().User.Value;
            result["ownerSid"] = Sid;
            result["mode"] = Text("mode");
            result["failureDomain"] = "tool-or-environment-not-product-installation";
            result["sourceDirectory"] = Path.GetDirectoryName(Text("installer"));
            object registrationBefore = Registrations();
            result["registrationBefore"] = registrationBefore;
            Require(((List<object>)registrationBefore).Count == 0, "Existing product registration must be preserved; use a clean SID");
            string desktopName = "TMVerify_" + Guid.NewGuid().ToString("N");
            OriginalDesktop = GetThreadDesktop(GetCurrentThreadId());
            // Never SwitchDesktop: all controls and captures stay off the user's active desktop.
            Desktop = CreateDesktop(desktopName, null, IntPtr.Zero, 0, 0x01FF, IntPtr.Zero);
            Require(Desktop != IntPtr.Zero, "CreateDesktop failed: " + Marshal.GetLastWin32Error());
            Require(SetThreadDesktop(Desktop), "SetThreadDesktop failed: " + Marshal.GetLastWin32Error());
            Job = CreateJobObject(IntPtr.Zero, null);
            Require(Job != IntPtr.Zero, "CreateJobObject failed");
            var limits = new JobExtendedLimits();
            limits.Basic.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            Require(SetInformationJobObject(Job, 9, ref limits, (uint)Marshal.SizeOf(typeof(JobExtendedLimits))), "Job cleanup policy failed");
            Start(Text("installer"), Text("mode") == "api-probe" ? "--probe-child" : "/SP- /NORESTART /LOG=\"" + Scoped(Path.Combine(Work, "installer.log")) + "\"", desktopName);
            if (Text("mode") == "api-probe") Probe(); else Wizard();
            Wait(() => OwnProcesses().Length == 0, "Own process exit", 15000);
            object registrationAfter = Registrations();
            result["registrationAfter"] = registrationAfter;
            Require(((List<object>)registrationAfter).Count == 0, "Browsing changed product registration");
            Require(!Directory.Exists(Text("target")) && !File.Exists(Text("target")), "Browsing created target files");
            Check("no-registration-or-target-after-cancel", new { registrationCount = 0, targetExists = false });
            Require(Hash(Text("installer")) == Text("installerSha256"), "Launch copy changed");
            result["passed"] = true;
            result["failureDomain"] = null;
            exit = 0;
        }
        catch (Exception error)
        {
            result["error"] = error.ToString();
            if (LastWindow != IntPtr.Zero)
            {
                try { Capture(LastWindow, "failure", true); }
                catch (Exception captureError) { result["failureCaptureError"] = captureError.Message; }
            }
        }
        finally
        {
            try
            {
                if (Job != IntPtr.Zero)
                {
                    int[] before = OwnProcesses();
                    result["cleanupTerminatedOwnProcesses"] = before;
                    if (before.Length != 0) Require(TerminateJobObject(Job, 91), "Own Job termination failed");
                    var stop = Stopwatch.StartNew();
                    while (OwnProcesses().Length != 0 && stop.ElapsedMilliseconds < 10000) Thread.Sleep(50);
                    result["remainingOwnProcesses"] = OwnProcesses().Length;
                    Require(Convert.ToInt32(result["remainingOwnProcesses"]) == 0, "Own process survived cleanup");
                    CloseHandle(Job);
                    Job = IntPtr.Zero;
                }
                else result["remainingOwnProcesses"] = 0;
                if (Desktop != IntPtr.Zero)
                {
                    // UIA may retain a hidden window on its STA until process exit; report that honestly.
                    result["restoredOriginalDesktop"] = SetThreadDesktop(OriginalDesktop);
                    result["closedPrivateDesktop"] = CloseDesktop(Desktop);
                    Desktop = IntPtr.Zero;
                }
            }
            catch (Exception error) { result["cleanupError"] = error.ToString(); result["passed"] = false; exit = 1; }
            result["elapsedMs"] = Budget.ElapsedMilliseconds;
            if (Work != null) File.WriteAllText(Path.Combine(Work, "result.json"), Json.Serialize(result), new UTF8Encoding(false));
            Console.WriteLine(Json.Serialize(new { passed = result["passed"], exitCode = exit, mode = Plan == null ? "invalid-plan" : Text("mode") }));
        }
        return exit;
    }

    private static void Wizard()
    {
        IntPtr window = WaitWindow("installer wizard");
        LastWindow = window;
        IntPtr edit = IntPtr.Zero;
        for (int attempt = 0; attempt < 3 && edit == IntPtr.Zero; attempt++)
        {
            edit = Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0 && SamePath(Caption(handle), Path.GetDirectoryName(Text("installer"))));
            if (edit == IntPtr.Zero)
            {
                Click(window, "next");
                Thread.Sleep(200);
                window = WaitWindow("directory page");
            }
        }
        Require(edit != IntPtr.Zero, "Initial directory edit must equal the actual installer parent");
        Require(Children(window).Any(handle => Caption(handle) == Notice), "Exact Chinese C-drive notice missing");
        string initial = Caption(edit);
        Check("actual-initial-directory-and-exact-notice", new { directory = initial, expected = Path.GetDirectoryName(Text("installer")), notice = Notice, processId = Owner(window) });
        Capture(window, "directory-initial");
        SendText(edit, Text("target"));
        Require(SamePath(Caption(edit), Text("target")), "Directory edit did not retain Chinese-space target");
        Capture(window, "directory-changed");
        Click(window, "next");
        TaskControl task = Wait(() => FindTask(window), "Accessible desktop shortcut task", 10000);
        bool initialTask = TaskState(task);
        SetTask(task, false);
        SetTask(task, true);
        Capture(window, "desktop-task-on");
        SetTask(task, false);
        Capture(window, "desktop-task-off");
        Check("desktop-task-on-off", new { initial = initialTask, transitions = new[] { "off", "on", "off" }, checkedObserved = true, uncheckedObserved = true });
        // From Tasks advance through the optional migration page, stopping at Ready.
        for (int page = 0; page < 4 && FindButton(window, "install") == IntPtr.Zero; page++)
        {
            Click(window, "next");
            Thread.Sleep(200);
        }
        Require(FindButton(window, "install") != IntPtr.Zero, "Ready page was not observed");
        Require(Children(window).Any(handle => Caption(handle).Contains("已准备在所选位置安装完整 TableMax")), "Expected Chinese Ready text missing");
        Check("ready-observed-without-install-invocation", new { installButtonObserved = true, installInvoked = false });
        Capture(window, "ready-no-install");
        Click(window, "back");
        for (int page = 0; page < 3 && FindTask(window) == null; page++) { Click(window, "back"); Thread.Sleep(200); }
        task = Wait(() => FindTask(window), "Tasks after Back", 5000);
        Require(!TaskState(task), "Desktop task changed after Back");
        Click(window, "back");
        Wait(() => Children(window).Any(handle => Caption(handle) == Notice), "Directory after Back", 5000);
        edit = Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0 && SamePath(Caption(handle), Text("target")));
        Require(edit != IntPtr.Zero, "Target did not persist after Back");
        Check("back-retains-target-and-shortcut-choice", new { target = Caption(edit), desktopTask = false, notice = Notice });
        Capture(window, "back-directory");
        Click(window, "cancel");
        var end = Stopwatch.StartNew();
        while (OwnProcesses().Length != 0 && end.ElapsedMilliseconds < 10000)
        {
            foreach (IntPtr dialog in Windows().Where(handle => Class(handle) == "#32770"))
            {
                IntPtr yes = Children(dialog).FirstOrDefault(handle => Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0 && GetDlgCtrlID(handle) == 6);
                if (yes != IntPtr.Zero)
                {
                    string[] message = Children(dialog).Where(handle => Class(handle).IndexOf("Static", StringComparison.OrdinalIgnoreCase) >= 0).Select(Caption).ToArray();
                    Require(message.Any(value => value.Contains("Setup is not complete.") && value.Contains("Exit Setup?")), "Unexpected own cancel confirmation text");
                    int processId = Owner(dialog);
                    Capture(dialog, "cancel-confirmation");
                    ClickHandle(yes, "cancel-confirm-yes");
                    Check("owned-cancel-confirmation", new { processId, buttonId = 6, message });
                }
            }
            Thread.Sleep(100);
        }
    }

    private static void Probe()
    {
        IntPtr window = WaitWindow("private-desktop API probe");
        LastWindow = window;
        Require(Caption(window) == "TableMax wizard API probe", "Wrong probe window");
        IntPtr edit = Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0);
        Require(edit != IntPtr.Zero, "Probe edit missing");
        SendText(edit, Text("target"));
        Require(Caption(edit) == Text("target"), "Private desktop edit read/write failed");
        TaskControl task = Wait(() => FindTask(window), "Probe accessible checkbox", 5000);
        SetTask(task, true);
        SetTask(task, false);
        Capture(window, "api-probe-actual-window");
        Check("api-probe-private-desktop-control-and-capture", new { actualWindow = true, installerProof = false, processId = Owner(window) });
        Click(window, "cancel");
    }

    private static int ProbeChild()
    {
        Exception failure = null;
        var thread = new Thread(() => { try { ProbeForm(); } catch (Exception error) { failure = error; } });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        if (failure != null) throw failure;
        return 0;
    }

    private static void ProbeForm()
    {
        Application.EnableVisualStyles();
        using (var form = new Form { Text = "TableMax wizard API probe", Width = 720, Height = 440, StartPosition = FormStartPosition.CenterScreen, Font = new Font("Microsoft YaHei UI", 12) })
        {
            form.Controls.Add(new Label { Text = Notice, AutoSize = true, Left = 24, Top = 32 });
            form.Controls.Add(new TextBox { Text = "probe", Left = 24, Top = 90, Width = 620 });
            form.Controls.Add(new CheckBox { Text = DesktopTask, AccessibleName = DesktopTask, Left = 24, Top = 150, Width = 420 });
            var cancel = new Button { Text = "取消", Left = 550, Top = 300, Width = 110 };
            cancel.Click += (sender, e) => form.Close();
            form.Controls.Add(cancel);
            Application.Run(form);
        }
    }

    private sealed class TaskControl
    {
        public AutomationElement Element;
        public IAccessible Accessible;
        public object Child;
        public IntPtr Window;
    }

    private static TaskControl FindTask(IntPtr window)
    {
        OwnWindow(window);
        // Inno 6.7.3 exposes real checked children through its MSAA provider.
        // Its accDoDefaultAction is deliberately unsupported; do not trust a proxy Toggle.
        foreach (IntPtr handle in Children(window).Where(child => Class(child).IndexOf("NewCheckListBox", StringComparison.OrdinalIgnoreCase) >= 0))
        {
            Guid iid = new Guid("618736e0-3c3d-11cf-810c-00aa00389b71");
            object accessible;
            if (AccessibleObjectFromWindow(handle, 0xFFFFFFFC, ref iid, out accessible) != 0) continue;
            var match = AccessibleTask(accessible as IAccessible, handle, 0);
            if (match != null) return match;
        }
        var root = AutomationElement.FromHandle(window);
        var items = root.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.NameProperty, DesktopTask));
        foreach (AutomationElement item in items)
        {
            Require(OwnProcesses().Contains(item.Current.ProcessId), "Accessible element belongs to another process");
            object pattern;
            if (item.TryGetCurrentPattern(TogglePattern.Pattern, out pattern)) return new TaskControl { Element = item, Window = window };
        }
        return null;
    }

    private static TaskControl AccessibleTask(IAccessible accessible, IntPtr window, int depth)
    {
        if (accessible == null || depth > 8) return null;
        try
        {
            if (accessible.get_accName(0) == DesktopTask && Convert.ToInt32(accessible.get_accRole(0)) == 44)
                return new TaskControl { Accessible = accessible, Child = 0, Window = window };
            int count = accessible.accChildCount;
            Require(count >= 0 && count <= 512, "Unexpected accessible child count");
            if (count == 0) return null;
            var children = new object[count];
            int obtained;
            if (AccessibleChildren(accessible, 0, count, children, out obtained) != 0) return null;
            for (int i = 0; i < obtained; i++)
            {
                var child = children[i] as IAccessible;
                if (child != null)
                {
                    var match = AccessibleTask(child, window, depth + 1);
                    if (match != null) return match;
                }
                else if (children[i] is int && accessible.get_accName(children[i]) == DesktopTask && Convert.ToInt32(accessible.get_accRole(children[i])) == 44)
                    return new TaskControl { Accessible = accessible, Child = children[i], Window = window };
            }
        }
        catch (COMException) { return null; }
        return null;
    }

    private static bool TaskState(TaskControl item)
    {
        OwnWindow(item.Window);
        object pattern;
        if (item.Element != null)
        {
            Require(OwnProcesses().Contains(item.Element.Current.ProcessId), "Foreign accessible task");
            Require(item.Element.TryGetCurrentPattern(TogglePattern.Pattern, out pattern), "Task TogglePattern vanished");
            var state = ((TogglePattern)pattern).Current.ToggleState;
            Require(state != ToggleState.Indeterminate, "Indeterminate desktop task");
            return state == ToggleState.On;
        }
        Require(item.Accessible != null, "Desktop task has no observable check state");
        int flags = Convert.ToInt32(item.Accessible.get_accState(item.Child));
        Require((flags & 0x1) == 0, "Accessible task is unavailable");
        Require((flags & 0x20) == 0, "Accessible task has mixed check state");
        return (flags & 0x10) != 0; // STATE_SYSTEM_CHECKED
    }

    private static void SetTask(TaskControl item, bool expected)
    {
        for (int attempt = 0; attempt < 2 && TaskState(item) != expected; attempt++)
        {
            object pattern;
            OwnWindow(item.Window);
            if (item.Element != null)
            {
                // UIA's legacy checkbox proxy can call global SendInput; use only its read pattern.
                Require(item.Element.TryGetCurrentPattern(TogglePattern.Pattern, out pattern), "Task state unavailable");
                IntPtr handle = new IntPtr(item.Element.Current.NativeWindowHandle);
                OwnWindow(handle);
                Require(Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0 && Caption(handle) == DesktopTask, "Exact own checkbox HWND required");
                Send(handle, 0x00F5, IntPtr.Zero, IntPtr.Zero);
            }
            else
            {
                Require(Class(item.Window).IndexOf("NewCheckListBox", StringComparison.OrdinalIgnoreCase) >= 0, "Only the own Inno checklist can receive task key messages");
                Require(item.Child is int && (int)item.Child > 0, "Exact Inno checklist child required");
                item.Accessible.accSelect(0x1 | 0x2, item.Child); // TAKEFOCUS | TAKESELECTION
                Send(item.Window, 0x0100, new IntPtr(0x20), IntPtr.Zero); // WM_KEYDOWN / VK_SPACE
                Send(item.Window, 0x0101, new IntPtr(0x20), IntPtr.Zero); // WM_KEYUP
            }
            Thread.Sleep(100);
        }
        Require(TaskState(item) == expected, "Task checked state did not change");
    }

    private static IntPtr WaitWindow(string label)
    {
        return Wait(() => Windows().FirstOrDefault(handle => Children(handle).Any(child => FindButtonCaption(Caption(child), "cancel"))), label, 15000);
    }

    private static List<IntPtr> Windows()
    {
        var windows = new List<IntPtr>();
        SetLastError(0);
        bool enumerated = EnumDesktopWindows(Desktop, (handle, unused) => { if (IsWindowVisible(handle) && OwnProcesses().Contains(ProcessId(handle))) { OwnWindow(handle); windows.Add(handle); } return true; }, IntPtr.Zero);
        int error = Marshal.GetLastWin32Error();
        // A fresh desktop can have no top-level windows before the child starts its UI.
        // That empty result is only retried within WaitWindow's budget, never accepted as proof.
        Require(enumerated || (windows.Count == 0 && error == 0), "EnumDesktopWindows failed: " + error);
        return windows;
    }

    private static List<IntPtr> Children(IntPtr window)
    {
        OwnWindow(window);
        var controls = new List<IntPtr>();
        EnumChildWindows(window, (handle, unused) => { if (IsWindowVisible(handle)) { OwnWindow(handle); controls.Add(handle); } return true; }, IntPtr.Zero);
        return controls;
    }

    private static IntPtr FindButton(IntPtr window, string role)
    {
        return Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0 && FindButtonCaption(Caption(handle), role));
    }

    private static bool FindButtonCaption(string text, string role)
    {
        string normalized = text.Replace("&", "").Replace("(", "").Replace(")", "").Replace("<", "").Replace(">", "").Trim();
        if (role == "next") return normalized.StartsWith("下一步", StringComparison.Ordinal);
        if (role == "back") return normalized.StartsWith("上一步", StringComparison.Ordinal);
        if (role == "cancel") return normalized == "取消";
        if (role == "install") return normalized.StartsWith("安装", StringComparison.Ordinal);
        return false;
    }

    private static void Click(IntPtr window, string role)
    {
        Require(role == "next" || role == "back" || role == "cancel", "Install/Finish invocation is prohibited");
        IntPtr button = Wait(() => FindButton(window, role), "Owned " + role + " button", 5000);
        Require(IsWindowEnabled(button), "Navigation button disabled");
        Require(!FindButtonCaption(Caption(button), "install"), "Install button must never be invoked");
        ClickHandle(button, role);
    }

    private static void ClickHandle(IntPtr button, string role)
    {
        OwnWindow(button);
        Require(role == "next" || role == "back" || role == "cancel" || (role == "cancel-confirm-yes" && GetDlgCtrlID(button) == 6), "Unsupported UI action");
        Require(!FindButtonCaption(Caption(button), "install"), "Install caption rejected");
        if (role == "cancel" || role == "cancel-confirm-yes")
            Require(PostMessage(button, 0x00F5, IntPtr.Zero, IntPtr.Zero), "Own asynchronous Cancel click failed");
        else Send(button, 0x00F5, IntPtr.Zero, IntPtr.Zero); // BM_CLICK, targeted HWND only
    }

    private static void SendText(IntPtr edit, string value)
    {
        OwnWindow(edit);
        Require(Class(edit).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0, "Only a directory edit may be written");
        IntPtr pointer = Marshal.StringToHGlobalUni(value);
        try { Send(edit, 0x000C, IntPtr.Zero, pointer); } finally { Marshal.FreeHGlobal(pointer); }
    }

    private static string Caption(IntPtr handle)
    {
        OwnWindow(handle);
        IntPtr length = Send(handle, 0x000E, IntPtr.Zero, IntPtr.Zero);
        int count = checked((int)length.ToInt64());
        Require(count >= 0 && count < 65536, "Unexpected control text length");
        IntPtr buffer = Marshal.AllocHGlobal((count + 1) * 2);
        try { Send(handle, 0x000D, new IntPtr(count + 1), buffer); return Marshal.PtrToStringUni(buffer) ?? ""; }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static string Class(IntPtr handle)
    {
        OwnWindow(handle);
        var value = new StringBuilder(256);
        Require(GetClassName(handle, value, value.Capacity) != 0, "Class lookup failed");
        return value.ToString();
    }

    private static IntPtr Send(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam)
    {
        OwnWindow(handle);
        IntPtr result;
        Require(SendMessageTimeout(handle, message, wParam, lParam, 0x0002, 2000, out result) != IntPtr.Zero, "Owned control did not respond: " + message);
        return result;
    }

    private static void Capture(IntPtr window, string page, bool failure = false)
    {
        OwnWindow(window);
        LastWindow = window;
        Require(SetThreadDpiAwarenessContext(new IntPtr(-4)) != IntPtr.Zero, "Harness capture thread DPI context failed");
        Rect rect;
        Require(GetWindowRect(window, out rect), "Window bounds unavailable");
        int width = rect.Right - rect.Left, height = rect.Bottom - rect.Top;
        Require(width >= 100 && height >= 80 && width <= 8192 && height <= 8192, "Unexpected capture size");
        string path = Scoped(Path.Combine(Text("captures"), (Captures.Count + 1).ToString("D2") + "-" + page + ".png"));
        using (var image = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(image))
        {
            IntPtr dc = graphics.GetHdc();
            bool rendered;
            try { rendered = PrintWindow(window, dc, 2); }
            finally { graphics.ReleaseHdc(dc); }
            Require(rendered, "Actual-window PrintWindow failed");
            var colors = new HashSet<int>();
            for (int y = 0; y < height; y += Math.Max(1, height / 80))
                for (int x = 0; x < width; x += Math.Max(1, width / 80)) colors.Add(image.GetPixel(x, y).ToArgb());
            Require(colors.Count >= 8, "Blank private-desktop capture rejected");
            image.Save(path, ImageFormat.Png);
            Captures.Add(new { path, page, failure, processId = Owner(window), windowHandle = window.ToInt64().ToString("X"), width, height, dpi = GetDpiForWindow(window), windowRect = new { left = rect.Left, top = rect.Top, right = rect.Right, bottom = rect.Bottom }, captureDpiContext = "PER_MONITOR_AWARE_V2", sampledColors = colors.Count, method = "PrintWindow actual HWND" });
        }
    }

    private static void Start(string executable, string arguments, string desktopName)
    {
        var startup = new StartupInfo { Size = (uint)Marshal.SizeOf(typeof(StartupInfo)), Desktop = desktopName };
        ProcessInformation process;
        Require(CreateProcess(executable, new StringBuilder("\"" + executable + "\" " + arguments), IntPtr.Zero, IntPtr.Zero, false, 0x00000004, IntPtr.Zero, Work, ref startup, out process), "Own CreateProcess failed: " + Marshal.GetLastWin32Error());
        bool assigned = false;
        try
        {
            Require(AssignProcessToJobObject(Job, process.Process), "Own process Job assignment failed: " + Marshal.GetLastWin32Error());
            assigned = true;
            OwnProcess((int)process.ProcessId);
            Require(ResumeThread(process.Thread) != 0xFFFFFFFF, "Own process resume failed");
            Check("own-process-private-desktop-job", new { processId = process.ProcessId, desktop = desktopName, switchedDesktop = false, sid = Sid, executable });
        }
        finally
        {
            if (!assigned) TerminateProcess(process.Process, 92);
            CloseHandle(process.Thread);
            CloseHandle(process.Process);
        }
    }

    private static int[] OwnProcesses()
    {
        if (Job == IntPtr.Zero) return new int[0];
        int length = 8 + IntPtr.Size * 128;
        IntPtr buffer = Marshal.AllocHGlobal(length);
        try
        {
            uint returned;
            Require(QueryInformationJobObject(Job, 3, buffer, (uint)length, out returned), "Own Job process query failed");
            int count = Marshal.ReadInt32(buffer, 4);
            Require(count >= 0 && count <= 128, "Unexpected own process count");
            var ids = new int[count];
            for (int i = 0; i < count; i++) ids[i] = checked((int)Marshal.ReadIntPtr(buffer, 8 + i * IntPtr.Size).ToInt64());
            return ids;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static void OwnProcess(int id)
    {
        Require(OwnProcesses().Contains(id), "Process is outside the own Job");
        IntPtr process = OpenProcess(0x1000, false, (uint)id);
        Require(process != IntPtr.Zero, "Own process cannot be identified");
        IntPtr token = IntPtr.Zero;
        try
        {
            var path = new StringBuilder(32768);
            int length = path.Capacity;
            Require(QueryFullProcessImageName(process, 0, path, ref length), "Own image path unavailable");
            Scoped(path.ToString());
            Require(OpenProcessToken(process, 0x0008, out token), "Own process SID unavailable");
            using (var identity = new WindowsIdentity(token)) Require(identity.User.Value == Sid, "Process SID differs from test owner");
        }
        finally { if (token != IntPtr.Zero) CloseHandle(token); CloseHandle(process); }
    }

    private static void OwnWindow(IntPtr handle)
    {
        Require(handle != IntPtr.Zero && IsWindow(handle), "Owned HWND unavailable");
        OwnProcess(ProcessId(handle));
    }

    private static int Owner(IntPtr handle) { OwnWindow(handle); return ProcessId(handle); }
    private static int ProcessId(IntPtr handle) { uint id; GetWindowThreadProcessId(handle, out id); return checked((int)id); }

    private static object Registrations()
    {
        var records = new List<object>();
        foreach (RegistryHive hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
            foreach (RegistryView view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                using (var baseKey = RegistryKey.OpenBaseKey(hive, view))
                using (var key = baseKey.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\" + Text("productId") + "_is1", false))
                    if (key != null) records.Add(new { hive = hive.ToString(), view = view.ToString(), values = key.GetValueNames().ToDictionary(name => name, name => key.GetValue(name)) });
        return records;
    }

    private static string Text(string key) { return (string)Plan[key]; }
    private static string Scoped(string path)
    {
        string full = Path.GetFullPath(path);
        Require(full.StartsWith(Work.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase), "Path escaped own work");
        Safe(full);
        return full;
    }
    private static void Safe(string path)
    {
        for (string cursor = Path.GetFullPath(path); cursor != null; cursor = Path.GetDirectoryName(cursor))
            if (File.Exists(cursor) || Directory.Exists(cursor)) Require((File.GetAttributes(cursor) & FileAttributes.ReparsePoint) == 0, "Linked wizard path refused");
    }
    private static string Hash(string path) { using (var sha = SHA256.Create()) using (var stream = File.OpenRead(path)) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant(); }
    private static bool SamePath(string a, string b) { try { return String.Equals(Path.GetFullPath(a).TrimEnd('\\'), Path.GetFullPath(b).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase); } catch (ArgumentException) { return false; } }
    private static void Check(string name, object details) { Checks.Add(new { name, passed = true, details }); }
    private static void Require(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
    private static void Wait(Func<bool> predicate, string label, int timeout) { Wait(() => predicate() ? new object() : null, label, timeout); }
    private static T Wait<T>(Func<T> callback, string label, int timeout)
    {
        var timer = Stopwatch.StartNew();
        while (timer.ElapsedMilliseconds < timeout && Budget.ElapsedMilliseconds < 90000)
        {
            T value = callback();
            if (!EqualityComparer<T>.Default.Equals(value, default(T))) return value;
            Thread.Sleep(100);
        }
        throw new TimeoutException(label + " timed out");
    }

    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct StartupInfo
    {
        public uint Size; public string Reserved, Desktop, Title; public uint X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags; public ushort ShowWindow, Reserved2; public IntPtr ReservedPointer, StdInput, StdOutput, StdError;
    }
    [StructLayout(LayoutKind.Sequential)] private struct ProcessInformation { public IntPtr Process, Thread; public uint ProcessId, ThreadId; }
    [StructLayout(LayoutKind.Sequential)] private struct JobBasicLimits { public long PerProcessUserTime, PerJobUserTime; public uint LimitFlags; public UIntPtr MinimumWorkingSet, MaximumWorkingSet; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass; }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] private struct JobExtendedLimits { public JobBasicLimits Basic; public IoCounters Io; public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
    private delegate bool EnumWindowsCallback(IntPtr handle, IntPtr parameter);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateDesktop(string name, string device, IntPtr mode, uint flags, uint access, IntPtr security);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetThreadDesktop(IntPtr desktop);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("user32.dll")] private static extern IntPtr GetThreadDesktop(uint thread);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll")] private static extern void SetLastError(uint error);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr security, string name);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetInformationJobObject(IntPtr job, int information, ref JobExtendedLimits value, uint length);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryInformationJobObject(IntPtr job, int information, IntPtr value, uint length, out uint returned);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool TerminateJobObject(IntPtr job, uint exit);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateProcess(string application, StringBuilder command, IntPtr processSecurity, IntPtr threadSecurity, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint flags, IntPtr environment, string directory, ref StartupInfo startup, out ProcessInformation process);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool TerminateProcess(IntPtr process, uint exit);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint id);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder path, ref int length);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EnumDesktopWindows(IntPtr desktop, EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EnumChildWindows(IntPtr window, EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindowEnabled(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool PrintWindow(IntPtr window, IntPtr dc, uint flags);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("oleacc.dll")] private static extern int AccessibleObjectFromWindow(IntPtr window, uint objectId, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out object accessible);
    [DllImport("oleacc.dll")] private static extern int AccessibleChildren(IAccessible accessible, int start, int count, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 2)] object[] children, out int obtained);
}
